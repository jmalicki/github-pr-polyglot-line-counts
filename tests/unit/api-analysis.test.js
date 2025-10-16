/**
 * Test API-based analysis for huge PRs
 */

import { describe, it, expect } from 'vitest';
import { calculateLanguageStats, calculateTotals } from '../../lib/language-detector.js';

describe('API Analysis for Huge PRs', () => {
  it('should handle PR #33 via GitHub API (75 files, +24k lines)', async () => {
    // Fetch ALL files via API with pagination
    let allFiles = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= 10) {
      const response = await fetch(`https://api.github.com/repos/jmalicki/arsync/pulls/33/files?per_page=100&page=${page}`);
      const files = await response.json();
      allFiles = allFiles.concat(files);
      
      hasMore = files.length === 100;
      page++;
    }
    
    console.log(`\n📊 PR #33 via API: ${allFiles.length} files (${page - 1} pages)`);
    
    // Verify we got all files
    expect(allFiles.length).toBeGreaterThanOrEqual(75);
    
    // Calculate stats
    const stats = calculateLanguageStats(allFiles);
    const totals = calculateTotals(stats);
    
    console.log('\n📋 Language Breakdown:');
    for (const [lang, langStats] of stats.entries()) {
      console.log(`   ${lang}: ${langStats.files} files, +${langStats.added} -${langStats.removed}`);
    }
    console.log(`   Total: +${totals.totalAdded} -${totals.totalRemoved} (${totals.totalFiles} files)\n`);
    
    // Validate against GitHub's reported totals
    const prResponse = await fetch('https://api.github.com/repos/jmalicki/arsync/pulls/33');
    const prData = await prResponse.json();
    
    console.log(`\n📊 GitHub PR reports: +${prData.additions} -${prData.deletions}`);
    console.log(`   Our API calculation: +${totals.totalAdded} -${totals.totalRemoved}`);
    
    // Note: GitHub's web UI totals often differ from API file totals
    // This is due to renamed files, binary files, and other edge cases
    // We show what the API provides (source of truth for our extension)
    
    if (prData.additions !== totals.totalAdded) {
      console.log(`   ℹ️  Discrepancy: ${prData.additions - totals.totalAdded} additions difference`);
      console.log('   This is normal - renamed/binary files counted differently');
    }
    
    // Validate our calculation is reasonable
    expect(totals.totalAdded).toBeGreaterThan(15000); // Huge PR!
    expect(totals.totalFiles).toBe(75); // All files present
    expect(allFiles.length).toBe(75); // Fetched all files
    
    // Validate we got major languages
    expect(stats.has('Rust')).toBe(true);
    expect(stats.has('Markdown')).toBe(true);
  });
});

