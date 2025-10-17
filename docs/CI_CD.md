# CI/CD Setup

## Pre-commit Hooks

Every commit automatically runs:
1. **ESLint --fix** on JS files
2. **Prettier --write** on all files  
3. Only commits if no errors

Powered by: Husky + lint-staged

## GitHub Actions

### CI Workflow (`.github/workflows/ci.yml`)

Runs on: Push to main, Pull requests

**Jobs:**
1. **Lint** - ESLint + Prettier check
2. **Test** - All 24 unit tests
3. **E2E** - Puppeteer tests (headless)
4. **Build** - Extension structure validation

### Test Coverage (`.github/workflows/test-coverage.yml`)

Runs on: Push to main

Uploads coverage to Codecov (if configured)

## Commands

```bash
# Local development
npm run lint          # Check for errors
npm run lint:fix      # Auto-fix errors
npm run format        # Format all files
npm run format:check  # Check formatting

# Testing
npm test              # Unit tests
npm run test:watch    # Watch mode
npm run test:e2e      # E2E tests

# CI simulation
npm run lint && npm test && npm run test:e2e
```

## What Gets Checked

✅ **Code Quality:**
- ESLint rules enforced
- Consistent formatting (Prettier)
- No unused variables
- No unnecessary escapes

✅ **Functionality:**
- 24 unit tests pass
- E2E tests pass
- Extension loads correctly
- API integration works

✅ **Structure:**
- manifest.json valid
- All required files present
- Icons exist

## Artifacts

CI uploads:
- Test coverage reports
- E2E screenshots  
- Available in Actions tab

## Status Badge

Add to README.md:
```markdown
![CI](https://github.com/YOUR_USERNAME/github-linecount/workflows/CI/badge.svg)
```
