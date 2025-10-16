# GitHub API Research - Null Data Issue

## Problem

When fetching PR data via API, some large PRs return `null` for:
- `additions` 
- `deletions`
- `changed_files`

Example: `arsync/pull/33` (75 files, massive PR)

## Hypothesis

Based on GitHub API behavior:

### 1. **300 File Limit**
GitHub's PR files endpoint has a hard limit of 300 files total.
- PRs with >300 files: API returns only first 300
- This is documented in GitHub's API docs
- Pagination works up to 300 files (3 pages × 100)

### 2. **Diff Generation Timeout**
For extremely large PRs, GitHub may:
- Timeout computing the diff
- Return `null` for aggregate stats
- Still return individual file stats

### 3. **Our Solution**

**When PR totals are `null`:**
```javascript
// Fallback: Calculate totals from individual files
const totals = {
  additions: files.reduce((sum, f) => sum + f.additions, 0),
  deletions: files.reduce((sum, f) => sum + f.deletions, 0),
  changed_files: files.length
};
```

**When we hit 300 file limit:**
```javascript
if (allFiles.length === 300 && hasMore) {
  // Show warning: "⚠️ PR has >300 files. Showing first 300."
}
```

## Implementation Plan

### Code Changes:

```javascript
async analyzeViaAPI(prInfo) {
  // Fetch files (up to 300)
  const allFiles = await this.fetchAllFiles(prInfo);
  
  // Check if we hit the 300 file limit
  if (allFiles.length === 300) {
    console.warn('Hit 300 file limit');
    this.showWarning('PR has >300 files. Showing first 300.');
  }
  
  // Calculate our own totals (don't trust PR.additions/deletions)
  const totals = this.calculateTotalsFromFiles(allFiles);
  
  // Continue with analysis...
}
```

### Test Cases (to run when rate limit resets):

1. **Test: PR with null totals**
   - Fetch PR #33
   - Verify we calculate totals from files
   - Validate accuracy

2. **Test: PR approaching 300 files**
   - Mock 290 files
   - Verify no warning
   - Verify accuracy

3. **Test: PR exceeding 300 files**
   - Mock 350 files (API returns 300)
   - Verify warning shown
   - Verify we show "first 300"

4. **Test: Rate limit error**
   - Mock 403 response
   - Verify error message
   - Verify UI shows flash-error

## Authentication Benefits

**Unauthenticated:**
- 60 requests/hour
- Might hit limit during heavy use

**Authenticated (real users):**
- 5,000 requests/hour
- Essentially unlimited for normal use
- Could add OAuth flow in future

## Rate Limit Strategy

**Current (Good Enough):**
- Show error message
- Ask user to refresh later

**Future Enhancement:**
- Offer "Sign in to GitHub" button
- Use OAuth to get higher limit
- Cache results in localStorage
- Show remaining quota

## Edge Cases

1. **Private repos**: API fails → Show error
2. **Network offline**: Timeout → Show error
3. **GitHub down**: 500 error → Show error
4. **Malformed response**: Parse error → Show error

All errors should show user-friendly message in panel.

---

**Status**: Solution prepared, waiting for rate limit reset to test

