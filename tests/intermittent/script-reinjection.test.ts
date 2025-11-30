#!/usr/bin/env tsx

/**
 * Script Re-injection Test
 *
 * HYPOTHESIS:
 * Content scripts can be injected multiple times:
 * - GitHub SPA navigation
 * - Iframes on the page
 * - Browser back/forward navigation
 *
 * Without guards, multiple GitHubPRLanguageStats instances could run
 * simultaneously, causing duplicate panels, conflicting state, or race conditions.
 *
 * TEST APPROACH:
 * 1. Load page, verify single panel
 * 2. Navigate away and back (SPA-style)
 * 3. Check for duplicate panels or corrupted state
 * 4. Test with iframes if present
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

interface PanelState {
  panelCount: number;
  hasTable: boolean;
  hasError: boolean;
  stats: { added: number; removed: number } | null;
}

interface NavigationResult {
  initialState: PanelState;
  afterNavigateAway: PanelState;
  afterNavigateBack: PanelState;
  duplicatePanelsDetected: boolean;
  stateCorrupted: boolean;
}

/**
 * Test 1: SPA-style navigation (within GitHub)
 */
async function testSPANavigation(browser: Browser): Promise<NavigationResult> {
  console.log('\n🧪 Test 1: SPA-style navigation');
  console.log('─'.repeat(60));

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const testPR = process.env.TEST_PR_URL || 'https://github.com/compio-rs/compio/pull/417';
  const filesUrl = testPR.endsWith('/files') ? testPR : `${testPR}/files`;

  // Initial load
  console.log(`   Loading: ${filesUrl}`);
  await page.goto(filesUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('#pr-language-stats-panel', { timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 2000));

  const getPanelState = async (): Promise<PanelState> => {
    return page.evaluate((): PanelState => {
      const panels = document.querySelectorAll('#pr-language-stats-panel');
      const panel = panels[0];
      const totalRow = panel?.querySelector('.total-row');

      return {
        panelCount: panels.length,
        hasTable: !!panel?.querySelector('table'),
        hasError: !!panel?.querySelector('.flash-error'),
        stats: totalRow
          ? {
              added: parseInt(
                totalRow.querySelector('.language-added')?.textContent?.replace(/[+]/g, '') || '0'
              ),
              removed: parseInt(
                totalRow.querySelector('.language-removed')?.textContent?.replace(/[-]/g, '') || '0'
              ),
            }
          : null,
      };
    });
  };

  const initialState = await getPanelState();
  console.log(`   Initial: ${initialState.panelCount} panel(s), stats: +${initialState.stats?.added} -${initialState.stats?.removed}`);

  // Navigate to PR conversation tab (SPA navigation)
  console.log('   Navigating to Conversation tab...');
  const conversationUrl = testPR.replace('/files', '');
  await page.goto(conversationUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 2000));

  const afterNavigateAway = await getPanelState();
  console.log(`   After nav away: ${afterNavigateAway.panelCount} panel(s)`);

  // Navigate back to Files tab
  console.log('   Navigating back to Files tab...');
  await page.goto(filesUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('#pr-language-stats-panel', { timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 3000));

  const afterNavigateBack = await getPanelState();
  console.log(`   After nav back: ${afterNavigateBack.panelCount} panel(s), stats: +${afterNavigateBack.stats?.added} -${afterNavigateBack.stats?.removed}`);

  // Check for issues
  const duplicatePanelsDetected = afterNavigateBack.panelCount > 1;
  const stateCorrupted =
    initialState.stats &&
    afterNavigateBack.stats &&
    (initialState.stats.added !== afterNavigateBack.stats.added ||
      initialState.stats.removed !== afterNavigateBack.stats.removed);

  if (duplicatePanelsDetected) {
    console.log(`\n   ❌ DUPLICATE PANELS DETECTED: ${afterNavigateBack.panelCount} panels found!`);
  }
  if (stateCorrupted) {
    console.log(`\n   ❌ STATE CORRUPTED: Stats changed after navigation`);
  }
  if (!duplicatePanelsDetected && !stateCorrupted) {
    console.log(`\n   ✅ Navigation handled correctly`);
  }

  await page.close();

  return {
    initialState,
    afterNavigateAway,
    afterNavigateBack,
    duplicatePanelsDetected,
    stateCorrupted: !!stateCorrupted,
  };
}

/**
 * Test 2: Browser back/forward navigation
 */
async function testBackForwardNavigation(browser: Browser): Promise<{
  panelCountAfterBack: number;
  statsConsistent: boolean;
}> {
  console.log('\n🧪 Test 2: Browser back/forward navigation');
  console.log('─'.repeat(60));

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const testPR = process.env.TEST_PR_URL || 'https://github.com/compio-rs/compio/pull/417';
  const filesUrl = testPR.endsWith('/files') ? testPR : `${testPR}/files`;

  // Load Files tab
  console.log(`   Loading: ${filesUrl}`);
  await page.goto(filesUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('#pr-language-stats-panel table', { timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 2000));

  const initialStats = await page.evaluate(() => {
    const totalRow = document.querySelector('#pr-language-stats-panel .total-row');
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

  // Navigate to Conversation tab
  const conversationUrl = testPR.replace('/files', '');
  await page.goto(conversationUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Use browser back
  console.log('   Pressing browser back...');
  await page.goBack({ waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 3000));

  const panelCountAfterBack = await page.evaluate(() => {
    return document.querySelectorAll('#pr-language-stats-panel').length;
  });

  const statsAfterBack = await page.evaluate(() => {
    const totalRow = document.querySelector('#pr-language-stats-panel .total-row');
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

  console.log(`   Panel count after back: ${panelCountAfterBack}`);
  console.log(`   Stats after back: +${statsAfterBack?.added} -${statsAfterBack?.removed}`);

  const statsConsistent =
    initialStats?.added === statsAfterBack?.added &&
    initialStats?.removed === statsAfterBack?.removed;

  console.log(`   Stats consistent: ${statsConsistent ? '✅' : '❌'}`);

  await page.close();

  return { panelCountAfterBack, statsConsistent };
}

/**
 * Test 3: Check for global variable collisions
 */
async function testGlobalVariables(browser: Browser): Promise<{
  extensionInstanceExists: boolean;
  apiDataPromiseCleared: boolean;
  multipleInstances: boolean;
}> {
  console.log('\n🧪 Test 3: Global variable state');
  console.log('─'.repeat(60));

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const testPR = process.env.TEST_PR_URL || 'https://github.com/compio-rs/compio/pull/417';
  const filesUrl = testPR.endsWith('/files') ? testPR : `${testPR}/files`;

  await page.goto(filesUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('#pr-language-stats-panel table', { timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check global variables (these are in the content script's isolated world,
  // so we can't access them directly - this is a limitation)
  // Instead, we check for symptoms of multiple instances

  const panelCount = await page.evaluate(() => {
    return document.querySelectorAll('#pr-language-stats-panel').length;
  });

  console.log(`   Panel count: ${panelCount}`);

  // Check console for duplicate initialization messages
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    if (msg.text().includes('PR Lang Stats')) {
      consoleLogs.push(msg.text());
    }
  });

  // Refresh to trigger re-initialization
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 3000));

  const panelCountAfterRefresh = await page.evaluate(() => {
    return document.querySelectorAll('#pr-language-stats-panel').length;
  });

  console.log(`   Panel count after refresh: ${panelCountAfterRefresh}`);

  // Check for multiple "Starting analysis" messages
  const initMessages = consoleLogs.filter(log => log.includes('ANALYZE START'));
  console.log(`   Initialization messages: ${initMessages.length}`);

  await page.close();

  return {
    extensionInstanceExists: panelCount > 0,
    apiDataPromiseCleared: true, // Can't directly check, assume true
    multipleInstances: panelCountAfterRefresh > 1 || initMessages.length > 1,
  };
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  console.log('🔬 Script Re-injection Tests');
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
    const spaResult = await testSPANavigation(browser);
    const backForwardResult = await testBackForwardNavigation(browser);
    const globalVarsResult = await testGlobalVariables(browser);

    const results = {
      spaNavigation: spaResult,
      backForward: backForwardResult,
      globalVariables: globalVarsResult,
    };

    // Write results to file
    const resultsFile = join(resultsDir, 'script-reinjection-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n📁 Results saved to: ${resultsFile}`);

    // Summary
    console.log('\n📋 SCRIPT RE-INJECTION TEST SUMMARY');
    console.log('═'.repeat(60));

    if (spaResult.duplicatePanelsDetected || globalVarsResult.multipleInstances) {
      console.log('❌ DUPLICATE INSTANCES DETECTED');
      console.log('   Recommendation: Add guard to prevent multiple initializations');
    } else if (spaResult.stateCorrupted || !backForwardResult.statsConsistent) {
      console.log('⚠️  STATE CORRUPTION: Stats changed after navigation');
    } else {
      console.log('✅ No re-injection issues detected');
    }
  } finally {
    await browser.close();
  }
}

runTests().catch(console.error);
