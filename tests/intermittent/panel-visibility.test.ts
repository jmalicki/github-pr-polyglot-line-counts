#!/usr/bin/env tsx

/**
 * Panel Visibility Test (Main Issue)
 *
 * SYMPTOM: The panel only appears ~20% of the time.
 *
 * HYPOTHESIS:
 * The initialization flow has a timing-dependent failure:
 * 1. Skeleton injection fails to find PR header
 * 2. waitForPRPage() times out or finds wrong elements
 * 3. analyzeViaAPI() silently fails
 * 4. displayStats() can't find insertion point
 *
 * TEST APPROACH:
 * 1. Run multiple iterations and track success rate
 * 2. Capture detailed logs at each initialization stage
 * 3. Identify which stage fails most often
 */

import puppeteer, { Browser, ConsoleMessage } from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { getFilesUrl, getPanelState } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionPath = join(__dirname, '..', '..');
const resultsDir = join(__dirname, 'results');

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

interface InitStage {
  skeletonInjected: boolean;
  earlyFetchStarted: boolean;
  waitForPRPageCompleted: boolean;
  analyzeStarted: boolean;
  analyzeCompleted: boolean;
  displayStatsCalled: boolean;
  panelVisible: boolean;
  hasTable: boolean;
  hasError: boolean;
  errorMessage?: string;
}

interface IterationResult {
  iteration: number;
  success: boolean;
  panelFound: boolean;
  hasStats: boolean;
  stages: InitStage;
  consoleLogs: string[];
  loadTimeMs: number;
  selectors: {
    prHeaderFound: boolean;
    fileContainersCount: number;
    diffContainerFound: boolean;
  };
}

async function runSingleIteration(
  browser: Browser,
  iteration: number,
  testPR: string
): Promise<IterationResult> {
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1920, height: 1080 });

    const consoleLogs: string[] = [];
    page.on('console', (msg: ConsoleMessage) => {
      const text = msg.text();
      if (text.includes('PR Lang Stats')) {
        consoleLogs.push(text);
      }
    });

    const filesUrl = getFilesUrl(testPR);
    const startTime = Date.now();

    try {
      await page.goto(filesUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch {
      console.log(`   Iteration ${iteration}: Navigation timeout`);
    }

    // Wait a bit for extension to initialize
    await new Promise(resolve => setTimeout(resolve, 5000));

    const loadTimeMs = Date.now() - startTime;

    // Check what selectors are present
    const selectors = await page.evaluate(() => {
      return {
        prHeaderFound: !!document.querySelector('.gh-header-meta, [data-hpc]'),
        fileContainersCount: document.querySelectorAll('[data-details-container-group="file"]')
          .length,
        diffContainerFound: !!document.querySelector(
          '.diff-view, .js-diff-progressive-container, [data-hpc], .file-header, .file'
        ),
      };
    });

    // Check panel state using shared utility
    const panelState = await getPanelState(page);

    // Analyze console logs to determine which stages completed
    const stages: InitStage = {
      skeletonInjected: consoleLogs.some(log => log.includes('Skeleton placeholder injected')),
      earlyFetchStarted: consoleLogs.some(log => log.includes('Starting early API fetch')),
      waitForPRPageCompleted:
        consoleLogs.some(log => log.includes('file containers (stable)')) ||
        consoleLogs.some(log => log.includes('PR page detected (fallback selector)')) ||
        consoleLogs.some(log => log.includes('Timeout waiting for stable file count')),
      analyzeStarted: consoleLogs.some(log => log.includes('ANALYZE START')),
      analyzeCompleted:
        consoleLogs.some(log => log.includes('ANALYZE COMPLETE')) ||
        consoleLogs.some(log => log.includes('Showing error')),
      displayStatsCalled: consoleLogs.some(log => log.includes('displayStats() called')),
      panelVisible: panelState.panelFound,
      hasTable: panelState.hasTable,
      hasError: panelState.hasError,
      errorMessage: panelState.errorMessage,
    };

    const success = panelState.panelFound && !!panelState.stats;

    return {
      iteration,
      success,
      panelFound: panelState.panelFound,
      hasStats: !!panelState.stats,
      stages,
      consoleLogs,
      loadTimeMs,
      selectors,
    };
  } finally {
    await page.close();
  }
}

async function testPanelVisibility(iterations = 10): Promise<void> {
  console.log(`\n🧪 Panel Visibility Test (${iterations} iterations)`);
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

  const testPR = process.env.TEST_PR_URL || 'https://github.com/compio-rs/compio/pull/417';
  console.log(`   Testing PR: ${testPR}\n`);

  const results: IterationResult[] = [];
  const stageFailures: Record<string, number> = {
    skeletonInjected: 0,
    earlyFetchStarted: 0,
    waitForPRPageCompleted: 0,
    analyzeStarted: 0,
    analyzeCompleted: 0,
    displayStatsCalled: 0,
    panelVisible: 0,
    hasTable: 0,
  };

  try {
    for (let i = 1; i <= iterations; i++) {
      const result = await runSingleIteration(browser, i, testPR);
      results.push(result);

      const status = result.success ? '✅' : '❌';
      const details = [];

      if (!result.stages.skeletonInjected) details.push('no skeleton');
      if (!result.stages.waitForPRPageCompleted) details.push('waitForPR failed');
      if (!result.stages.analyzeCompleted) details.push('analyze failed');
      if (!result.panelFound) details.push('no panel');
      if (result.panelFound && !result.hasStats) details.push('no stats');
      if (result.stages.hasError) details.push(`error: ${result.stages.errorMessage}`);

      console.log(
        `   ${status} Iteration ${i}: ${result.success ? 'OK' : details.join(', ')} (${result.loadTimeMs}ms)`
      );

      // Track failures
      for (const [stage, completed] of Object.entries(result.stages)) {
        if (typeof completed === 'boolean' && !completed && stage in stageFailures) {
          stageFailures[stage]++;
        }
      }

      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    const successCount = results.filter(r => r.success).length;
    const successRate = ((successCount / iterations) * 100).toFixed(1);

    console.log('\n' + '─'.repeat(60));
    console.log(`📊 RESULTS: ${successCount}/${iterations} successful (${successRate}%)`);
    console.log('─'.repeat(60));

    // Stage failure analysis
    console.log('\n📋 STAGE FAILURE ANALYSIS:');
    const sortedFailures = Object.entries(stageFailures)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    if (sortedFailures.length === 0) {
      console.log('   All stages completed in all iterations');
    } else {
      for (const [stage, count] of sortedFailures) {
        const pct = ((count / iterations) * 100).toFixed(0);
        console.log(`   ${stage}: failed ${count}/${iterations} times (${pct}%)`);
      }
    }

    // Selector analysis for failed runs
    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
      console.log('\n📋 FAILED RUNS - SELECTOR STATE:');
      for (const failed of failedResults.slice(0, 5)) {
        // Show first 5
        console.log(`   Iteration ${failed.iteration}:`);
        console.log(`     - PR header found: ${failed.selectors.prHeaderFound}`);
        console.log(`     - File containers: ${failed.selectors.fileContainersCount}`);
        console.log(`     - Diff container found: ${failed.selectors.diffContainerFound}`);
      }
    }

    // Save detailed results
    const resultsFile = join(resultsDir, 'panel-visibility-results.json');
    fs.writeFileSync(
      resultsFile,
      JSON.stringify(
        {
          testPR,
          iterations,
          successRate: parseFloat(successRate),
          stageFailures,
          results,
        },
        null,
        2
      )
    );
    console.log(`\n📁 Detailed results saved to: ${resultsFile}`);

    // Diagnosis
    console.log('\n🔍 DIAGNOSIS:');
    if (stageFailures.skeletonInjected > iterations * 0.5) {
      console.log('   ❌ SKELETON INJECTION FAILING - PR header selector not found');
      console.log('      Check: .gh-header-meta, [data-hpc] selectors');
    }
    if (stageFailures.waitForPRPageCompleted > iterations * 0.5) {
      console.log('   ❌ WAIT FOR PR PAGE FAILING - File containers not found');
      console.log('      Check: [data-details-container-group="file"] selector');
    }
    if (stageFailures.analyzeCompleted > iterations * 0.5) {
      console.log('   ❌ ANALYZE FAILING - API or DOM analysis not completing');
    }
    if (stageFailures.panelVisible > iterations * 0.5) {
      console.log('   ❌ PANEL NOT VISIBLE - displayStats() not finding insertion point');
    }

    if (parseFloat(successRate) < 50) {
      console.log('\n   🚨 SUCCESS RATE BELOW 50% - SIGNIFICANT ISSUE DETECTED');
    }
  } finally {
    await browser.close();
  }
}

// Run with more iterations to get statistical significance
const iterationCount = parseInt(process.env.ITERATIONS || '10', 10);
testPanelVisibility(iterationCount).catch(console.error);
