/**
 * Test handling of unknown/unsupported file types
 */

import { describe, it, expect } from 'vitest';
import {
  detectLanguageFromFilename,
  calculateLanguageStats,
  calculateTotals,
} from '../../lib/language-detector.js';

describe('Unknown Languages', () => {
  it('should categorize unknown extensions as "Other"', () => {
    expect(detectLanguageFromFilename('weird.xyz')).toBe('Other');
    expect(detectLanguageFromFilename('Makefile')).toBe('Other');
    expect(detectLanguageFromFilename('BUILD')).toBe('Other');
    expect(detectLanguageFromFilename('.eslintrc')).toBe('Other');
  });

  it('should aggregate all unknown types into "Other" category', () => {
    const mockFiles = [
      { filename: 'weird.xyz', additions: 100, deletions: 10 },
      { filename: 'Makefile', additions: 50, deletions: 5 },
      { filename: 'BUILD', additions: 30, deletions: 2 },
      { filename: 'normal.js', additions: 200, deletions: 20 },
    ];

    const stats = calculateLanguageStats(mockFiles);

    // All unknown types should be grouped as "Other"
    expect(stats.get('Other')).toEqual({
      added: 180,
      removed: 17,
      files: 3,
    });

    expect(stats.get('JavaScript')).toEqual({
      added: 200,
      removed: 20,
      files: 1,
    });
  });

  it('should handle files without extensions', () => {
    expect(detectLanguageFromFilename('README')).toBe('Other');
    expect(detectLanguageFromFilename('LICENSE')).toBe('Other');
    expect(detectLanguageFromFilename('Dockerfile')).toBe('Dockerfile'); // We DO recognize this!
  });

  it('should not crash on edge cases', () => {
    expect(detectLanguageFromFilename('')).toBe('Other');
    expect(detectLanguageFromFilename('.')).toBe('Other');
    expect(detectLanguageFromFilename('..')).toBe('Other');
    expect(detectLanguageFromFilename('file')).toBe('Other');
  });
});
