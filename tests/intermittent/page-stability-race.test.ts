#!/usr/bin/env tsx

/**
 * Page Stability Race Condition Test
 *
 * HYPOTHESIS:
 * The waitForPRPage() function waits for file count to stabilize for 1 second.
 * On slow networks or with GitHub's progressive rendering, more files may
 * appear AFTER the stability window passes, causing incomplete stats.
 *
 * TEST APPROACH:
 * 1. Simulate progressive file loading with delays
 * 2. Check if the extension correctly waits for ALL files
 * 3. Test with various loading speeds to find the failure threshold
 */

import puppeteer, { Browser } from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import {
  ExtensionStats,
  parsePRUrl,
  fetchAllPRFiles,
  calculateExpectedStats,
  getExtensionStats,
  getFilesUrl,
} from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionPath = join(__dirname, '..', '..');
const resultsDir = join(__dirname, 'results');

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

interface FileLoadTimestamp {
  count: number;
  timestamp: number;
}

interface TestResult {
  maxGap: number;
  fileCount: number;
  expectedFileCount: number;
  timingData: FileLoadTimestamp[];
  extensionStats: ExtensionStats | null;
  apiStats: ExtensionStats;
  matches: boolean;
}

interface ReloadResult {
  iteration: number;
  loadTime: number;
  stats: ExtensionStats | null;
  matches: boolean;
}

/**
 * Test 1: Check if extension misses late-loading files
 *
 * GitHub loads files progressively. If the last file loads more than 1 second
 * after the previous file, the extension might miss it.
 */
async function testLateLoadingFiles(browser: Browser): Promise<TestResult> {
  console.log('\n🧪 Test 1: Late-loading files detection');
  console.log('─'.repeat(60));

  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1920, height: 1080 });

    const testPR = process.env.TEST_PR_URL || 'https://github.com/compio-rs/compio/pull/417';
    const prInfo = parsePRUrl(testPR);

    // Fetch all files with pagination support
    const files = await fetchAllPRFiles(prInfo);
    const expectedFileCount = files.length;
    console.log(`   Expected files from API: ${expectedFileCount}`);

    // Navigate to PR and inject timing instrumentation
    const filesUrl = getFilesUrl(testPR);
    console.log(`   Loading: ${filesUrl}`);

    await page.goto(filesUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Inject timing observer BEFORE extension runs
    await page.evaluate(() => {
      (window as any).__fileLoadTimestamps = [];
      (window as any).__originalFileCount = 0;

      const observer = new MutationObserver(() => {
        const containers = document.querySelectorAll('[data-details-container-group="file"]');
        if (containers.length > (window as any).__originalFileCount) {
          (window as any).__fileLoadTimestamps.push({
            count: containers.length,
            timestamp: Date.now(),
          });
          (window as any).__originalFileCount = containers.length;
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      (window as any).__stopObserver = () => observer.disconnect();
    });

    // Wait for page to fully load
    await page.waitForSelector('[data-details-container-group="file"]', { timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for all files

    // Collect timing data
    const timingData: FileLoadTimestamp[] = await page.evaluate(() => {
      (window as any).__stopObserver();
      return (window as any).__fileLoadTimestamps;
    });

    // Analyze timing gaps
    console.log(`\n   📊 File loading timeline:`);
    let maxGap = 0;
    for (let i = 1; i < timingData.length; i++) {
      const gap = timingData[i].timestamp - timingData[i - 1].timestamp;
      maxGap = Math.max(maxGap, gap);
      if (gap > 500) {
        // Significant gap
        console.log(
          `   ⚠️  Gap of ${gap}ms between file ${timingData[i - 1].count} and ${timingData[i].count}`
        );
      }
    }

    // Check if any gap exceeds the stability window
    const stabilityWindow = 1000; // 2 checks * 500ms
    if (maxGap > stabilityWindow) {
      console.log(`\n   ❌ POTENTIAL ISSUE FOUND!`);
      console.log(`      Max loading gap: ${maxGap}ms > ${stabilityWindow}ms stability window`);
      console.log(`      This could cause intermittent missing files!`);
    } else {
      console.log(`\n   ✅ Max loading gap (${maxGap}ms) is within stability window`);
    }

    // Check what the extension reported vs API
    const extensionStats = await getExtensionStats(page);
    const apiStats = calculateExpectedStats(files);

    if (extensionStats) {
      console.log(`\n   Extension reported: +${extensionStats.added} -${extensionStats.removed}`);
      console.log(`   API expected:       +${apiStats.added} -${apiStats.removed}`);

      if (extensionStats.added !== apiStats.added || extensionStats.removed !== apiStats.removed) {
        console.log(`   ❌ MISMATCH - Possible timing issue!`);
      } else {
        console.log(`   ✅ Stats match API`);
      }
    }

    const matches =
      extensionStats?.added === apiStats.added && extensionStats?.removed === apiStats.removed;

    return {
      maxGap,
      fileCount: timingData[timingData.length - 1]?.count || 0,
      expectedFileCount,
      timingData,
      extensionStats,
      apiStats,
      matches,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2: Multiple rapid page loads to catch intermittent failures
 */
async function testRapidReloads(browser: Browser, iterations = 5): Promise<ReloadResult[]> {
  console.log(`\n🧪 Test 2: Rapid reload consistency (${iterations} iterations)`);
  console.log('─'.repeat(60));

  const results: ReloadResult[] = [];
  const testPR = process.env.TEST_PR_URL || 'https://github.com/compio-rs/compio/pull/417';

  // Get expected stats from API with pagination
  const prInfo = parsePRUrl(testPR);
  const files = await fetchAllPRFiles(prInfo);
  const expectedStats = calculateExpectedStats(files);

  for (let i = 0; i < iterations; i++) {
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 1920, height: 1080 });
      const filesUrl = getFilesUrl(testPR);

      const startTime = Date.now();
      await page.goto(filesUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for extension to finish
      await page.waitForSelector('#pr-language-stats-panel table', { timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const stats = await getExtensionStats(page);
      const loadTime = Date.now() - startTime;
      const matches =
        stats?.added === expectedStats.added && stats?.removed === expectedStats.removed;

      results.push({
        iteration: i + 1,
        loadTime,
        stats,
        matches,
      });

      console.log(
        `   Iteration ${i + 1}: +${stats?.added || '?'} -${stats?.removed || '?'} (${loadTime}ms) ${matches ? '✅' : '❌'}`
      );
    } finally {
      await page.close();
    }

    // Small delay between iterations
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const successCount = results.filter(r => r.matches).length;
  console.log(`\n   📊 Results: ${successCount}/${iterations} matched expected stats`);

  if (successCount < iterations) {
    console.log(`   ❌ INTERMITTENT FAILURE DETECTED!`);
    console.log(
      `   Failed iterations:`,
      results.filter(r => !r.matches)
    );
  }

  return results;
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  console.log('🔬 Page Stability Race Condition Tests');
  console.log('═'.repeat(60));

  const browser = await puppeteer.launch({
    headless: !process.env.HEADED,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  try {
    const lateLoadingResult = await testLateLoadingFiles(browser);
    const rapidReloadsResult = await testRapidReloads(browser, 5);

    const results = {
      lateLoading: lateLoadingResult,
      rapidReloads: rapidReloadsResult,
    };

    // Write results to file
    const resultsFile = join(resultsDir, 'page-stability-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n📁 Results saved to: ${resultsFile}`);

    // Summary
    console.log('\n📋 PAGE STABILITY TEST SUMMARY');
    console.log('═'.repeat(60));

    const rapidFailures = rapidReloadsResult.filter(r => !r.matches).length;
    if (rapidFailures > 0) {
      console.log(`❌ LIKELY ISSUE: ${rapidFailures} intermittent failures detected`);
      console.log('   Recommendation: Increase stability window or use API consistently');
    } else if (lateLoadingResult.maxGap > 1000) {
      console.log('⚠️  POSSIBLE ISSUE: Large file loading gaps detected');
      console.log('   May cause issues on slower connections');
    } else {
      console.log('✅ No timing issues detected in tests');
    }
  } finally {
    await browser.close();
  }
}

runTests().catch(console.error);
