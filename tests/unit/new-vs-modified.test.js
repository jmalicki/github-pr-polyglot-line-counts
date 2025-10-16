/**
 * Test to verify handling of new files vs modified files
 */

import { describe, it, expect } from 'vitest';
import { calculateLanguageStats, calculateTotals } from '../../lib/language-detector.js';

describe('New vs Modified Files', () => {
  it('should correctly handle new files (additions only) in arsync PR #55', async () => {
    const filesResponse = await fetch('https://api.github.com/repos/jmalicki/arsync/pulls/55/files');
    const files = await filesResponse.json();

    // Separate new vs modified files
    const newFiles = files.filter(f => f.status === 'added');
    const modifiedFiles = files.filter(f => f.status === 'modified');

    console.log('\n📊 File Status Breakdown:');
    console.log(`   New files: ${newFiles.length}`);
    console.log(`   Modified files: ${modifiedFiles.length}`);

    // Calculate stats for new files only
    const newFileStats = calculateLanguageStats(newFiles);
    const newFileTotals = calculateTotals(newFileStats);

    console.log('\n📈 New Files (additions only):');
    for (const [lang, stats] of newFileStats.entries()) {
      console.log(`   ${lang}: ${stats.files} files, +${stats.added} -${stats.removed}`);
    }
    console.log(`   Total: +${newFileTotals.totalAdded} -${newFileTotals.totalRemoved}`);

    // Calculate stats for modified files only
    const modFileStats = calculateLanguageStats(modifiedFiles);
    const modFileTotals = calculateTotals(modFileStats);

    console.log('\n📝 Modified Files:');
    for (const [lang, stats] of modFileStats.entries()) {
      console.log(`   ${lang}: ${stats.files} files, +${stats.added} -${stats.removed}`);
    }
    console.log(`   Total: +${modFileTotals.totalAdded} -${modFileTotals.totalRemoved}`);

    // The issue: Most additions are in NEW files!
    expect(newFileTotals.totalAdded).toBeGreaterThan(modFileTotals.totalAdded);
    
    // If extension can't find new file stats, it would miss most of the changes
    const percentageInNewFiles = (newFileTotals.totalAdded / (newFileTotals.totalAdded + modFileTotals.totalAdded)) * 100;
    console.log(`\n⚠️  ${percentageInNewFiles.toFixed(1)}% of additions are in NEW files!`);
    console.log('   If extension can\'t parse new files, it will miss most changes.\n');

    // Verify specific new files
    const condvarFile = newFiles.find(f => f.filename.includes('condvar.rs'));
    expect(condvarFile.status).toBe('added');
    expect(condvarFile.additions).toBeGreaterThan(300);
    expect(condvarFile.deletions).toBe(0);

    const designFile = newFiles.find(f => f.filename.includes('design.md'));
    expect(designFile.status).toBe('added');
    expect(designFile.additions).toBeGreaterThan(800);
    expect(designFile.deletions).toBe(0);
  });

  it('should handle files with different statuses', () => {
    const mockFiles = [
      { filename: 'new.rs', additions: 100, deletions: 0, status: 'added' },
      { filename: 'modified.rs', additions: 50, deletions: 20, status: 'modified' },
      { filename: 'renamed.rs', additions: 10, deletions: 10, status: 'renamed' },
    ];

    const stats = calculateLanguageStats(mockFiles);
    const totals = calculateTotals(stats);

    expect(totals.totalAdded).toBe(160);
    expect(totals.totalRemoved).toBe(30);
    expect(totals.totalFiles).toBe(3);
  });
});

