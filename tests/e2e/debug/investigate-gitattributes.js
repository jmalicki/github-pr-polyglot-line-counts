#!/usr/bin/env node

/**
 * Investigate how .gitattributes data is exposed by GitHub
 */

import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionPath = join(__dirname, '..', '..');

async function investigateGitattributes() {
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

  // Use a repo that likely has .gitattributes (React is a good bet)
  console.log('\n🔍 Testing on facebook/react (likely has .gitattributes)...\n');

  await page.goto('https://github.com/facebook/react/pull/31800/files', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  await page.waitForSelector('[data-details-container-group="file"]', { timeout: 15000 });

  const investigation = await page.evaluate(() => {
    const results = {
      methods: {
        domMarkers: [],
        hiddenData: [],
        classMarkers: [],
      },
      sampleFiles: [],
    };

    // Method 1: Check for DOM markers
    const containers = document.querySelectorAll('[data-details-container-group="file"]');

    containers.forEach((container, idx) => {
      if (idx >= 5) return; // First 5 files

      const path = container.getAttribute('data-tagsearch-path') || 'unknown';
      const allAttrs = {};

      // Collect ALL attributes
      Array.from(container.attributes).forEach(attr => {
        allAttrs[attr.name] = attr.value;
      });

      // Look for linguist-related attributes
      const linguistAttrs = Object.keys(allAttrs).filter(
        k => k.includes('linguist') || k.includes('generated') || k.includes('vendored')
      );

      // Check text content for markers
      const text = container.textContent;
      const hasGeneratedText = text.toLowerCase().includes('generated');
      const hasVendoredText = text.toLowerCase().includes('vendored');
      const hasBinaryText = text.toLowerCase().includes('binary');

      // Check classes
      const classes = Array.from(container.classList);
      const linguistClasses = classes.filter(
        c => c.includes('generated') || c.includes('vendored') || c.includes('linguist')
      );

      results.sampleFiles.push({
        path,
        linguistAttrs,
        linguistClasses,
        textMarkers: {
          generated: hasGeneratedText,
          vendored: hasVendoredText,
          binary: hasBinaryText,
        },
        allAttributeKeys: Object.keys(allAttrs),
      });
    });

    // Method 2: Check for hidden data elements
    const metaTags = document.querySelectorAll(
      'meta[name*="linguist"], meta[name*="gitattributes"]'
    );
    results.methods.hiddenData = Array.from(metaTags).map(m => ({
      name: m.getAttribute('name'),
      content: m.getAttribute('content'),
    }));

    // Method 3: Check for special markers in PR header
    const prDetails = document.querySelector('.gh-header-meta, [data-hpc]');
    if (prDetails) {
      const detailsText = prDetails.textContent;
      results.methods.prLevelMarkers = {
        text: detailsText.substring(0, 200),
        hasGeneratedMention: detailsText.includes('generated'),
      };
    }

    return results;
  });

  console.log('📊 Investigation Results:\n');
  console.log('═'.repeat(70));

  console.log('\n🔎 Method 1: DOM Attributes/Markers');
  console.log('─'.repeat(70));

  if (investigation.sampleFiles.length === 0) {
    console.log('  ❌ No files found');
  } else {
    let foundLinguistMarkers = false;
    investigation.sampleFiles.forEach((file, idx) => {
      console.log(`\n  ${idx + 1}. ${file.path}`);

      if (file.linguistAttrs.length > 0) {
        console.log(`     ✅ FOUND linguist attributes: ${file.linguistAttrs.join(', ')}`);
        foundLinguistMarkers = true;
      } else {
        console.log(`     ❌ No linguist attributes`);
      }

      if (file.linguistClasses.length > 0) {
        console.log(`     ✅ FOUND linguist classes: ${file.linguistClasses.join(', ')}`);
        foundLinguistMarkers = true;
      }

      const markers = [];
      if (file.textMarkers.generated) markers.push('generated');
      if (file.textMarkers.vendored) markers.push('vendored');
      if (file.textMarkers.binary) markers.push('binary');

      if (markers.length > 0) {
        console.log(`     📝 Text markers: ${markers.join(', ')}`);
      }
    });

    if (!foundLinguistMarkers) {
      console.log('\n  ❌ GitHub does NOT expose linguist data in DOM attributes');
    }
  }

  console.log('\n\n🔎 Method 2: Hidden Meta Tags');
  console.log('─'.repeat(70));
  if (investigation.methods.hiddenData.length > 0) {
    console.log('  ✅ Found meta tags:');
    investigation.methods.hiddenData.forEach(m => {
      console.log(`     ${m.name}: ${m.content}`);
    });
  } else {
    console.log('  ❌ No linguist-related meta tags found');
  }

  console.log('\n\n💡 CONCLUSION:');
  console.log('─'.repeat(70));
  console.log('\n  GitHub does NOT expose .gitattributes in the DOM.');
  console.log('  Extensions like Better Line Counts must:');
  console.log('  1. Fetch .gitattributes file directly');
  console.log('  2. Parse the patterns (*.pb.go linguist-generated=true)');
  console.log('  3. Match file paths against patterns');
  console.log('\n  Example:');
  console.log('    fetch("https://raw.githubusercontent.com/{owner}/{repo}/main/.gitattributes")');
  console.log('    → Parse patterns');
  console.log('    → Check if file matches pattern');

  // Now let's check if we can actually fetch .gitattributes
  console.log('\n\n🧪 Testing: Can we fetch .gitattributes?');
  console.log('─'.repeat(70));

  const prUrl = page.url();
  const match = prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull/);

  if (match) {
    const [, owner, repo] = match;

    try {
      const gitattributesUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/.gitattributes`;
      console.log(`\n  Trying: ${gitattributesUrl}`);

      const response = await page.evaluate(async url => {
        try {
          const res = await fetch(url);
          return {
            ok: res.ok,
            status: res.status,
            text: res.ok ? await res.text() : null,
          };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }, gitattributesUrl);

      if (response.ok) {
        console.log(`  ✅ SUCCESS! .gitattributes exists`);
        console.log(`\n  Content preview:`);
        const lines = response.text.split('\n').slice(0, 10);
        lines.forEach(line => console.log(`     ${line}`));
        if (response.text.split('\n').length > 10) {
          console.log(`     ... (${response.text.split('\n').length} total lines)`);
        }
      } else {
        console.log(`  ❌ Not found (${response.status})`);
        console.log('  Note: File might be on different branch or not exist');
      }
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
    }
  }

  console.log('\n');

  if (process.env.DEBUG) {
    console.log('⏸️  Browser open for 30s...');
    await new Promise(resolve => setTimeout(resolve, 30000));
  }

  await browser.close();
}

investigateGitattributes().catch(console.error);
