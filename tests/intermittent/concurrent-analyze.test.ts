#!/usr/bin/env tsx

/**
 * Concurrent analyze() Calls Test
 *
 * HYPOTHESIS:
 * Multiple events can trigger analyze() without any mutex:
 * - Initial page load
 * - Checkbox toggle for "Exclude generated files"
 * - (Disabled) MutationObserver
 *
 * If the user rapidly toggles the checkbox, multiple concurrent analyze()
 * calls could race to update this.languageStats, causing corrupted or
 * inconsistent results.
 *
 * TEST APPROACH:
 * 1. Load page, wait for initial analysis
 * 2. Rapidly toggle checkbox multiple times
 * 3. Check if final stats are consistent
 * 4. Look for race condition symptoms (flickering, wrong values)
 */

import puppeteer, { Browser } from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionPath = join(__dirname, '..', '..');
const resultsDir = join(__dirname, 'results');

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

interface ExtensionStats {
  added: number;
  removed: number;
}

interface StatsSnapshot {
  timestamp: number;
  stats: ExtensionStats | null;
  checkboxState: boolean;
}

interface RapidToggleResult {
  initialStats: ExtensionStats | null;
  snapshots: StatsSnapshot[];
  finalStats: ExtensionStats | null;
  expectedStats: ExtensionStats;
  consistent: boolean;
  raceConditionDetected: boolean;
}

/**
 * Test 1: Rapid checkbox toggling to trigger concurrent analyze() calls
 */
async function testRapidCheckboxToggle(browser: Browser): Promise<RapidToggleResult> {
  console.log('\n🧪 Test 1: Rapid checkbox toggling');
  console.log('─'.repeat(60));

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const testPR = process.env.TEST_PR_URL || 'https://github.com/compio-rs/compio/pull/417';
  const filesUrl = testPR.endsWith('/files') ? testPR : `${testPR}/files`;

  // Get expected stats from API
  const prMatch = testPR.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!prMatch) throw new Error('Invalid PR URL');
  const [, owner, repo, prNumber] = prMatch;

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`;
  const apiResponse = await fetch(apiUrl);
  const files = await apiResponse.json();
  const expectedStats = files.reduce(
    (acc: ExtensionStats, f: any) => ({
      added: acc.added + f.additions,
      removed: acc.removed + f.deletions,
    }),
    { added: 0, removed: 0 }
  );

  console.log(`   Loading: ${filesUrl}`);
  await page.goto(filesUrl, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait for initial analysis
  await page.waitForSelector('#pr-language-stats-panel table', { timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Get initial stats
  const initialStats = await page.evaluate((): ExtensionStats | null => {
    const panel = document.querySelector('#pr-language-stats-panel');
    const totalRow = panel?.querySelector('.total-row');
    if (!totalRow) return null;
    return {
      added: parseInt(
        totalRow.querySelector('.language-added')?.textContent?.replace(/[+]/g, '') || '0'
      ),
      removed: parseInt(
        totalRow.querySelector('.language-removed')?.textContent?.replace(/[-]/g, '') || '0'
      ),
    };
  });
  console.log(`   Initial stats: +${initialStats?.added} -${initialStats?.removed}`);

  // Set up stats observer
  await page.evaluate(() => {
    (window as any).__statsSnapshots = [];

    const observer = new MutationObserver(() => {
      const panel = document.querySelector('#pr-language-stats-panel');
      const totalRow = panel?.querySelector('.total-row');
      const checkbox = document.querySelector(
        '#exclude-generated-checkbox'
      ) as HTMLInputElement | null;

      if (totalRow) {
        (window as any).__statsSnapshots.push({
          timestamp: Date.now(),
          stats: {
            added: parseInt(
              totalRow.querySelector('.language-added')?.textContent?.replace(/[+]/g, '') || '0'
            ),
            removed: parseInt(
              totalRow.querySelector('.language-removed')?.textContent?.replace(/[-]/g, '') || '0'
            ),
          },
          checkboxState: checkbox?.checked || false,
        });
      }
    });

    const panel = document.querySelector('#pr-language-stats-panel');
    if (panel) {
      observer.observe(panel, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    (window as any).__stopStatsObserver = () => observer.disconnect();
  });

  // Rapidly toggle checkbox 10 times with minimal delay
  console.log('   Rapidly toggling checkbox 10 times...');
  for (let i = 0; i < 10; i++) {
    await page.click('#exclude-generated-checkbox');
    // Minimal delay - we want to trigger race conditions
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Wait for all analyses to complete
  console.log('   Waiting for analyses to complete...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Collect snapshots
  const snapshots: StatsSnapshot[] = await page.evaluate(() => {
    (window as any).__stopStatsObserver();
    return (window as any).__statsSnapshots;
  });

  // Get final stats
  const finalStats = await page.evaluate((): ExtensionStats | null => {
    const panel = document.querySelector('#pr-language-stats-panel');
    const totalRow = panel?.querySelector('.total-row');
    if (!totalRow) return null;
    return {
      added: parseInt(
        totalRow.querySelector('.language-added')?.textContent?.replace(/[+]/g, '') || '0'
      ),
      removed: parseInt(
        totalRow.querySelector('.language-removed')?.textContent?.replace(/[-]/g, '') || '0'
      ),
    };
  });

  console.log(`   Final stats: +${finalStats?.added} -${finalStats?.removed}`);
  console.log(`   Stats snapshots captured: ${snapshots.length}`);

  // Analyze snapshots for race conditions
  let raceConditionDetected = false;
  const unexpectedValues: StatsSnapshot[] = [];

  for (const snapshot of snapshots) {
    // With checkbox unchecked, should match expectedStats
    // With checkbox checked, may differ (excluding generated files)
    // But should never have completely wrong values
    if (snapshot.stats) {
      const isWildlyOff =
        Math.abs(snapshot.stats.added - expectedStats.added) > expectedStats.added * 0.5 ||
        Math.abs(snapshot.stats.removed - expectedStats.removed) > expectedStats.removed * 0.5;

      if (isWildlyOff && !snapshot.checkboxState) {
        unexpectedValues.push(snapshot);
        raceConditionDetected = true;
      }
    }
  }

  if (raceConditionDetected) {
    console.log(`\n   ❌ RACE CONDITION DETECTED!`);
    console.log(`   Unexpected values found:`, unexpectedValues);
  }

  // Check final consistency
  const consistent =
    finalStats?.added === expectedStats.added && finalStats?.removed === expectedStats.removed;
  console.log(`\n   Final stats match expected: ${consistent ? '✅' : '❌'}`);

  await page.close();

  return {
    initialStats,
    snapshots,
    finalStats,
    expectedStats,
    consistent,
    raceConditionDetected,
  };
}

/**
 * Test 2: Double-click race condition
 */
async function testDoubleClickRace(browser: Browser): Promise<{
  firstStats: ExtensionStats | null;
  secondStats: ExtensionStats | null;
  consistent: boolean;
}> {
  console.log('\n🧪 Test 2: Double-click race condition');
  console.log('─'.repeat(60));

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const testPR = process.env.TEST_PR_URL || 'https://github.com/compio-rs/compio/pull/417';
  const filesUrl = testPR.endsWith('/files') ? testPR : `${testPR}/files`;

  await page.goto(filesUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('#pr-language-stats-panel table', { timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Get stats before double-click
  const firstStats = await page.evaluate((): ExtensionStats | null => {
    const panel = document.querySelector('#pr-language-stats-panel');
    const totalRow = panel?.querySelector('.total-row');
    if (!totalRow) return null;
    return {
      added: parseInt(
        totalRow.querySelector('.language-added')?.textContent?.replace(/[+]/g, '') || '0'
      ),
      removed: parseInt(
        totalRow.querySelector('.language-removed')?.textContent?.replace(/[-]/g, '') || '0'
      ),
    };
  });

  console.log(`   Stats before: +${firstStats?.added} -${firstStats?.removed}`);

  // Simulate double-click on checkbox (two rapid clicks)
  console.log('   Simulating double-click on checkbox...');
  await page.evaluate(() => {
    const checkbox = document.querySelector('#exclude-generated-checkbox') as HTMLInputElement;
    if (checkbox) {
      // Two clicks in rapid succession
      checkbox.click();
      checkbox.click();
    }
  });

  // Wait for analyses
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Get stats after
  const secondStats = await page.evaluate((): ExtensionStats | null => {
    const panel = document.querySelector('#pr-language-stats-panel');
    const totalRow = panel?.querySelector('.total-row');
    if (!totalRow) return null;
    return {
      added: parseInt(
        totalRow.querySelector('.language-added')?.textContent?.replace(/[+]/g, '') || '0'
      ),
      removed: parseInt(
        totalRow.querySelector('.language-removed')?.textContent?.replace(/[-]/g, '') || '0'
      ),
    };
  });

  console.log(`   Stats after: +${secondStats?.added} -${secondStats?.removed}`);

  // Should be the same (double-click = no net change in checkbox state)
  const consistent =
    firstStats?.added === secondStats?.added && firstStats?.removed === secondStats?.removed;
  console.log(`   Stats consistent after double-click: ${consistent ? '✅' : '❌'}`);

  await page.close();

  return { firstStats, secondStats, consistent };
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  console.log('🔬 Concurrent analyze() Calls Tests');
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
    const rapidToggleResult = await testRapidCheckboxToggle(browser);
    const doubleClickResult = await testDoubleClickRace(browser);

    const results = {
      rapidToggle: rapidToggleResult,
      doubleClick: doubleClickResult,
    };

    // Write results to file
    const resultsFile = join(resultsDir, 'concurrent-analyze-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n📁 Results saved to: ${resultsFile}`);

    // Summary
    console.log('\n📋 CONCURRENT ANALYZE TEST SUMMARY');
    console.log('═'.repeat(60));

    if (rapidToggleResult.raceConditionDetected) {
      console.log('❌ RACE CONDITION DETECTED during rapid checkbox toggling');
      console.log('   Recommendation: Add mutex/debounce to analyze() calls');
    } else if (!rapidToggleResult.consistent || !doubleClickResult.consistent) {
      console.log('⚠️  POSSIBLE ISSUE: Stats inconsistent after rapid interactions');
    } else {
      console.log('✅ No concurrent analyze() issues detected');
    }
  } finally {
    await browser.close();
  }
}

runTests().catch(console.error);
