#!/usr/bin/env node

/**
 * E2E Test Runner for GitHub PR Language Stats Extension
 * 
 * This script:
 * - Launches Chrome with the extension loaded
 * - Navigates to a GitHub PR
 * - Takes screenshots of the extension in action
 * - Validates that the language stats panel appears
 */

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionPath = join(__dirname, '..', '..');
const screenshotsDir = join(__dirname, '..', 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function testExtension() {
  console.log('🚀 Starting E2E tests for GitHub PR Language Stats extension...\n');

  // Launch browser with extension loaded
  console.log('📦 Loading extension from:', extensionPath);
  const browser = await puppeteer.launch({
    headless: false, // Run in headed mode to see the extension in action
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Test on a real GitHub PR
    // You can change this to any PR you want to test
    const testPR = process.env.TEST_PR_URL || 'https://github.com/jmalicki/arsync/pull/55';
    
    console.log(`📄 Navigating to: ${testPR}`);
    
    // Extract PR info for API validation
    const prMatch = testPR.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    const [, owner, repo, prNumber] = prMatch;
    
    // Fetch actual GitHub stats via API for validation
    console.log('📊 Fetching GitHub PR stats for validation...');
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    const response = await fetch(apiUrl);
    const prData = await response.json();
    const expectedStats = {
      additions: prData.additions,
      deletions: prData.deletions,
      changedFiles: prData.changed_files
    };
    console.log(`   Expected: +${expectedStats.additions} -${expectedStats.deletions} (${expectedStats.changedFiles} files)\n`);
    
    // Go directly to Files changed tab by appending /files
    const filesUrl = testPR.endsWith('/files') ? testPR : `${testPR}/files`;
    await page.goto(filesUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for GitHub to load the diff view
    console.log('⏳ Waiting for GitHub diff view to load...');
    await page.waitForSelector('.file-header, [data-file-type], [data-tagsearch-path]', { timeout: 15000 });

    // Give the extension time to analyze the diff
    console.log('🔍 Waiting for extension to analyze the PR...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot before scrolling
    const screenshotBefore = join(screenshotsDir, '01-pr-page-loaded.png');
    await page.screenshot({ path: screenshotBefore, fullPage: false });
    console.log(`📸 Screenshot saved: ${screenshotBefore}`);

    // Check if the language stats panel appeared
    const panelExists = await page.$('#pr-language-stats-panel');
    
    if (panelExists) {
      console.log('✅ Language stats panel found!');
      
      // Scroll to the panel
      await page.evaluate(() => {
        const panel = document.querySelector('#pr-language-stats-panel');
        if (panel) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Take screenshot with panel visible
      const screenshotPanel = join(screenshotsDir, '02-language-stats-panel.png');
      await page.screenshot({ path: screenshotPanel, fullPage: false });
      console.log(`📸 Screenshot saved: ${screenshotPanel}`);

      // Take a screenshot of just the panel
      const panelScreenshot = join(screenshotsDir, '03-panel-closeup.png');
      const panel = await page.$('#pr-language-stats-panel');
      await panel.screenshot({ path: panelScreenshot });
      console.log(`📸 Panel closeup saved: ${panelScreenshot}`);

      // Extract and display the stats
      const stats = await page.evaluate(() => {
        const table = document.querySelector('#pr-language-stats-panel table');
        if (!table) return null;
        
        const rows = Array.from(table.querySelectorAll('tr'));
        return rows.map(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          return cells.map(cell => cell.textContent.trim()).join(' | ');
        }).filter(row => row);
      });

      if (stats) {
        console.log('\n📊 Extracted Language Statistics:');
        console.log('─'.repeat(60));
        stats.forEach(stat => console.log(stat));
        console.log('─'.repeat(60));
        
        // Validate totals match GitHub's reported stats
        const totalRow = stats[stats.length - 1];
        if (totalRow) {
          const match = totalRow.match(/Total.*?\+(\d+).*?-(\d+)/);
          if (match) {
            const extractedAdded = parseInt(match[1]);
            const extractedRemoved = parseInt(match[2]);
            
            console.log('\n🔍 Validation:');
            console.log(`   Extension reports: +${extractedAdded} -${extractedRemoved}`);
            console.log(`   GitHub API reports: +${expectedStats.additions} -${expectedStats.deletions}`);
            
            const addedMatch = extractedAdded === expectedStats.additions;
            const removedMatch = extractedRemoved === expectedStats.deletions;
            
            if (addedMatch && removedMatch) {
              console.log('   ✅ Totals match perfectly!');
            } else {
              console.log('   ❌ Totals DO NOT match!');
              console.log(`   Difference: ${expectedStats.additions - extractedAdded} additions, ${expectedStats.deletions - extractedRemoved} deletions`);
            }
          }
        }
      }
      
      // Already on Files Changed tab, just take a screenshot
      const screenshotFiles = join(screenshotsDir, '04-files-view.png');
      await page.screenshot({ path: screenshotFiles, fullPage: false });
      console.log(`📸 Files view screenshot saved: ${screenshotFiles}`);

    } else {
      console.log('❌ Language stats panel NOT found');
      const screenshotError = join(screenshotsDir, 'error-panel-not-found.png');
      await page.screenshot({ path: screenshotError, fullPage: true });
      console.log(`📸 Error screenshot saved: ${screenshotError}`);
    }

    // Take a full page screenshot for reference
    const screenshotFull = join(screenshotsDir, '05-full-page.png');
    await page.screenshot({ path: screenshotFull, fullPage: true });
    console.log(`📸 Full page screenshot saved: ${screenshotFull}`);

    console.log('\n✨ Test completed successfully!');
    console.log(`📁 All screenshots saved to: ${screenshotsDir}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Take error screenshot
    const errorScreenshot = join(screenshotsDir, 'error-test-failure.png');
    await page.screenshot({ path: errorScreenshot, fullPage: true });
    console.log(`📸 Error screenshot saved: ${errorScreenshot}`);
    
    throw error;
  } finally {
    // Keep browser open for manual inspection in headless: false mode
    console.log('\n⏸️  Browser will stay open for 30 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    await browser.close();
    console.log('👋 Browser closed');
  }
}

// Run the test
testExtension()
  .then(() => {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Tests failed:', error);
    process.exit(1);
  });

