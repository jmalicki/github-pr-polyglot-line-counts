# Feature Ideas

Based on available GitHub data, here are potential enhancements:

## 🔥 High Impact Features

### 1. **Filter by File Category**
```javascript
// Detect from file paths
- Tests: /test/, /spec/, /__tests__/, .test., .spec.
- Docs: /docs/, README, .md files  
- Config: package.json, Cargo.toml, .yml, .config.
- Generated: .pb.go, .generated., /dist/, /build/
```

**UI**: Toggle buttons to show/hide categories
**Value**: See only production code changes

### 2. **New vs Modified vs Deleted Breakdown**
```javascript
// Already have: data-file-deleted attribute
const status = file.getAttribute('data-file-deleted') === 'true' ? 'deleted' : 
               stats.removed === 0 ? 'new' : 'modified';
```

**UI**: Separate rows for New (+1988) vs Modified (+304 -216)
**Value**: Understand change type at a glance

### 3. **Code Owner Statistics**  
```javascript
// If data-codeowners attribute exists
const owner = file.getAttribute('data-codeowners');
// Group stats by team/owner
```

**UI**: "Changes by Team" breakdown
**Value**: See which teams are affected

### 4. **Large Diff Warning**
```javascript
// Detect files >500 lines changed
if (stats.added + stats.removed > 500) {
  // Mark as "Large Diff" - needs extra review
}
```

**UI**: 🔴 indicator on large files
**Value**: Focus review effort

## 🎨 Visual Enhancements

### 5. **Test Coverage Indicator**
```javascript
// Compare test files vs source files
const sourceFiles = files.filter(f => !isTestFile(f));
const testFiles = files.filter(f => isTestFile(f));
const ratio = testFiles.length / sourceFiles.length;
```

**UI**: Test coverage badge (e.g., "3 tests for 5 source files")

### 6. **Binary File Alert**
```javascript
// Detect from text content
if (container.textContent.includes('Binary file')) {
  // Show separately
}
```

**UI**: Separate "Binary Files" section

### 7. **Comment Density**
```javascript
// Count files with review comments
const filesWithComments = files.filter(f => 
  f.querySelector('.review-comment')
).length;
```

**UI**: "🗨️ 2/8 files have comments"

## 🚀 Advanced Features

### 8. **Integration with .gitattributes**
```javascript
// Fetch and parse .gitattributes
const response = await fetch(`${repoUrl}/.gitattributes`);
const gitattributes = parseGitattributes(await response.text());

// Apply linguist rules
files.forEach(file => {
  if (matchesPattern(file.path, gitattributes.generated)) {
    file.isGenerated = true;
  }
});
```

**UI**: "Exclude Generated" checkbox (like Better Line Counts!)
**Value**: True code review size

### 9. **Framework Detection**
```javascript
// Detect project type from changed files
const frameworks = detectFrameworks(files);
// package.json → Node.js
// Cargo.toml → Rust
// go.mod → Go
// requirements.txt → Python
```

**UI**: Show framework icons

### 10. **Export Statistics**
```javascript
// Generate CSV/JSON
const csv = generateCSV(languageStats);
// Download button
```

**UI**: "📥 Export" button
**Value**: Track stats over time

## 💾 Data We Can Access

### Immediately Available:
- ✅ File path (`data-tagsearch-path`)
- ✅ File type (`data-file-type`)  
- ✅ Deleted status (`data-file-deleted`)
- ✅ Line counts (from text)
- ✅ File status (new/modified from stats)

### Requires Parsing:
- 📄 .gitattributes (linguist-generated, linguist-vendored)
- 📄 CODEOWNERS file (team assignments)
- 📄 Test framework config (detect test patterns)

### From GitHub API:
- 🌐 PR metadata (author, reviewers, labels)
- 🌐 Commit SHAs (link to commits)
- 🌐 Language percentages (repo-wide)

## 🎯 Quick Wins (Easy to Add)

1. **Filter Tests** - Check if path contains `/test/` or `.test.`
2. **Show Deleted Files** - Use `data-file-deleted` attribute
3. **Detect Config Files** - Match common config filenames
4. **Large Diff Warning** - Flag files >500 lines
5. **New vs Modified** - Check if `deletions === 0`

## 🏆 Premium Features (More Complex)

1. **Parse .gitattributes** - Exclude generated/vendored
2. **Code Owner Stats** - Group by team
3. **Test Coverage** - Calculate test-to-source ratio
4. **Historical Tracking** - Store stats in localStorage
5. **Custom Filters** - User-defined path patterns

---

**Which features would add the most value?**

