#!/usr/bin/env tsx

/**
 * API Promise Reuse Test
 *
 * HYPOTHESIS:
 * The apiDataPromise global variable is set to null after the first analyze() call.
 * If analyze() is called again (e.g., user toggles "Exclude generated" checkbox),
 * the second call cannot use the cached API result and must re-fetch.
 * If that re-fetch fails (network error, etc), it falls back to DOM scraping,
 * potentially giving different/incorrect results.
 *
 * TEST APPROACH:
 * 1. Load page, verify first analysis uses cached API data
 * 2. Toggle checkbox, verify second analysis behavior
 * 3. Simulate network failure on second analysis
 * 4. Check if results differ between API and DOM scraping
 */

import puppeteer, { Browser, ConsoleMessage, HTTPRequest } from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { ExtensionStats, getExtensionStats, getFilesUrl } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionPath = join(__dirname, '..', '..');
const resultsDir = join(__dirname, 'results');

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

interface PromiseClearingResult {
  usedEarlyFetch: boolean;
  secondUsedEarlyFetch: boolean;
  fetchedFromAPIAgain: boolean;
  firstStats: ExtensionStats | null;
  secondStats: ExtensionStats | null;
  thirdStats: ExtensionStats | null;
  consistent: boolean;
}

interface NetworkFailureResult {
  firstStats: ExtensionStats | null;
  secondStats: ExtensionStats | { error: string } | null;
  statsDiffer: boolean;
}

/**
 * Test 1: Check if apiDataPromise is cleared after first use
 */
async function testApiPromiseClearing(browser: Browser): Promise<PromiseClearingResult> {
  console.log('\n🧪 Test 1: API Promise clearing behavior');
  console.log('─'.repeat(60));

  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1920, height: 1080 });

    const consoleLogs: string[] = [];
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.text().includes('PR Lang Stats')) {
        consoleLogs.push(msg.text());
      }
    });

    const testPR = process.env.TEST_PR_URL || 'https://github.com/compio-rs/compio/pull/417';
    const filesUrl = getFilesUrl(testPR);

    console.log(`   Loading: ${filesUrl}`);
    await page.goto(filesUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for extension to finish first analysis
    await page.waitForSelector('#pr-language-stats-panel table', { timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check console logs for "Using early API fetch result"
    const usedEarlyFetch = consoleLogs.some(log => log.includes('Using early API fetch result'));
    console.log(`   First analysis used early API fetch: ${usedEarlyFetch ? '✅' : '❌'}`);

    // Get first stats
    const firstStats = await getExtensionStats(page);
    console.log(`   First stats: +${firstStats?.added} -${firstStats?.removed}`);

    // Clear console logs
    consoleLogs.length = 0;

    // Toggle the checkbox to trigger re-analysis
    console.log('\n   Toggling "Exclude generated" checkbox...');
    await page.click('#exclude-generated-checkbox');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if second analysis used early fetch (it shouldn't!)
    const secondUsedEarlyFetch = consoleLogs.some(log =>
      log.includes('Using early API fetch result')
    );
    const fetchedFromAPIAgain = consoleLogs.some(log => log.includes('Fetching from API now'));

    console.log(
      `   Second analysis used early fetch: ${secondUsedEarlyFetch ? '⚠️ YES' : '✅ NO'}`
    );
    console.log(`   Second analysis fetched from API again: ${fetchedFromAPIAgain ? '✅' : '❌'}`);

    // Get second stats
    const secondStats = await getExtensionStats(page);
    console.log(`   Second stats: +${secondStats?.added} -${secondStats?.removed}`);

    // Toggle back
    consoleLogs.length = 0;
    console.log('\n   Toggling checkbox back...');
    await page.click('#exclude-generated-checkbox');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const thirdStats = await getExtensionStats(page);
    console.log(`   Third stats: +${thirdStats?.added} -${thirdStats?.removed}`);

    // Check consistency
    const consistent =
      firstStats?.added === thirdStats?.added && firstStats?.removed === thirdStats?.removed;
    console.log(`\n   Stats consistent across toggles: ${consistent ? '✅' : '❌'}`);

    return {
      usedEarlyFetch,
      secondUsedEarlyFetch,
      fetchedFromAPIAgain,
      firstStats,
      secondStats,
      thirdStats,
      consistent,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2: Simulate network failure on re-analysis
 */
async function testNetworkFailureOnReanalysis(browser: Browser): Promise<NetworkFailureResult> {
  console.log('\n🧪 Test 2: Network failure during re-analysis');
  console.log('─'.repeat(60));

  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1920, height: 1080 });

    const testPR = process.env.TEST_PR_URL || 'https://github.com/compio-rs/compio/pull/417';
    const filesUrl = getFilesUrl(testPR);

    console.log(`   Loading: ${filesUrl}`);
    await page.goto(filesUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for first analysis
    await page.waitForSelector('#pr-language-stats-panel table', { timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get first stats
    const firstStats = await getExtensionStats(page);
    console.log(`   First stats (API): +${firstStats?.added} -${firstStats?.removed}`);

    // Block GitHub API requests
    console.log('   Blocking API requests...');
    await page.setRequestInterception(true);
    page.on('request', (request: HTTPRequest) => {
      if (request.url().includes('api.github.com')) {
        console.log(`   🚫 Blocked: ${request.url().substring(0, 60)}...`);
        request.abort();
      } else {
        request.continue();
      }
    });

    // Toggle checkbox to force re-analysis
    console.log('   Toggling checkbox with API blocked...');
    await page.click('#exclude-generated-checkbox');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get second stats (should fall back to DOM or show error)
    const secondStats = await page.evaluate((): ExtensionStats | { error: string } | null => {
      const panel = document.querySelector('#pr-language-stats-panel');

      // Check for error message
      const errorFlash = panel?.querySelector('.flash-error');
      if (errorFlash) {
        return { error: errorFlash.textContent || 'Unknown error' };
      }

      const totalRow = panel?.querySelector('.total-row');
      if (!totalRow) return null;
      return {
        added: parseInt(
          totalRow.querySelector('.language-added')?.textContent?.replace(/[+]/g, '') || '0',
          10
        ),
        removed: parseInt(
          totalRow.querySelector('.language-removed')?.textContent?.replace(/[-]/g, '') || '0',
          10
        ),
      };
    });

    const isError = secondStats && 'error' in secondStats;
    console.log(
      `   Second stats (API blocked): ${isError ? (secondStats as { error: string }).error : `+${(secondStats as ExtensionStats)?.added} -${(secondStats as ExtensionStats)?.removed}`}`
    );

    // Compare results
    let statsDiffer = false;
    if (secondStats && !isError && firstStats) {
      const second = secondStats as ExtensionStats;
      if (firstStats.added !== second.added || firstStats.removed !== second.removed) {
        console.log(`\n   ❌ STATS DIFFER WHEN API BLOCKED!`);
        console.log(`   This could cause intermittent inconsistency.`);
        statsDiffer = true;
      } else {
        console.log(`\n   ✅ Stats remain consistent`);
      }
    } else if (isError) {
      console.log(`\n   ⚠️  Extension showed error when API blocked`);
    }

    return { firstStats, secondStats, statsDiffer };
  } finally {
    await page.close();
  }
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  console.log('🔬 API Promise Reuse Tests');
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
    const promiseClearingResult = await testApiPromiseClearing(browser);
    const networkFailureResult = await testNetworkFailureOnReanalysis(browser);

    const results = {
      promiseClearing: promiseClearingResult,
      networkFailure: networkFailureResult,
    };

    // Write results to file
    const resultsFile = join(resultsDir, 'api-promise-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n📁 Results saved to: ${resultsFile}`);

    // Summary
    console.log('\n📋 API PROMISE TEST SUMMARY');
    console.log('═'.repeat(60));

    if (!promiseClearingResult.consistent) {
      console.log('❌ ISSUE FOUND: Stats inconsistent across checkbox toggles');
    } else if (networkFailureResult.statsDiffer) {
      console.log('⚠️  POSSIBLE ISSUE: Stats differ when API is blocked');
      console.log('   Network errors could cause intermittent inconsistency');
    } else {
      console.log('✅ No API promise reuse issues detected');
    }
  } finally {
    await browser.close();
  }
}

runTests().catch(console.error);
