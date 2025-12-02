/**
 * Shared test utilities for intermittent behavior tests
 */

import { Page } from 'puppeteer';

export interface ExtensionStats {
  added: number;
  removed: number;
}

export interface APIFile {
  filename: string;
  additions: number;
  deletions: number;
}

export interface PRInfo {
  owner: string;
  repo: string;
  prNumber: string;
}

/**
 * Extract PR info from URL
 */
export function parsePRUrl(url: string): PRInfo {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) {
    throw new Error(`Invalid PR URL: ${url}`);
  }
  const [, owner, repo, prNumber] = match;
  return { owner, repo, prNumber };
}

/**
 * Fetch all files from GitHub API with pagination support
 * Handles PRs with more than 100 files
 */
export async function fetchAllPRFiles(prInfo: PRInfo): Promise<APIFile[]> {
  const allFiles: APIFile[] = [];
  let page = 1;
  const maxPages = 10; // Safety limit: 1000 files max

  while (page <= maxPages) {
    const url = `https://api.github.com/repos/${prInfo.owner}/${prInfo.repo}/pulls/${prInfo.prNumber}/files?per_page=100&page=${page}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 403 || response.status === 429) {
        throw new Error(`GitHub API rate limit exceeded (${response.status})`);
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const files: APIFile[] = await response.json();

    // Validate response is an array
    if (!Array.isArray(files)) {
      throw new Error(`Unexpected API response: expected array, got ${typeof files}`);
    }

    allFiles.push(...files);

    // If we got fewer than 100 files, we've reached the last page
    if (files.length < 100) {
      break;
    }

    page++;
  }

  return allFiles;
}

/**
 * Calculate expected stats from API files
 */
export function calculateExpectedStats(files: APIFile[]): ExtensionStats {
  return files.reduce(
    (acc, f) => ({
      added: acc.added + f.additions,
      removed: acc.removed + f.deletions,
    }),
    { added: 0, removed: 0 }
  );
}

/**
 * Extract extension stats from the panel in the page
 * Shared DOM evaluation logic used across all tests
 */
export async function getExtensionStats(page: Page): Promise<ExtensionStats | null> {
  return page.evaluate((): ExtensionStats | null => {
    const panel = document.querySelector('#pr-language-stats-panel');
    if (!panel) return null;

    const totalRow = panel.querySelector('.total-row');
    if (!totalRow) return null;

    const addedCell = totalRow.querySelector('.language-added');
    const removedCell = totalRow.querySelector('.language-removed');

    return {
      added: parseInt(addedCell?.textContent?.replace(/[+]/g, '') || '0', 10),
      removed: parseInt(removedCell?.textContent?.replace(/[-]/g, '') || '0', 10),
    };
  });
}

/**
 * Check if extension panel exists and has stats
 */
export async function getPanelState(page: Page): Promise<{
  panelFound: boolean;
  hasTable: boolean;
  hasError: boolean;
  errorMessage?: string;
  stats: ExtensionStats | null;
}> {
  return page.evaluate(() => {
    const panel = document.querySelector('#pr-language-stats-panel');
    if (!panel) {
      return {
        panelFound: false,
        hasTable: false,
        hasError: false,
        stats: null,
      };
    }

    const table = panel.querySelector('table');
    const error = panel.querySelector('.flash-error');
    const totalRow = panel.querySelector('.total-row');

    return {
      panelFound: true,
      hasTable: !!table,
      hasError: !!error,
      errorMessage: error?.textContent?.trim(),
      stats: totalRow
        ? {
            added: parseInt(
              totalRow.querySelector('.language-added')?.textContent?.replace(/[+]/g, '') || '0',
              10
            ),
            removed: parseInt(
              totalRow.querySelector('.language-removed')?.textContent?.replace(/[-]/g, '') || '0',
              10
            ),
          }
        : null,
    };
  });
}

/**
 * Wait for extension panel to be ready with stats
 */
export async function waitForExtensionPanel(
  page: Page,
  timeout = 15000
): Promise<boolean> {
  try {
    await page.waitForSelector('#pr-language-stats-panel table', { timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the files URL for a PR
 */
export function getFilesUrl(prUrl: string): string {
  return prUrl.endsWith('/files') ? prUrl : `${prUrl}/files`;
}
