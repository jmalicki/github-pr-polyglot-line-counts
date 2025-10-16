/**
 * Unit tests for language detection and line counting accuracy
 * 
 * Tests the extension's language detection and counting logic against GitHub API stats
 */

import { describe, it, expect } from 'vitest';
import { detectLanguageFromFilename, calculateLanguageStats, calculateTotals } from '../../lib/language-detector.js';

describe('Language Detection', () => {
  describe('File Extension Mapping', () => {
    it('should detect Rust files', () => {
      expect(detectLanguageFromFilename('main.rs')).toBe('Rust');
      expect(detectLanguageFromFilename('src/lib.rs')).toBe('Rust');
      expect(detectLanguageFromFilename('crates/compio-sync/src/condvar.rs')).toBe('Rust');
    });

    it('should detect JavaScript/TypeScript files', () => {
      expect(detectLanguageFromFilename('app.js')).toBe('JavaScript');
      expect(detectLanguageFromFilename('component.jsx')).toBe('JavaScript');
      expect(detectLanguageFromFilename('app.ts')).toBe('TypeScript');
      expect(detectLanguageFromFilename('component.tsx')).toBe('TypeScript');
    });

    it('should detect Python files', () => {
      expect(detectLanguageFromFilename('main.py')).toBe('Python');
      expect(detectLanguageFromFilename('src/utils.py')).toBe('Python');
    });

    it('should detect Markdown files', () => {
      expect(detectLanguageFromFilename('README.md')).toBe('Markdown');
      expect(detectLanguageFromFilename('docs/design.md')).toBe('Markdown');
    });

    it('should detect web files', () => {
      expect(detectLanguageFromFilename('index.html')).toBe('HTML');
      expect(detectLanguageFromFilename('styles.css')).toBe('CSS');
      expect(detectLanguageFromFilename('styles.scss')).toBe('SCSS');
    });

    it('should detect C/C++ files', () => {
      expect(detectLanguageFromFilename('main.c')).toBe('C');
      expect(detectLanguageFromFilename('main.cpp')).toBe('C++');
      expect(detectLanguageFromFilename('main.cc')).toBe('C++');
      expect(detectLanguageFromFilename('header.h')).toBe('C/C++ Header');
      expect(detectLanguageFromFilename('header.hpp')).toBe('C++ Header');
    });

    it('should handle unknown extensions', () => {
      expect(detectLanguageFromFilename('file.xyz')).toBe('Other');
      expect(detectLanguageFromFilename('Makefile')).toBe('Other');
    });
  });
});

describe('Line Count Accuracy - GitHub API Validation', () => {
  it.skip('should match GitHub API totals for arsync PR #55 - SKIPPED: rate limit', async () => {
    // Fetch actual GitHub stats
    const response = await fetch('https://api.github.com/repos/jmalicki/arsync/pulls/55');
    const prData = await response.json();
    
    const expectedTotals = {
      additions: prData.additions,
      deletions: prData.deletions,
      changedFiles: prData.changed_files
    };

    console.log(`\n📊 GitHub API Reports: +${expectedTotals.additions} -${expectedTotals.deletions} (${expectedTotals.changedFiles} files)`);

    // Fetch the files in the PR
    const filesResponse = await fetch('https://api.github.com/repos/jmalicki/arsync/pulls/55/files');
    const files = await filesResponse.json();

    // Calculate stats using our logic
    const languageStats = calculateLanguageStats(files);
    const totals = calculateTotals(languageStats);

    // Log the breakdown
    console.log('\n📋 Our Extension Calculates:');
    for (const [language, stats] of languageStats.entries()) {
      console.log(`   ${language}: ${stats.files} files, +${stats.added} -${stats.removed}`);
    }
    console.log(`   Total: +${totals.totalAdded} -${totals.totalRemoved} (${totals.totalFiles} files)\n`);

    // Validate totals match exactly
    expect(totals.totalAdded).toBe(expectedTotals.additions);
    expect(totals.totalRemoved).toBe(expectedTotals.deletions);
    expect(totals.totalFiles).toBe(expectedTotals.changedFiles);
  });

  it.skip('should detect all languages in arsync PR #55 - SKIPPED: rate limit', async () => {
    const filesResponse = await fetch('https://api.github.com/repos/jmalicki/arsync/pulls/55/files');
    const files = await filesResponse.json();

    const languageStats = calculateLanguageStats(files);
    const languages = Array.from(languageStats.keys());

    // Should detect at least Rust and Markdown
    expect(languages).toContain('Rust');
    expect(languages).toContain('Markdown');
    
    console.log('\n🔍 Detected languages:', languages);
  });
});

describe('Stats Aggregation Logic', () => {
  it('should aggregate stats correctly by language', () => {
    const mockFiles = [
      { filename: 'src/main.rs', additions: 100, deletions: 10 },
      { filename: 'src/lib.rs', additions: 50, deletions: 5 },
      { filename: 'README.md', additions: 20, deletions: 2 },
      { filename: 'docs/guide.md', additions: 30, deletions: 0 },
      { filename: 'src/utils.py', additions: 40, deletions: 8 }
    ];

    const languageStats = calculateLanguageStats(mockFiles);

    // Validate Rust stats
    expect(languageStats.get('Rust')).toEqual({
      added: 150,
      removed: 15,
      files: 2
    });

    // Validate Markdown stats
    expect(languageStats.get('Markdown')).toEqual({
      added: 50,
      removed: 2,
      files: 2
    });

    // Validate Python stats
    expect(languageStats.get('Python')).toEqual({
      added: 40,
      removed: 8,
      files: 1
    });

    // Validate totals
    const totals = calculateTotals(languageStats);
    expect(totals.totalAdded).toBe(240);
    expect(totals.totalRemoved).toBe(25);
    expect(totals.totalFiles).toBe(5);
  });

  it('should handle empty file list', () => {
    const languageStats = calculateLanguageStats([]);
    const totals = calculateTotals(languageStats);

    expect(totals.totalAdded).toBe(0);
    expect(totals.totalRemoved).toBe(0);
    expect(totals.totalFiles).toBe(0);
  });

  it('should handle files with zero changes', () => {
    const mockFiles = [
      { filename: 'unchanged.js', additions: 0, deletions: 0 }
    ];

    const languageStats = calculateLanguageStats(mockFiles);
    const totals = calculateTotals(languageStats);

    expect(totals.totalAdded).toBe(0);
    expect(totals.totalRemoved).toBe(0);
    expect(totals.totalFiles).toBe(1);
  });
});
