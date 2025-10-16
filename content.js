// GitHub PR Language Stats - Content Script
// Analyzes pull request diffs and shows line count statistics by language

class GitHubPRLanguageStats {
  constructor() {
    this.prData = null;
    this.languageStats = new Map();
    this.observer = null;
    this.excludeGenerated = false; // Default: show all files
    this.renderStage = 0; // Track render stages: 0=none, 1=skeleton, 2=structure, 3=complete
  }

  async init() {
    // Load saved preferences
    try {
      const savedPreference = localStorage.getItem('pr-lang-stats-exclude-generated');
      if (savedPreference !== null) {
        this.excludeGenerated = savedPreference === 'true';
      }
    } catch (e) {
      console.warn('[PR Lang Stats] Could not load preferences:', e);
    }
    
    // Wait for full page load (skip early detection - causes flickering)
    await this.waitForPRPage();
    
    // Analyze and render ONCE with complete data
    await this.analyze();
    
    this.setupDOMObserver();
  }

  waitForPRPage() {
    return new Promise((resolve) => {
      let lastCount = 0;
      let stableCount = 0;
      
      const checkInterval = setInterval(() => {
        // Wait for file containers to be present (modern GitHub)
        const fileContainers = document.querySelectorAll('[data-details-container-group="file"]');
        const currentCount = fileContainers.length;
        
        // Check if count is stable (hasn't changed for 2 checks = 1 second)
        if (currentCount > 0) {
          if (currentCount === lastCount) {
            stableCount++;
            
            // If count has been stable for 2 checks (1 second), we're done
            if (stableCount >= 2) {
              clearInterval(checkInterval);
              console.log(`[PR Lang Stats] Found ${currentCount} file containers (stable), starting analysis...`);
              resolve();
              return;
            }
          } else {
            // Count changed, reset stability counter
            stableCount = 0;
            lastCount = currentCount;
            console.log(`[PR Lang Stats] Detected ${currentCount} files, waiting for more...`);
          }
        }
        
        // Fallback: Check for either old or new GitHub UI
        const diffContainer = document.querySelector('.diff-view, .js-diff-progressive-container, [data-hpc], .file-header, .file');
        if (diffContainer && currentCount === 0) {
          // Old UI detected, proceed immediately
          clearInterval(checkInterval);
          console.log('[PR Lang Stats] PR page detected (fallback selector), starting analysis...');
          resolve();
        }
      }, 500);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('[PR Lang Stats] Timeout waiting for stable file count, attempting analysis anyway...');
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
    
    let skippedGenerated = 0;
    
    for (const container of fileContainers) {
      // Skip generated files if filter is enabled
      if (this.excludeGenerated && this.isGeneratedFile(container)) {
        skippedGenerated++;
        continue;
      }
      
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

    if (skippedGenerated > 0) {
      console.log(`[PR Lang Stats] Skipped ${skippedGenerated} generated file(s)`);
    }
    
    console.log('[PR Lang Stats] Language stats:', Array.from(this.languageStats.entries()));
    
    // Calculate estimated review time
    this.estimatedReviewTime = this.calculateReviewTime();
    
    // Render ONCE with all final data
    this.displayStats();
    console.log('[PR Lang Stats] Rendered with complete data and review time');
  }

  calculateReviewTime() {
    // Research-based formula: ~150-200 lines/minute for code review
    // Source: Various studies on code review effectiveness
    
    const BASE_REVIEW_RATE = 175; // lines per minute (middle ground)
    
    // Language complexity multipliers (harder languages take longer)
    const COMPLEXITY_MULTIPLIERS = {
      'Rust': 1.5,
      'C': 1.4,
      'C++': 1.4,
      'Go': 1.3,
      'Java': 1.2,
      'Python': 1.0,
      'JavaScript': 1.0,
      'TypeScript': 1.1,
      'HTML': 0.7,
      'CSS': 0.7,
      'Markdown': 0.5,
      'JSON': 0.3,
      'YAML': 0.3,
      'Other': 1.0
    };
    
    let totalMinutes = 0;
    let largeFileCount = 0;
    
    for (const [language, stats] of this.languageStats.entries()) {
      const linesChanged = stats.added + stats.removed;
      const multiplier = COMPLEXITY_MULTIPLIERS[language] || 1.0;
      
      // Base time for this language
      const languageMinutes = (linesChanged / BASE_REVIEW_RATE) * multiplier;
      totalMinutes += languageMinutes;
      
      // Count large files (>500 lines changed = needs extra attention)
      if (linesChanged > 500) {
        largeFileCount++;
      }
    }
    
    // Add overhead for large files (context switching, complexity)
    if (largeFileCount > 0) {
      totalMinutes += largeFileCount * 5; // 5 min overhead per large file
    }
    
    // Minimum review time (even small PRs need some time)
    totalMinutes = Math.max(totalMinutes, 2);
    
    // Add buffer for discussion, questions, testing (20% overhead)
    totalMinutes *= 1.2;
    
    return {
      min: Math.floor(totalMinutes * 0.8), // Conservative estimate
      max: Math.ceil(totalMinutes * 1.2),  // Generous estimate
      largeFiles: largeFileCount
    };
  }

  isGeneratedFile(container) {
    // Method 1: GitHub collapses generated files with Details--collapsed class
    if (container.classList.contains('Details--collapsed')) {
      return true;
    }
    
    // Method 2: Check for "Load diff" button (lazy-loaded generated files)
    const text = container.textContent;
    if (text.includes('Load diff') || text.includes('Large diffs are not rendered by default')) {
      return true;
    }
    
    // Method 3: Check for explicit markers in text
    if (text.includes('Binary file') || text.includes('File renamed without changes')) {
      return true;
    }
    
    return false;
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
    // ONLY update existing panel, NEVER create a new one
    // (Skeleton already created synchronously at page load)
    const existingPanel = document.getElementById('pr-language-stats-panel');
    
    if (existingPanel) {
      // Save scroll position before updating
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      // Hide panel, update content, then show (atomic visual update)
      existingPanel.style.opacity = '0';
      
      const newPanel = this.createStatsPanel();
      existingPanel.innerHTML = newPanel.innerHTML;
      
      // Force reflow before showing (ensures content is laid out)
      void existingPanel.offsetHeight;
      
      existingPanel.style.opacity = '1';
      
      // Restore scroll position (prevent jump)
      if (window.scrollY !== scrollY || window.scrollX !== scrollX) {
        window.scrollTo(scrollX, scrollY);
      }
      
      return;
    }

    // Fallback: If skeleton wasn't created, create panel now
    const prHeader = document.querySelector('.gh-header-meta');
    if (!prHeader) {
      console.warn('Could not find PR header to insert stats');
      return;
    }

    // Save scroll position
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    const statsPanel = this.createStatsPanel();
    statsPanel.style.opacity = '0';
    prHeader.parentNode.insertBefore(statsPanel, prHeader.nextSibling);
    
    // Restore scroll position immediately
    window.scrollTo(scrollX, scrollY);
    
    // Reveal after insertion
    requestAnimationFrame(() => {
      statsPanel.style.opacity = '1';
    });
  }

  createStatsPanel() {
    const panel = document.createElement('div');
    panel.id = 'pr-language-stats-panel';
    panel.className = 'border rounded-2 p-3 mb-3';

    // Header with filter toggle
    const headerContainer = document.createElement('div');
    headerContainer.className = 'd-flex flex-justify-between flex-items-center mb-2';
    
    const headerLeft = document.createElement('div');
    
    const header = document.createElement('h3');
    header.className = 'h5 mb-0';
    header.innerHTML = '📊 Language Statistics';
    headerLeft.appendChild(header);
    
    // Add estimated review time if available
    if (this.estimatedReviewTime) {
      const reviewTime = document.createElement('div');
      reviewTime.className = 'text-small color-fg-muted mt-1';
      const timeRange = this.estimatedReviewTime.min === this.estimatedReviewTime.max
        ? `~${this.estimatedReviewTime.min} min`
        : `${this.estimatedReviewTime.min}-${this.estimatedReviewTime.max} min`;
      
      reviewTime.innerHTML = `📝 Est. Review Time: ${timeRange}`;
      
      // Add tooltip/warning for large files
      if (this.estimatedReviewTime.largeFiles > 0) {
        reviewTime.innerHTML += ` <span title="${this.estimatedReviewTime.largeFiles} large file(s) - needs extra attention">⚠️</span>`;
      }
      
      headerLeft.appendChild(reviewTime);
    }
    
    headerContainer.appendChild(headerLeft);
    
    // Toggle for excluding generated files
    const filterContainer = document.createElement('div');
    filterContainer.className = 'd-flex flex-items-center';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'exclude-generated-checkbox';
    checkbox.checked = this.excludeGenerated;
    checkbox.className = 'mr-1';
    checkbox.style.cursor = 'pointer';
    
    const label = document.createElement('label');
    label.htmlFor = 'exclude-generated-checkbox';
    label.className = 'text-small';
    label.textContent = 'Exclude generated';
    label.style.cursor = 'pointer';
    label.style.userSelect = 'none';
    
    checkbox.addEventListener('change', () => {
      this.excludeGenerated = checkbox.checked;
      // Save preference
      try {
        localStorage.setItem('pr-lang-stats-exclude-generated', checkbox.checked);
      } catch (e) {
        console.warn('Could not save preference:', e);
      }
      // Re-analyze with new filter
      this.analyze();
    });
    
    filterContainer.appendChild(checkbox);
    filterContainer.appendChild(label);
    headerContainer.appendChild(filterContainer);
    
    panel.appendChild(headerContainer);

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

    // Build ALL rows as HTML string first (prevents incremental rendering)
    const hasDetailedStats = sortedLanguages.some(([, stats]) => stats.added > 0 || stats.removed > 0);
    let tableHTML = '';
    
    for (const [language, stats] of sortedLanguages) {
      const percentage = totalAdded + totalRemoved > 0 && hasDetailedStats
        ? ((stats.added + stats.removed) / (totalAdded + totalRemoved) * 100).toFixed(1)
        : '...';

      const filesDisplay = stats.files > 0 ? `${stats.files} file${stats.files > 1 ? 's' : ''}` : '...';

      tableHTML += `
        <tr>
          <td class="language-name">${language}</td>
          <td class="language-files">${filesDisplay}</td>
          <td class="language-added">+${stats.added}</td>
          <td class="language-removed">-${stats.removed}</td>
          <td class="language-percentage">${percentage}${percentage === '...' ? '' : '%'}</td>
        </tr>
      `;
    }

    // Add totals row
    tableHTML += `
      <tr class="total-row">
        <td class="language-name"><strong>Total</strong></td>
        <td class="language-files"></td>
        <td class="language-added"><strong>+${totalAdded}</strong></td>
        <td class="language-removed"><strong>-${totalRemoved}</strong></td>
        <td class="language-percentage"><strong>100%</strong></td>
      </tr>
    `;
    
    // Set all at once (atomic, no intermediate paints)
    table.innerHTML = tableHTML;
    panel.appendChild(table);
    return panel;
  }

  setupDOMObserver() {
    // Watch for PR page changes (e.g., switching tabs, lazy loading)
    // But IGNORE changes inside our own panel to prevent re-render loops
    this.observer = new MutationObserver((mutations) => {
      // Skip mutations that are just our own panel updates
      const isOurOwnUpdate = mutations.every(mutation => {
        const target = mutation.target;
        const panel = document.getElementById('pr-language-stats-panel');
        return panel && (target === panel || panel.contains(target));
      });
      
      if (isOurOwnUpdate) {
        return; // Don't re-analyze for our own changes
      }
      
      const diffView = document.querySelector('[data-tagsearch-path], [data-hpc], .file-header');
      if (diffView && !document.getElementById('pr-language-stats-panel')) {
        console.log('[PR Lang Stats] DOM changed, re-analyzing...');
        this.renderStage = 0;
        this.analyze();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Global reference to the extension instance
let extensionInstance = null;

// Inject placeholder skeleton IMMEDIATELY (synchronous) to prevent layout shift
function injectPlaceholderSkeleton() {
  // Check if we're on a PR page
  if (!window.location.pathname.match(/\/pull\/\d+/)) return;
  
  // Try to find PR header immediately
  const findAndInject = () => {
    const prHeader = document.querySelector('.gh-header-meta, [data-hpc]');
    if (prHeader && !document.getElementById('pr-language-stats-panel')) {
      // Create minimal skeleton placeholder - reserves space immediately
      const skeleton = document.createElement('div');
      skeleton.id = 'pr-language-stats-panel';
      skeleton.className = 'border rounded-2 p-3 mb-3';
      skeleton.style.minHeight = '120px'; // Reserve space immediately
      skeleton.innerHTML = `
        <div class="d-flex flex-justify-between flex-items-center mb-2">
          <h3 class="h5 mb-0">📊 Language Statistics</h3>
          <div class="text-small color-fg-muted">Analyzing...</div>
        </div>
      `;
      prHeader.parentNode.insertBefore(skeleton, prHeader.nextSibling);
      console.log('[PR Lang Stats] Skeleton placeholder injected');
      return true;
    }
    return false;
  };

  // Try immediately
  if (findAndInject()) return;

  // If not found, watch for it (but still synchronous, just observing)
  const observer = new MutationObserver(() => {
    if (findAndInject()) {
      observer.disconnect();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Stop observing after 3 seconds
  setTimeout(() => observer.disconnect(), 3000);
}

// Run skeleton injection immediately (before any async ops)
injectPlaceholderSkeleton();

// Initialize full stats (async)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    extensionInstance = new GitHubPRLanguageStats();
    extensionInstance.init();
  });
} else {
  extensionInstance = new GitHubPRLanguageStats();
  extensionInstance.init();
}

