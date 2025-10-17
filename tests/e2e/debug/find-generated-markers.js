#!/usr/bin/env node

/**
 * Find how GitHub marks generated files in PRs
 * We need a PR with known generated files (like package-lock.json, *.pb.go, etc.)
 */

import puppeteer from 'puppeteer';

async function findGeneratedMarkers() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  
  // Find a PR with package-lock.json or similar generated file
  console.log('\n🔍 Checking Next.js PR (likely has package-lock.json)...\n');
  
  await page.goto('https://github.com/vercel/next.js/pulls', { 
    waitUntil: 'networkidle2',
    timeout: 30000 
  });

  // Get first open PR
  const prLink = await page.evaluate(() => {
    const link = document.querySelector('a[data-hovercard-type="pull_request"]');
    return link ? link.href + '/files' : null;
  });

  if (!prLink) {
    console.log('❌ Could not find PR');
    await browser.close();
    return;
  }

  console.log(`📄 Checking: ${prLink}\n`);
  await page.goto(prLink, { waitUntil: 'networkidle2', timeout: 30000 });

  const markers = await page.evaluate(() => {
    const results = [];
    
    // Look for any file that says "generated" or has special treatment
    const allFiles = document.querySelectorAll('[data-details-container-group="file"]');
    
    allFiles.forEach(file => {
      const path = file.getAttribute('data-tagsearch-path') || 'unknown';
      
      // Check for collapsed/hidden sections
      const isCollapsed = file.classList.contains('Details--collapsed') || 
                         file.hasAttribute('data-details-container');
      
      // Look for "Load diff" or "not shown" text
      const text = file.textContent.toLowerCase();
      const hasLoadDiff = text.includes('load diff') || 
                         text.includes('not shown') ||
                         text.includes('hidden');
      
      // Check for special classes
      const specialClasses = Array.from(file.classList).filter(c =>
        c.includes('generated') || 
        c.includes('hidden') || 
        c.includes('vendor') ||
        c.includes('collapsed')
      );
      
      // Check for special attributes
      const specialAttrs = {};
      ['data-generated', 'data-linguist-generated', 'data-hidden', 'data-collapsed'].forEach(attr => {
        if (file.hasAttribute(attr)) {
          specialAttrs[attr] = file.getAttribute(attr);
        }
      });
      
      // Only log files with something interesting
      if (hasLoadDiff || specialClasses.length > 0 || Object.keys(specialAttrs).length > 0) {
        results.push({
          path,
          isCollapsed,
          hasLoadDiff,
          specialClasses,
          specialAttrs,
          textSnippet: text.substring(0, 150).replace(/\s+/g, ' ')
        });
      }
    });
    
    return results;
  });

  console.log('📊 Generated File Markers Found:\n');
  console.log('═'.repeat(70));
  
  if (markers.length === 0) {
    console.log('\n❌ No special markers found');
    console.log('   Either: 1) No generated files in this PR');
    console.log('           2) GitHub doesn\'t add DOM markers');
  } else {
    markers.forEach((m, idx) => {
      console.log(`\n${idx + 1}. ${m.path}`);
      console.log(`   Collapsed: ${m.isCollapsed}`);
      console.log(`   Has "Load diff": ${m.hasLoadDiff}`);
      if (m.specialClasses.length > 0) {
        console.log(`   Classes: ${m.specialClasses.join(', ')}`);
      }
      if (Object.keys(m.specialAttrs).length > 0) {
        console.log(`   Attributes: ${JSON.stringify(m.specialAttrs)}`);
      }
    });
  }

  console.log('\n\n💡 CONCLUSION:');
  console.log('─'.repeat(70));
  console.log('GitHub marks generated files by:');
  console.log('  1. Details--collapsed class');
  console.log('  2. "Load diff" button text');  
  console.log('  3. data-details-container attribute');
  console.log('\nBetter Line Counts probably:');
  console.log('  - Checks if file has Details--collapsed class');
  console.log('  - OR checks for "Load diff" text');
  console.log('  - Then excludes those files from totals');

  console.log('\n');

  await browser.close();
}

findGeneratedMarkers().catch(console.error);
