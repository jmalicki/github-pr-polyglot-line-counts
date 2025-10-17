#!/usr/bin/env node

/**
 * DOM Snapshot Timeline - Captures BOTH screenshots AND DOM state every 100ms
 * to catch the exact moment of weird behavior
 */

import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionPath = join(__dirname, '..', '..');
const snapshotDir = join(__dirname, '..', 'screenshots', 'dom-snapshots');

if (!fs.existsSync(snapshotDir)) {
  fs.mkdirSync(snapshotDir, { recursive: true });
}

async function captureDOMTimeline() {
  console.log('🎬 DOM Snapshot Timeline Test - Capturing every 100ms...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const snapshots = [];
  let counter = 0;

  // Function to capture both screenshot AND DOM state
  const captureSnapshot = async (label) => {
    counter++;
    const timestamp = Date.now();
    const id = String(counter).padStart(3, '0');
    
    // Capture DOM state
    const domState = await page.evaluate(() => {
      const panel = document.getElementById('pr-language-stats-panel');
      
      if (!panel) {
        return { exists: false };
      }
      
      return {
        exists: true,
        innerHTML: panel.innerHTML,
        opacity: window.getComputedStyle(panel).opacity,
        visibility: window.getComputedStyle(panel).visibility,
        display: window.getComputedStyle(panel).display,
        offsetHeight: panel.offsetHeight,
        scrollTop: window.scrollY,
        classList: Array.from(panel.classList),
        // Extract table data
        tableRows: Array.from(panel.querySelectorAll('tr')).map(row => 
          Array.from(row.querySelectorAll('td')).map(cell => cell.textContent.trim()).join(' | ')
        )
      };
    });
    
    // Take screenshot
    const screenshotPath = join(snapshotDir, `${id}-${label}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    
    // Save DOM state to JSON
    const domStatePath = join(snapshotDir, `${id}-${label}.json`);
    fs.writeFileSync(domStatePath, JSON.stringify(domState, null, 2));
    
    const snapshot = {
      id: counter,
      label,
      timestamp,
      timeSinceStart: snapshots.length > 0 ? timestamp - snapshots[0].timestamp : 0,
      domState,
      screenshotPath,
      domStatePath
    };
    
    snapshots.push(snapshot);
    
    // Log concise status
    if (!domState.exists) {
      console.log(`${id}. [${snapshot.timeSinceStart}ms] ${label}: ❌ NO PANEL`);
    } else if (domState.opacity === '0') {
      console.log(`${id}. [${snapshot.timeSinceStart}ms] ${label}: 👻 HIDDEN (opacity: 0)`);
    } else if (domState.tableRows.length === 0) {
      console.log(`${id}. [${snapshot.timeSinceStart}ms] ${label}: 📭 EMPTY`);
    } else {
      const rowCount = domState.tableRows.length;
      console.log(`${id}. [${snapshot.timeSinceStart}ms] ${label}: ✅ ${rowCount} rows`);
    }
    
    return snapshot;
  };

  // Start timeline
  console.log('📄 Navigating to PR...\n');
  await page.goto('https://github.com/jmalicki/arsync/pull/55/files', { 
    waitUntil: 'domcontentloaded',
    timeout: 30000 
  });

  await captureSnapshot('nav-complete');

  // Capture every 10ms for 3 seconds (300 snapshots)
  console.log('\n⏱️  Capturing every 10ms for 3 seconds...\n');
  
  for (let i = 0; i < 300; i++) {
    await new Promise(resolve => setTimeout(resolve, 10));
    await captureSnapshot(`t${String(i * 10).padStart(4, '0')}ms`);
  }

  // Analyze the snapshots to find state changes
  console.log('\n\n🔍 Analyzing State Changes:\n');
  console.log('═'.repeat(70));
  
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    
    // Check for state changes
    const changes = [];
    
    if (prev.domState.exists !== curr.domState.exists) {
      changes.push(curr.domState.exists ? '🟢 Panel appeared' : '🔴 Panel disappeared');
    }
    
    if (prev.domState.exists && curr.domState.exists) {
      if (prev.domState.opacity !== curr.domState.opacity) {
        changes.push(`Opacity: ${prev.domState.opacity} → ${curr.domState.opacity}`);
      }
      
      if (prev.domState.tableRows?.length !== curr.domState.tableRows?.length) {
        changes.push(`Rows: ${prev.domState.tableRows?.length || 0} → ${curr.domState.tableRows?.length || 0}`);
      }
      
      if (prev.domState.innerHTML !== curr.domState.innerHTML) {
        changes.push('📝 Content changed');
      }
    }
    
    if (changes.length > 0) {
      console.log(`\n⚡ Change at ${curr.timeSinceStart}ms (${curr.label}):`);
      changes.forEach(change => console.log(`   ${change}`));
    }
  }

  console.log(`\n\n📁 All snapshots saved to: ${snapshotDir}`);
  console.log('   - .png files = screenshots');
  console.log('   - .json files = DOM state at that moment\n');

  await browser.close();
}

captureDOMTimeline().catch(console.error);

