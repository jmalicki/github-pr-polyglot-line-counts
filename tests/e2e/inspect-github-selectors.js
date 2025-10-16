#!/usr/bin/env node

/**
 * GitHub Selector Inspector
 * 
 * This script inspects GitHub's PR page to find available ARIA labels,
 * roles, and data attributes that could be used for more reliable selectors.
 */

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionPath = join(__dirname, '..', '..');

async function inspectSelectors() {
  console.log('🔍 Inspecting GitHub PR selectors...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  const testPR = process.env.TEST_PR_URL || 'https://github.com/jmalicki/arsync/pull/55/files';
  
  console.log(`📄 Navigating to: ${testPR}\n`);
  await page.goto(testPR, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.file-header, [data-file-type]', { timeout: 15000 });

  // Extract all possible selectors
  const selectorInfo = await page.evaluate(() => {
    const results = {
      fileHeaders: [],
      diffContainers: [],
      ariaLabels: new Set(),
      roles: new Set(),
      dataAttributes: new Set()
    };

    // Inspect file headers
    const headers = document.querySelectorAll('.file-header, [data-file-type], .file-info');
    headers.forEach((header, index) => {
      const info = {
        index,
        tagName: header.tagName,
        classes: Array.from(header.classList),
        id: header.id,
        role: header.getAttribute('role'),
        ariaLabel: header.getAttribute('aria-label'),
        ariaDescribedBy: header.getAttribute('aria-describedby'),
        dataAttributes: {}
      };

      // Collect all data-* attributes
      Array.from(header.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) {
          info.dataAttributes[attr.name] = attr.value;
          results.dataAttributes.add(attr.name);
        }
        if (attr.name.startsWith('aria-')) {
          results.ariaLabels.add(attr.name);
        }
      });

      if (info.role) results.roles.add(info.role);
      
      // Try to get filename
      const titleEl = header.querySelector('[title]');
      const pathEl = header.querySelector('[data-path]');
      const copyEl = header.querySelector('clipboard-copy');
      
      info.filename = titleEl?.getAttribute('title') || 
                      pathEl?.getAttribute('data-path') || 
                      copyEl?.getAttribute('value') ||
                      'unknown';

      results.fileHeaders.push(info);
    });

    // Inspect diff containers
    const containers = document.querySelectorAll('.diff-view, .js-diff-progressive-container, [data-hpc]');
    containers.forEach((container, index) => {
      const info = {
        index,
        tagName: container.tagName,
        classes: Array.from(container.classList),
        role: container.getAttribute('role'),
        ariaLabel: container.getAttribute('aria-label'),
        dataAttributes: {}
      };

      Array.from(container.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) {
          info.dataAttributes[attr.name] = attr.value;
          results.dataAttributes.add(attr.name);
        }
      });

      if (info.role) results.roles.add(info.role);
      results.diffContainers.push(info);
    });

    // Look for any elements with navigation roles
    const navElements = document.querySelectorAll('[role="navigation"], [role="tab"], [role="tablist"]');
    navElements.forEach(el => {
      results.roles.add(el.getAttribute('role'));
      const label = el.getAttribute('aria-label');
      if (label) results.ariaLabels.add(`aria-label: ${label}`);
    });

    return {
      ...results,
      ariaLabels: Array.from(results.ariaLabels),
      roles: Array.from(results.roles),
      dataAttributes: Array.from(results.dataAttributes)
    };
  });

  console.log('📋 ARIA Labels found:');
  console.log('─'.repeat(60));
  if (selectorInfo.ariaLabels.length > 0) {
    selectorInfo.ariaLabels.forEach(label => console.log(`  - ${label}`));
  } else {
    console.log('  (none found)');
  }

  console.log('\n📋 Roles found:');
  console.log('─'.repeat(60));
  if (selectorInfo.roles.length > 0) {
    selectorInfo.roles.forEach(role => console.log(`  - ${role}`));
  } else {
    console.log('  (none found)');
  }

  console.log('\n📋 Data attributes found:');
  console.log('─'.repeat(60));
  if (selectorInfo.dataAttributes.length > 0) {
    selectorInfo.dataAttributes.slice(0, 15).forEach(attr => console.log(`  - ${attr}`));
    if (selectorInfo.dataAttributes.length > 15) {
      console.log(`  ... and ${selectorInfo.dataAttributes.length - 15} more`);
    }
  } else {
    console.log('  (none found)');
  }

  console.log('\n📁 File Headers Analysis:');
  console.log('─'.repeat(60));
  selectorInfo.fileHeaders.slice(0, 5).forEach(header => {
    console.log(`\n  File: ${header.filename}`);
    console.log(`    Tag: <${header.tagName.toLowerCase()}>`);
    console.log(`    Classes: ${header.classes.join(', ') || 'none'}`);
    console.log(`    Role: ${header.role || 'none'}`);
    console.log(`    ARIA Label: ${header.ariaLabel || 'none'}`);
    console.log(`    Data attrs: ${Object.keys(header.dataAttributes).join(', ') || 'none'}`);
  });

  if (selectorInfo.fileHeaders.length > 5) {
    console.log(`\n  ... and ${selectorInfo.fileHeaders.length - 5} more files`);
  }

  console.log('\n\n💡 Recommended Selectors:');
  console.log('─'.repeat(60));
  
  if (selectorInfo.roles.length > 0) {
    console.log('\n  Using ARIA roles:');
    selectorInfo.roles.forEach(role => {
      console.log(`    document.querySelectorAll('[role="${role}"]')`);
    });
  }

  if (selectorInfo.dataAttributes.some(attr => attr.includes('file') || attr.includes('path'))) {
    console.log('\n  Using data attributes:');
    selectorInfo.dataAttributes
      .filter(attr => attr.includes('file') || attr.includes('path'))
      .slice(0, 5)
      .forEach(attr => {
        console.log(`    document.querySelectorAll('[${attr}]')`);
      });
  }

  console.log('\n  Current approach (class-based):');
  console.log('    document.querySelectorAll(".file-header")');
  
  console.log('\n\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  await browser.close();
  console.log('\n✅ Inspection complete!');
}

inspectSelectors()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

