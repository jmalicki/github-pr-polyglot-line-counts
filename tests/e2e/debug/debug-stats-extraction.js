#!/usr/bin/env node

/**
 * Debug script to see what stats are available in the DOM
 */

import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionPath = join(__dirname, '..', '..');

async function debugStats() {
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
  await page.goto('https://github.com/jmalicki/arsync/pull/55/files', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  await page.waitForSelector('[data-details-container-group="file"]', { timeout: 15000 });

  const statsInfo = await page.evaluate(() => {
    const containers = document.querySelectorAll('[data-details-container-group="file"]');
    const results = [];

    containers.forEach((container, i) => {
      const text = container.textContent;
      const path = container.getAttribute('data-tagsearch-path') || 'unknown';

      // Try different text patterns
      const additionsMatch = text.match(/(\d+)\s+addition/);
      const deletionsMatch = text.match(/(\d+)\s+deletion/);
      const changesMatch = text.match(/(\d+)\s+changes:/);

      results.push({
        index: i,
        path,
        textPreview: text.substring(0, 150).replace(/\s+/g, ' '),
        additionsMatch: additionsMatch ? additionsMatch[0] : null,
        deletionsMatch: deletionsMatch ? deletionsMatch[0] : null,
        changesMatch: changesMatch ? changesMatch[0] : null,
        hasDiffbar: !!container.querySelector('.diffbar'),
        blobCodeCount: container.querySelectorAll('.blob-code').length,
      });
    });

    return results;
  });

  console.log('\n📊 Stats Extraction Analysis:\n');
  console.log(`Found ${statsInfo.length} file containers\n`);

  statsInfo.forEach(info => {
    console.log(`\n${info.index + 1}. ${info.path}`);
    console.log(`   Text: "${info.textPreview}..."`);
    console.log(`   Additions match: ${info.additionsMatch || 'NONE'}`);
    console.log(`   Deletions match: ${info.deletionsMatch || 'NONE'}`);
    console.log(`   Changes match: ${info.changesMatch || 'NONE'}`);
    console.log(`   Has diffbar: ${info.hasDiffbar}`);
    console.log(`   Blob code elements: ${info.blobCodeCount}`);
  });

  console.log('\n');

  if (process.env.DEBUG) {
    console.log('⏸️  Browser open for 30s...');
    await new Promise(resolve => setTimeout(resolve, 30000));
  }

  await browser.close();
}

debugStats().catch(console.error);
