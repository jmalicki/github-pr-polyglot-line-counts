// GitHub PR Language Stats - Content Script
// Analyzes pull request diffs and shows line count statistics by language

class GitHubPRLanguageStats {
  constructor() {
    this.prData = null;
    this.languageStats = new Map();
    this.observer = null;
  }

  async init() {
    // Early initialization: detect languages from file tree ASAP to reserve space
    await this.quickDetectLanguages();
    
    // Wait for full page load and stats
    await this.waitForPRPage();
    await this.analyze();
    this.setupDOMObserver();
  }

  async quickDetectLanguages() {
    // Find file tree items that load immediately (before full diffs)
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        // File tree sidebar loads first
        const treeItems = document.querySelectorAll('[data-tagsearch-path], [data-path]');
        
        if (treeItems.length > 0) {
          clearInterval(checkInterval);
          console.log(`[PR Lang Stats] Quick scan: found ${treeItems.length} files in tree`);
          
          // Step 1: Extract totals immediately from tree text
          let totalAdded = 0;
          let totalRemoved = 0;
          const languages = new Set();
          
          treeItems.forEach(item => {
            const text = item.textContent;
            const path = item.getAttribute('data-tagsearch-path') || 
                        item.getAttribute('data-path');
            
            // Parse totals from text like "325 additions & 0 deletions"
            const statsPattern = /(\d+)\s+addition(?:s)?\s+&\s+(\d+)\s+deletion(?:s)?/;
            const match = text.match(statsPattern);
            if (match) {
              totalAdded += parseInt(match[1]);
              totalRemoved += parseInt(match[2]);
            }
            
            // Detect language
            if (path) {
              const language = this.detectLanguageFromFilename(path);
              languages.add(language);
            }
          });
          
          // Initialize with totals but zero per-language (will be filled later)
          languages.forEach(lang => {
            this.languageStats.set(lang, { added: 0, removed: 0, files: 0 });
          });
          
          // Store totals temporarily for display
          this.earlyTotals = { totalAdded, totalRemoved };
          
          // Display panel with totals immediately (zero layout shift!)
          this.displayStats();
          console.log(`[PR Lang Stats] Showing early totals: +${totalAdded} -${totalRemoved}, ${languages.size} languages detected`);
          resolve();
        }
      }, 100); // Check more frequently for early detection
      
      // Don't wait forever
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 3000);
    });
  }

  waitForPRPage() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        // Wait for file containers to be present (modern GitHub)
        const fileContainers = document.querySelectorAll('[data-details-container-group="file"]');
        
        // Fallback: Check for either old or new GitHub UI
        const diffContainer = document.querySelector('.diff-view, .js-diff-progressive-container, [data-hpc], .file-header, .file');
        
        // Resolve when we have containers with content
        if (fileContainers.length > 0) {
          clearInterval(checkInterval);
          console.log(`[PR Lang Stats] Found ${fileContainers.length} file containers, starting analysis...`);
          resolve();
        } else if (diffContainer) {
          clearInterval(checkInterval);
          console.log('[PR Lang Stats] PR page detected (fallback selector), starting analysis...');
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

    // Modern GitHub uses .file-info containers with data-details-container-group="file"
    // These contain both the filename and the diff/stats
    let fileContainers = document.querySelectorAll('[data-details-container-group="file"]');
    
    // Fallback to old selectors if new ones not found
    if (fileContainers.length === 0) {
      fileContainers = document.querySelectorAll('.file');
    }
    
    console.log('[PR Lang Stats] Found', fileContainers.length, 'file containers');
    
    for (const container of fileContainers) {
      const fileInfo = this.extractFileInfo(container);
      if (!fileInfo) continue;

      const language = this.detectLanguageFromFilename(fileInfo.filename);
      const stats = this.calculateFileStats(container);

      if (!this.languageStats.has(language)) {
        this.languageStats.set(language, { added: 0, removed: 0, files: 0 });
      }

      const langStats = this.languageStats.get(language);
      langStats.added += stats.added;
      langStats.removed += stats.removed;
      langStats.files += 1;
    }

    console.log('[PR Lang Stats] Language stats:', Array.from(this.languageStats.entries()));
    this.displayStats();
  }

  extractFileInfo(container) {
    // Try multiple ways to get the filename, prioritizing data attributes
    let filename = null;
    
    // Method 1: data-tagsearch-path attribute (most reliable for modern GitHub)
    filename = container.getAttribute('data-tagsearch-path');
    
    // Method 2: data-path attribute
    if (!filename) {
      filename = container.getAttribute('data-path');
    }
    
    // Method 3: Look for data-tagsearch-path or data-path on nested elements
    if (!filename) {
      const pathElement = container.querySelector('[data-tagsearch-path], [data-path]');
      if (pathElement) {
        filename = pathElement.getAttribute('data-tagsearch-path') || 
                   pathElement.getAttribute('data-path');
      }
    }
    
    // Method 4: Parse from text content (GitHub shows "{changes} changes: ... {filename}")
    if (!filename) {
      const text = container.textContent;
      // Look for patterns like "crates/compio-sync/src/condvar.rs" in the text
      const pathMatch = text.match(/([a-zA-Z0-9_\-/.]+\.[a-z]+)/);
      if (pathMatch) {
        filename = pathMatch[1];
      }
    }
    
    // Method 5: title attribute (fallback)
    if (!filename) {
      const titleElement = container.querySelector('[title]');
      if (titleElement) {
        filename = titleElement.getAttribute('title') || titleElement.textContent.trim();
      }
    }
    
    // Method 6: clipboard-copy attribute
    if (!filename) {
      const copyElement = container.querySelector('clipboard-copy');
      if (copyElement) {
        filename = copyElement.getAttribute('value');
      }
    }
    
    if (!filename) {
      console.warn('[PR Lang Stats] Could not extract filename from container:', container);
      return null;
    }

    return { filename };
  }

  calculateFileStats(fileElement) {
    const stats = { added: 0, removed: 0 };
    
    // Method 1: Parse from text (modern GitHub format)
    // Format: "325 changes: 325 additions & 0 deletions" or "118 changes: 62 additions & 56 deletions"
    // Match the pattern: "{number} addition(s) & {number} deletion(s)"
    const text = fileElement.textContent;
    const statsPattern = /(\d+)\s+addition(?:s)?\s+&\s+(\d+)\s+deletion(?:s)?/;
    const match = text.match(statsPattern);
    
    if (match) {
      stats.added = parseInt(match[1]);
      stats.removed = parseInt(match[2]);
    } else {
      // Try individual patterns if the full pattern doesn't match
      const additionsMatch = text.match(/(\d+)\s+addition/);
      const deletionsMatch = text.match(/(\d+)\s+deletion/);
      
      if (additionsMatch) {
        stats.added = parseInt(additionsMatch[1]);
      }
      if (deletionsMatch) {
        stats.removed = parseInt(deletionsMatch[1]);
      }
    }
    
    // Method 2: Look for GitHub's diff stats bar (older GitHub UI)
    if (stats.added === 0 && stats.removed === 0) {
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
    }

    // Method 3: Fallback - count diff lines manually
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
    // Update existing panel if present, otherwise create new one
    const existingPanel = document.getElementById('pr-language-stats-panel');
    
    if (existingPanel) {
      // Update existing panel content (avoids layout shift)
      const newPanel = this.createStatsPanel();
      existingPanel.innerHTML = newPanel.innerHTML;
      return;
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
    
    // Calculate totals (use early totals if available for progressive display)
    let totalAdded = 0;
    let totalRemoved = 0;
    
    this.languageStats.forEach(stats => {
      totalAdded += stats.added;
      totalRemoved += stats.removed;
    });
    
    // If we have early totals but no detailed stats yet, use early totals
    if (totalAdded === 0 && totalRemoved === 0 && this.earlyTotals) {
      totalAdded = this.earlyTotals.totalAdded;
      totalRemoved = this.earlyTotals.totalRemoved;
    }

    // Sort languages by total lines changed
    const sortedLanguages = Array.from(this.languageStats.entries())
      .sort((a, b) => (b[1].added + b[1].removed) - (a[1].added + a[1].removed));

    // Create table rows (show placeholder if we only have language names, not stats yet)
    const hasDetailedStats = sortedLanguages.some(([, stats]) => stats.added > 0 || stats.removed > 0);
    
    for (const [language, stats] of sortedLanguages) {
      const row = document.createElement('tr');
      
      const percentage = totalAdded + totalRemoved > 0 && hasDetailedStats
        ? ((stats.added + stats.removed) / (totalAdded + totalRemoved) * 100).toFixed(1)
        : '...';

      const filesDisplay = stats.files > 0 ? `${stats.files} file${stats.files > 1 ? 's' : ''}` : '...';

      row.innerHTML = `
        <td class="language-name">${language}</td>
        <td class="language-files">${filesDisplay}</td>
        <td class="language-added">+${stats.added}</td>
        <td class="language-removed">-${stats.removed}</td>
        <td class="language-percentage">${percentage}${percentage === '...' ? '' : '%'}</td>
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
      // Use data attributes for more reliable detection
      const diffView = document.querySelector('[data-tagsearch-path], [data-hpc], .file-header');
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

