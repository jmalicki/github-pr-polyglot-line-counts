#!/usr/bin/env node

/**
 * Visual Timeline Test - Captures screenshots at each render stage
 * to debug the weird behavior (blank, paint, blank, paint, disappear, reappear)
 */

import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionPath = join(__dirname, '..', '..');
const timelineDir = join(__dirname, '..', 'screenshots', 'timeline');

import fs from 'fs';
if (!fs.existsSync(timelineDir)) {
  fs.mkdirSync(timelineDir, { recursive: true });
}

async function captureVisualTimeline() {
  console.log('🎬 Starting Visual Timeline Test...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--window-size=1920,1080',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  let screenshotCounter = 0;
  const screenshots = [];

  // Helper to take timestamped screenshot
  const capture = async label => {
    screenshotCounter++;
    const timestamp = Date.now();
    const filename = `${String(screenshotCounter).padStart(2, '0')}-${label}-${timestamp}.png`;
    const path = join(timelineDir, filename);

    await page.screenshot({ path, fullPage: false });

    const logEntry = {
      step: screenshotCounter,
      label,
      timestamp,
      filename,
    };
    screenshots.push(logEntry);

    console.log(`📸 ${screenshotCounter}. ${label} (${path})`);
    return logEntry;
  };

  // Listen to console logs from the extension
  const extensionLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[PR Lang Stats]')) {
      extensionLogs.push({
        timestamp: Date.now(),
        text,
      });
      console.log(`   🔍 Extension: ${text}`);
    }
  });

  // Capture initial state
  await capture('00-before-navigation');

  console.log('\n📄 Navigating to PR...');
  await page.goto('https://github.com/jmalicki/arsync/pull/55/files', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await capture('01-dom-loaded');

  // Wait for PR header
  await page.waitForSelector('.gh-header-meta, [data-hpc]', { timeout: 10000 });
  await capture('02-header-found');

  // Small delay to let skeleton inject
  await new Promise(resolve => setTimeout(resolve, 100));
  await capture('03-after-skeleton-time');

  // Check if panel exists
  let panelExists = await page.$('#pr-language-stats-panel');
  if (panelExists) {
    console.log('   ✅ Panel exists at this point');
    await capture('04-panel-exists');
  } else {
    console.log('   ❌ No panel yet');
  }

  // Wait for file containers
  await page.waitForSelector('[data-details-container-group="file"]', { timeout: 10000 });
  await capture('05-file-containers-loaded');

  // Capture at 500ms intervals to catch the weird behavior
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    await capture(`06-interval-${i}-at-${i * 500}ms`);

    // Check panel state
    const panelState = await page.evaluate(() => {
      const panel = document.getElementById('pr-language-stats-panel');
      if (!panel) return 'MISSING';

      const opacity = window.getComputedStyle(panel).opacity;
      const visibility = window.getComputedStyle(panel).visibility;
      const display = window.getComputedStyle(panel).display;
      const innerHTML = panel.innerHTML.substring(0, 100);

      return {
        opacity,
        visibility,
        display,
        hasContent: innerHTML.length > 50,
        contentPreview: innerHTML.replace(/\s+/g, ' '),
      };
    });

    if (panelState === 'MISSING') {
      console.log(`   ⚠️  Panel MISSING at ${i * 500}ms!`);
    } else if (panelState.opacity === '0') {
      console.log(`   👻 Panel invisible (opacity: 0) at ${i * 500}ms`);
    } else if (!panelState.hasContent) {
      console.log(`   📭 Panel empty at ${i * 500}ms`);
    } else {
      console.log(`   ✅ Panel visible with content at ${i * 500}ms`);
    }
  }

  // Final screenshot
  await capture('15-final-state');

  console.log('\n\n📊 Timeline Summary:');
  console.log('─'.repeat(70));
  screenshots.forEach(s => {
    console.log(`  ${s.step}. ${s.label}`);
  });

  console.log('\n\n📝 Extension Log Summary:');
  console.log('─'.repeat(70));
  extensionLogs.forEach((log, idx) => {
    console.log(`  ${idx + 1}. ${log.text}`);
  });

  console.log(`\n\n📁 Screenshots saved to: ${timelineDir}`);
  console.log('   Compare them to see exactly when things change!\n');

  if (process.env.DEBUG) {
    console.log('⏸️  Browser open for 30s...');
    await new Promise(resolve => setTimeout(resolve, 30000));
  }

  await browser.close();
}

captureVisualTimeline().catch(console.error);
