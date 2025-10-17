#!/usr/bin/env node

/**
 * Debug script to understand GitHub's DOM structure
 */

import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionPath = join(__dirname, '..', '..');

async function debugDOM() {
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
  await page.goto('https://github.com/jmalicki/arsync/pull/55/files', { 
    waitUntil: 'networkidle2', 
    timeout: 30000 
  });

  await page.waitForSelector('[data-tagsearch-path]', { timeout: 15000 });

  const domInfo = await page.evaluate(() => {
    const results = {
      treeItems: [],
      diffContainers: [],
      fileHeaders: []
    };

    // Check tree items (sidebar)
    const treeItems = document.querySelectorAll('[data-tagsearch-path]');
    treeItems.forEach((item, i) => {
      if (i < 3) { // First 3 for brevity
        results.treeItems.push({
          path: item.getAttribute('data-tagsearch-path'),
          hasStats: !!item.querySelector('.diffbar'),
          hasBlobCode: !!item.querySelector('.blob-code'),
          textContent: item.textContent.trim().substring(0, 100),
          dataAttrs: Array.from(item.attributes)
            .filter(a => a.name.startsWith('data-'))
            .map(a => `${a.name}="${a.value}"`)
        });
      }
    });

    // Check actual diff containers
    const diffContainers = document.querySelectorAll('.file');
    diffContainers.forEach((container, i) => {
      if (i < 3) {
        const header = container.querySelector('.file-header');
        const diffbar = container.querySelector('.diffbar');
        const blobCodes = container.querySelectorAll('.blob-code-addition, .blob-code-deletion');
        
        results.diffContainers.push({
          hasHeader: !!header,
          hasDiffbar: !!diffbar,
          blobCodeCount: blobCodes.length,
          diffbarText: diffbar?.textContent.trim() || 'none',
          headerText: header?.textContent.trim().substring(0, 100) || 'none'
        });
      }
    });

    // Check file headers
    const headers = document.querySelectorAll('.file-header, .file-info');
    results.fileHeaderCount = headers.length;

    return results;
  });

  console.log('\n📋 DOM Structure Analysis:\n');
  
  console.log('🗂️  Tree Items (sidebar navigation):');
  console.log('─'.repeat(60));
  domInfo.treeItems.forEach((item, i) => {
    console.log(`\nItem ${i + 1}: ${item.path}`);
    console.log(`  Has .diffbar: ${item.hasStats}`);
    console.log(`  Has .blob-code: ${item.hasBlobCode}`);
    console.log(`  Data attrs: ${item.dataAttrs.slice(0, 3).join(', ')}`);
    console.log(`  Text preview: "${item.textContent.substring(0, 50)}..."`);
  });

  console.log('\n\n📄 Diff Containers (actual file diffs):');
  console.log('─'.repeat(60));
  domInfo.diffContainers.forEach((container, i) => {
    console.log(`\nContainer ${i + 1}:`);
    console.log(`  Has file-header: ${container.hasHeader}`);
    console.log(`  Has diffbar: ${container.hasDiffbar}`);
    console.log(`  Blob code lines: ${container.blobCodeCount}`);
    console.log(`  Diffbar text: "${container.diffbarText}"`);
    console.log(`  Header preview: "${container.headerText.substring(0, 50)}..."`);
  });

  console.log(`\n\n📊 Summary:`);
  console.log(`  Tree items: ${domInfo.treeItems.length} (found)`);
  console.log(`  Diff containers: ${domInfo.diffContainers.length} (found)`);
  console.log(`  File headers: ${domInfo.fileHeaderCount}`);

  console.log('\n\n💡 Analysis:');
  console.log('  - Tree items = navigation sidebar (no stats here)');
  console.log('  - Diff containers = actual file content with stats');
  console.log('  - Need to match tree items to diff containers by filename\n');

  if (process.env.DEBUG) {
    console.log('\n⏸️  Browser open for 30s for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  
  await browser.close();
}

debugDOM().catch(console.error);

