/**
 * Language Detection Utilities
 * Shared between the extension and tests
 */

export function detectLanguageFromFilename(filename) {
  const ext = filename.split('.').pop().toLowerCase();

  const extensionMap = {
    // Web
    js: 'JavaScript',
    jsx: 'JavaScript',
    ts: 'TypeScript',
    tsx: 'TypeScript',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sass: 'Sass',
    less: 'Less',
    vue: 'Vue',

    // Backend
    py: 'Python',
    rb: 'Ruby',
    php: 'PHP',
    java: 'Java',
    kt: 'Kotlin',
    scala: 'Scala',
    go: 'Go',
    rs: 'Rust',
    c: 'C',
    cpp: 'C++',
    cc: 'C++',
    cxx: 'C++',
    h: 'C/C++ Header',
    hpp: 'C++ Header',
    cs: 'C#',
    swift: 'Swift',

    // Scripting
    sh: 'Shell',
    bash: 'Bash',
    zsh: 'Zsh',
    pl: 'Perl',
    lua: 'Lua',

    // Data
    json: 'JSON',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML',
    toml: 'TOML',
    sql: 'SQL',

    // Markup
    md: 'Markdown',
    rst: 'reStructuredText',
    tex: 'TeX',

    // Config
    dockerfile: 'Dockerfile',
    gitignore: 'Git Config',
    env: 'Environment',
  };

  return extensionMap[ext] || 'Other';
}

export function calculateLanguageStats(files) {
  const languageStats = new Map();

  for (const file of files) {
    const language = detectLanguageFromFilename(file.filename);

    if (!languageStats.has(language)) {
      languageStats.set(language, { added: 0, removed: 0, files: 0 });
    }

    const stats = languageStats.get(language);
    stats.added += file.additions;
    stats.removed += file.deletions;
    stats.files += 1;
  }

  return languageStats;
}

export function calculateTotals(languageStats) {
  let totalAdded = 0;
  let totalRemoved = 0;
  let totalFiles = 0;

  for (const stats of languageStats.values()) {
    totalAdded += stats.added;
    totalRemoved += stats.removed;
    totalFiles += stats.files;
  }

  return { totalAdded, totalRemoved, totalFiles };
}
