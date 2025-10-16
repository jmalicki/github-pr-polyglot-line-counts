/**
 * Test API-based analysis for huge PRs
 */

import { describe, it, expect } from 'vitest';
import { calculateLanguageStats, calculateTotals } from '../../lib/language-detector.js';

describe('API Analysis for Huge PRs', () => {
  it.skip('should handle PR #33 via GitHub API (75 files, +24k lines) - SKIPPED: rate limit', async () => {
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
    
    // Note: GitHub's PR totals might be null for very large/problematic PRs
    if (prData.additions !== null) {
      expect(totals.totalAdded).toBe(prData.additions);
      expect(totals.totalRemoved).toBe(prData.deletions);
      expect(totals.totalFiles).toBe(prData.changed_files);
    } else {
      console.log('   ⚠️  GitHub reports null totals (PR too large)');
      console.log(`   Our calculation: +${totals.totalAdded} -${totals.totalRemoved}`);
      
      // At least verify we got a reasonable number
      expect(totals.totalAdded).toBeGreaterThan(10000);
      expect(totals.totalFiles).toBe(allFiles.length);
    }
  });
});

