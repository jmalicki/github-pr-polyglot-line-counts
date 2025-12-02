#!/usr/bin/env tsx

/**
 * Panel Visibility Test (Main Issue)
 *
 * SYMPTOM: The panel only appears ~20% of the time.
 *
 * TEST APPROACH:
 * 1. Run multiple iterations and track success rate
 * 2. Record DOM state for debugging failed runs
 * 3. Fail CI if success rate is below threshold
 *
 * NOTE: We cannot track internal extension stages via console logs because
 * Chrome extension content scripts run in a sandboxed context that Puppeteer
 * cannot observe. We can only measure the final outcome (panel visible or not).
 */

import puppeteer, { Browser } from 'puppeteer';
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

// Minimum success rate required to pass CI (percentage)
const MIN_SUCCESS_RATE = 80;

interface IterationResult {
  iteration: number;
  success: boolean;
  panelFound: boolean;
  hasStats: boolean;
  hasError: boolean;
  errorMessage?: string;
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

    const filesUrl = getFilesUrl(testPR);
    const startTime = Date.now();

    try {
      await page.goto(filesUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch {
      console.log(`   Iteration ${iteration}: Navigation timeout`);
    }

    // Wait for extension to initialize
    await new Promise(resolve => setTimeout(resolve, 5000));

    const loadTimeMs = Date.now() - startTime;

    // Check what selectors are present (for debugging failed runs)
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
    const success = panelState.panelFound && !!panelState.stats;

    return {
      iteration,
      success,
      panelFound: panelState.panelFound,
      hasStats: !!panelState.stats,
      hasError: panelState.hasError,
      errorMessage: panelState.errorMessage,
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
  console.log(`   Testing PR: ${testPR}`);
  console.log(`   Minimum success rate: ${MIN_SUCCESS_RATE}%\n`);

  const results: IterationResult[] = [];

  try {
    for (let i = 1; i <= iterations; i++) {
      const result = await runSingleIteration(browser, i, testPR);
      results.push(result);

      const status = result.success ? '✅' : '❌';
      const details = [];

      if (!result.panelFound) details.push('no panel');
      if (result.panelFound && !result.hasStats) details.push('no stats');
      if (result.hasError) details.push(`error: ${result.errorMessage}`);

      console.log(
        `   ${status} Iteration ${i}: ${result.success ? 'OK' : details.join(', ')} (${result.loadTimeMs}ms)`
      );

      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    const successCount = results.filter(r => r.success).length;
    const successRate = (successCount / iterations) * 100;
    const successRateStr = successRate.toFixed(1);

    console.log('\n' + '─'.repeat(60));
    console.log(`📊 RESULTS: ${successCount}/${iterations} successful (${successRateStr}%)`);
    console.log('─'.repeat(60));

    // Selector analysis for failed runs
    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
      console.log('\n📋 FAILED RUNS - DOM STATE:');
      for (const failed of failedResults.slice(0, 5)) {
        // Show first 5
        console.log(`   Iteration ${failed.iteration}:`);
        console.log(`     - PR header found: ${failed.selectors.prHeaderFound}`);
        console.log(`     - File containers: ${failed.selectors.fileContainersCount}`);
        console.log(`     - Diff container found: ${failed.selectors.diffContainerFound}`);
        if (failed.hasError) {
          console.log(`     - Error: ${failed.errorMessage}`);
        }
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
          successRate,
          minSuccessRate: MIN_SUCCESS_RATE,
          passed: successRate >= MIN_SUCCESS_RATE,
          results,
        },
        null,
        2
      )
    );
    console.log(`\n📁 Detailed results saved to: ${resultsFile}`);

    // Final verdict
    if (successRate >= MIN_SUCCESS_RATE) {
      console.log(`\n✅ PASSED: Success rate ${successRateStr}% >= ${MIN_SUCCESS_RATE}% threshold`);
    } else {
      console.log(`\n❌ FAILED: Success rate ${successRateStr}% < ${MIN_SUCCESS_RATE}% threshold`);
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

// Run with more iterations to get statistical significance
const iterationCount = parseInt(process.env.ITERATIONS || '10', 10);
testPanelVisibility(iterationCount).catch(console.error);
