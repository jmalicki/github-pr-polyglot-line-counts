# Changelog

## v0.0.2 (Current)

### 🚀 Features
- Language statistics breakdown (40+ languages)
- Estimated review time with complexity awareness
- Exclude generated files toggle (like Better Line Counts)
- GitHub API support for huge PRs (75+ files)
- Pagination support (up to 1000 files)
- Rate limit error handling with user-friendly messages

### ⚡ Performance
- Early API fetch (parallel with page load) - 33% faster
- Zero layout shift (skeleton placeholder)
- Atomic rendering (no jitter/flicker)
- Headless E2E tests (fast CI/CD)

### 🐛 Fixes
- Race condition eliminated (stable file count detection)
- Scroll position locked (no jumping)
- MutationObserver disabled (no post-render jitter)
- Incremental painting prevented (HTML string building)
- New file detection (87% of changes in test PR)

### 🧪 Testing
- 20 unit tests (passing)
- E2E tests with screenshots
- Visual timeline debugging (10ms granularity)
- DOM snapshot capture
- GitHub API validation

## v0.0.1 (Initial)

### Features
- Basic Chrome extension structure
- Language detection (40+ languages)
- DOM-based stat extraction
- GitHub-styled UI

---

**Total:** 29 commits, production-ready
