#!/usr/bin/env node

/**
 * Explore ALL available data and attributes on GitHub PR pages
 */

import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionPath = join(__dirname, '..', '..');

async function exploreData() {
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

  await page.waitForSelector('[data-details-container-group="file"]', { timeout: 15000 });

  const allData = await page.evaluate(() => {
    const results = {
      fileContainers: [],
      gitattributes: null,
      prMetadata: {},
      availableSelectors: new Set(),
      uniqueDataAttrs: new Set(),
      uniqueClasses: new Set()
    };

    // Check for .gitattributes data
    const gitattributesLink = document.querySelector('a[href*=".gitattributes"]');
    if (gitattributesLink) {
      results.gitattributes = {
        exists: true,
        href: gitattributesLink.href
      };
    }

    // Explore PR metadata
    const prHeader = document.querySelector('.gh-header-meta, [data-hpc]');
    if (prHeader) {
      results.prMetadata.text = prHeader.textContent.trim().substring(0, 200);
    }

    // Deep dive into file containers
    const containers = document.querySelectorAll('[data-details-container-group="file"]');
    
    containers.forEach((container, idx) => {
      if (idx >= 3) return; // First 3 for brevity
      
      const allAttrs = {};
      Array.from(container.attributes).forEach(attr => {
        allAttrs[attr.name] = attr.value;
        if (attr.name.startsWith('data-')) {
          results.uniqueDataAttrs.add(attr.name);
        }
      });

      // Collect all classes
      Array.from(container.classList).forEach(cls => {
        results.uniqueClasses.add(cls);
      });

      const fileInfo = {
        index: idx,
        filename: container.getAttribute('data-tagsearch-path') || 'unknown',
        allAttributes: allAttrs,
        fileStatus: container.getAttribute('data-file-deleted') === 'true' ? 'deleted' : 
                   container.getAttribute('data-file-type') ? 'normal' : 'unknown',
        
        // Check for linguist-style markers
        hasGeneratedMarker: container.textContent.includes('generated'),
        hasVendoredMarker: container.textContent.includes('vendored'),
        
        // Look for code owner info
        codeowners: container.getAttribute('data-codeowners'),
        
        // Check file type detection
        detectedType: container.getAttribute('data-file-type'),
        
        // Look for diff metadata
        diffMetadata: {
          hasExpandButtons: !!container.querySelector('[data-expand-line]'),
          hasCodeSuggestions: !!container.querySelector('[data-suggestion-path]'),
          hasComments: !!container.querySelector('.review-comment'),
        },
        
        // Extract any special markers from text
        textMarkers: extractMarkers(container.textContent)
      };

      results.fileContainers.push(fileInfo);
    });

    function extractMarkers(text) {
      const markers = [];
      if (text.includes('Binary file')) markers.push('binary');
      if (text.includes('Large diff')) markers.push('large-diff');
      if (text.includes('generated')) markers.push('generated');
      if (text.includes('vendored')) markers.push('vendored');
      if (text.includes('renamed')) markers.push('renamed');
      return markers;
    }

    // Look for PR-level linguist data
    const linguistData = document.querySelector('[data-linguist]');
    if (linguistData) {
      results.linguistData = linguistData.getAttribute('data-linguist');
    }

    return {
      ...results,
      uniqueDataAttrs: Array.from(results.uniqueDataAttrs),
      uniqueClasses: Array.from(results.uniqueClasses)
    };
  });

  console.log('\n🔍 AVAILABLE DATA ON GITHUB PR PAGES:\n');
  console.log('═'.repeat(70));

  console.log('\n📋 Unique Data Attributes Found:');
  console.log('─'.repeat(70));
  allData.uniqueDataAttrs.slice(0, 20).forEach(attr => {
    console.log(`  - ${attr}`);
  });
  if (allData.uniqueDataAttrs.length > 20) {
    console.log(`  ... and ${allData.uniqueDataAttrs.length - 20} more`);
  }

  console.log('\n📁 File Container Deep Dive:');
  console.log('─'.repeat(70));
  allData.fileContainers.forEach(file => {
    console.log(`\n  ${file.index + 1}. ${file.filename}`);
    console.log(`     Status: ${file.fileStatus}`);
    console.log(`     Type: ${file.detectedType || 'unknown'}`);
    console.log(`     Code Owners: ${file.codeowners || 'none'}`);
    console.log(`     Markers: ${file.textMarkers.join(', ') || 'none'}`);
    console.log(`     Has expand buttons: ${file.diffMetadata.hasExpandButtons}`);
    console.log(`     Has comments: ${file.diffMetadata.hasComments}`);
    
    console.log(`     All attributes:`);
    Object.entries(file.allAttributes).slice(0, 8).forEach(([key, val]) => {
      const displayVal = val.length > 50 ? val.substring(0, 50) + '...' : val;
      console.log(`       ${key}: "${displayVal}"`);
    });
  });

  console.log('\n\n🎯 INTERESTING DATA DISCOVERED:');
  console.log('─'.repeat(70));
  
  console.log('\n  ✓ data-file-type: File extension (.rs, .md, etc.)');
  console.log('  ✓ data-file-deleted: Whether file was deleted');
  console.log('  ✓ data-codeowners: Code ownership info');
  console.log('  ✓ data-tagsearch-path: Full file path');
  console.log('  ✓ Text markers: Binary, Large diff, Generated, Vendored, Renamed');
  console.log('  ✓ Diff metadata: Expandable sections, Comments, Suggestions');
  
  if (allData.gitattributes) {
    console.log('  ✓ .gitattributes file exists in repo!');
  }

  console.log('\n\n💡 POTENTIAL FEATURES WE COULD ADD:');
  console.log('─'.repeat(70));
  console.log('\n  📊 Filtering Options:');
  console.log('     • Exclude generated files (like Better Line Counts)');
  console.log('     • Exclude vendored/third-party code');
  console.log('     • Exclude binary files');
  console.log('     • Show only production code (exclude tests)');
  console.log('     • Filter by code owner');
  
  console.log('\n  📈 Enhanced Statistics:');
  console.log('     • Separate new vs modified vs deleted files');
  console.log('     • Track binary file changes');
  console.log('     • Count files with comments vs without');
  console.log('     • Show test coverage by language');
  console.log('     • Identify large diffs (>500 lines)');
  
  console.log('\n  🏷️  File Classification:');
  console.log('     • Production vs Test vs Config vs Docs');
  console.log('     • Generated vs Hand-written');
  console.log('     • Vendored vs First-party');
  console.log('     • By code owner/team');

  console.log('\n  📦 Integration Ideas:');
  console.log('     • Parse .gitattributes for linguist-generated markers');
  console.log('     • Use file paths to detect test files (/test/, /spec/, etc.)');
  console.log('     • Detect framework files (package.json, Cargo.toml, etc.)');
  console.log('     • Show config changes separately');

  console.log('\n\n🔬 Want to explore .gitattributes?');
  if (allData.gitattributes) {
    console.log(`   Yes! Found at: ${allData.gitattributes.href}`);
  } else {
    console.log('   No .gitattributes in this repo');
  }

  console.log('\n');

  if (process.env.DEBUG) {
    console.log('⏸️  Browser open for 30s...');
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  
  await browser.close();
}

exploreData().catch(console.error);

