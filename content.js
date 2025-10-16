// GitHub PR Language Stats - Content Script
// Analyzes pull request diffs and shows line count statistics by language

class GitHubPRLanguageStats {
  constructor() {
    this.prData = null;
    this.languageStats = new Map();
    this.observer = null;
  }

  async init() {
    // Wait for GitHub's page to be fully loaded
    await this.waitForPRPage();
    await this.analyze();
    this.setupDOMObserver();
  }

  waitForPRPage() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        // Check for either old or new GitHub UI
        const diffContainer = document.querySelector('.diff-view, .js-diff-progressive-container, [data-hpc], .file-header');
        if (diffContainer) {
          clearInterval(checkInterval);
          console.log('[PR Lang Stats] PR page detected, starting analysis...');
          resolve();
        }
      }, 500);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('[PR Lang Stats] Timeout waiting for PR page, attempting analysis anyway...');
        resolve();
      }, 10000);
    });
  }

  extractPRInfo() {
    const url = window.location.pathname;
    const parts = url.split('/');
    return {
      owner: parts[1],
      repo: parts[2],
      prNumber: parts[4]
    };
  }

  async fetchFileLanguages(owner, repo) {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`);
      if (!response.ok) {
        console.warn('Could not fetch language data from GitHub API');
        return {};
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching languages:', error);
      return {};
    }
  }

  detectLanguageFromFilename(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    const extensionMap = {
      // Web
      'js': 'JavaScript',
      'jsx': 'JavaScript',
      'ts': 'TypeScript',
      'tsx': 'TypeScript',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'sass': 'Sass',
      'less': 'Less',
      'vue': 'Vue',
      
      // Backend
      'py': 'Python',
      'rb': 'Ruby',
      'php': 'PHP',
      'java': 'Java',
      'kt': 'Kotlin',
      'scala': 'Scala',
      'go': 'Go',
      'rs': 'Rust',
      'c': 'C',
      'cpp': 'C++',
      'cc': 'C++',
      'cxx': 'C++',
      'h': 'C/C++ Header',
      'hpp': 'C++ Header',
      'cs': 'C#',
      'swift': 'Swift',
      
      // Scripting
      'sh': 'Shell',
      'bash': 'Bash',
      'zsh': 'Zsh',
      'pl': 'Perl',
      'lua': 'Lua',
      
      // Data
      'json': 'JSON',
      'xml': 'XML',
      'yaml': 'YAML',
      'yml': 'YAML',
      'toml': 'TOML',
      'sql': 'SQL',
      
      // Markup
      'md': 'Markdown',
      'rst': 'reStructuredText',
      'tex': 'TeX',
      
      // Config
      'dockerfile': 'Dockerfile',
      'gitignore': 'Git Config',
      'env': 'Environment'
    };

    return extensionMap[ext] || 'Other';
  }

  async analyze() {
    const prInfo = this.extractPRInfo();
    this.languageStats.clear();

    // Get all file diffs
    const fileHeaders = document.querySelectorAll('.file-header');
    
    for (const header of fileHeaders) {
      const fileInfo = this.extractFileInfo(header);
      if (!fileInfo) continue;

      const language = this.detectLanguageFromFilename(fileInfo.filename);
      const stats = this.calculateFileStats(header.closest('.file'));

      if (!this.languageStats.has(language)) {
        this.languageStats.set(language, { added: 0, removed: 0, files: 0 });
      }

      const langStats = this.languageStats.get(language);
      langStats.added += stats.added;
      langStats.removed += stats.removed;
      langStats.files += 1;
    }

    this.displayStats();
  }

  extractFileInfo(header) {
    const titleElement = header.querySelector('[title]');
    if (!titleElement) return null;

    return {
      filename: titleElement.getAttribute('title') || titleElement.textContent.trim()
    };
  }

  calculateFileStats(fileElement) {
    const stats = { added: 0, removed: 0 };
    
    // Look for GitHub's diff stats
    const diffStats = fileElement.querySelector('.diffbar');
    if (diffStats) {
      const addedSpan = diffStats.querySelector('.diffstat-bar-added');
      const deletedSpan = diffStats.querySelector('.diffstat-bar-deleted');
      
      if (addedSpan) {
        stats.added = parseInt(addedSpan.getAttribute('aria-label')?.match(/\d+/)?.[0] || '0');
      }
      if (deletedSpan) {
        stats.removed = parseInt(deletedSpan.getAttribute('aria-label')?.match(/\d+/)?.[0] || '0');
      }
    }

    // Fallback: count diff lines manually
    if (stats.added === 0 && stats.removed === 0) {
      const lines = fileElement.querySelectorAll('.blob-code');
      lines.forEach(line => {
        if (line.classList.contains('blob-code-addition')) {
          stats.added++;
        } else if (line.classList.contains('blob-code-deletion')) {
          stats.removed++;
        }
      });
    }

    return stats;
  }

  displayStats() {
    // Remove existing stats panel if present
    const existingPanel = document.getElementById('pr-language-stats-panel');
    if (existingPanel) {
      existingPanel.remove();
    }

    // Find the PR header area to insert our stats
    const prHeader = document.querySelector('.gh-header-meta');
    if (!prHeader) {
      console.warn('Could not find PR header to insert stats');
      return;
    }

    const statsPanel = this.createStatsPanel();
    prHeader.parentNode.insertBefore(statsPanel, prHeader.nextSibling);
  }

  createStatsPanel() {
    const panel = document.createElement('div');
    panel.id = 'pr-language-stats-panel';
    panel.className = 'border rounded-2 p-3 mb-3';

    const header = document.createElement('h3');
    header.className = 'h5 mb-2';
    header.innerHTML = '📊 Language Statistics';
    panel.appendChild(header);

    const table = document.createElement('table');
    table.className = 'language-stats-table';
    
    // Calculate totals
    let totalAdded = 0;
    let totalRemoved = 0;
    this.languageStats.forEach(stats => {
      totalAdded += stats.added;
      totalRemoved += stats.removed;
    });

    // Sort languages by total lines changed
    const sortedLanguages = Array.from(this.languageStats.entries())
      .sort((a, b) => (b[1].added + b[1].removed) - (a[1].added + a[1].removed));

    // Create table rows
    for (const [language, stats] of sortedLanguages) {
      const row = document.createElement('tr');
      
      const percentage = totalAdded + totalRemoved > 0 
        ? ((stats.added + stats.removed) / (totalAdded + totalRemoved) * 100).toFixed(1)
        : 0;

      row.innerHTML = `
        <td class="language-name">${language}</td>
        <td class="language-files">${stats.files} file${stats.files > 1 ? 's' : ''}</td>
        <td class="language-added">+${stats.added}</td>
        <td class="language-removed">-${stats.removed}</td>
        <td class="language-percentage">${percentage}%</td>
      `;
      table.appendChild(row);
    }

    // Add totals row
    const totalRow = document.createElement('tr');
    totalRow.className = 'total-row';
    totalRow.innerHTML = `
      <td class="language-name"><strong>Total</strong></td>
      <td class="language-files"></td>
      <td class="language-added"><strong>+${totalAdded}</strong></td>
      <td class="language-removed"><strong>-${totalRemoved}</strong></td>
      <td class="language-percentage"><strong>100%</strong></td>
    `;
    table.appendChild(totalRow);

    panel.appendChild(table);
    return panel;
  }

  setupDOMObserver() {
    // Watch for PR page changes (e.g., switching tabs, lazy loading)
    this.observer = new MutationObserver(() => {
      const diffView = document.querySelector('.diff-view, .js-diff-progressive-container, [data-hpc], .file-header');
      if (diffView && !document.getElementById('pr-language-stats-panel')) {
        console.log('[PR Lang Stats] DOM changed, re-analyzing...');
        this.analyze();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new GitHubPRLanguageStats().init();
  });
} else {
  new GitHubPRLanguageStats().init();
}

