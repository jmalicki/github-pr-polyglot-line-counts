# Testing

This directory contains automated tests for the GitHub PR Language Stats extension.

## Test Structure

```
tests/
├── e2e/                    # End-to-end tests with Puppeteer
│   ├── run-tests.js       # Main test runner
│   └── screenshot-utils.js # Screenshot helper utilities
└── screenshots/           # Generated screenshots (gitignored)
```

## Running Tests

### E2E Tests with Screenshots

Run the full end-to-end test suite:

```bash
npm run test:e2e
```

This will:
1. Launch Chrome with the extension loaded
2. Navigate to a real GitHub PR
3. Verify the language stats panel appears
4. Take multiple screenshots documenting the extension behavior
5. Extract and display the language statistics
6. Keep the browser open for 30 seconds for manual inspection

### Screenshots Generated

The test creates several screenshots in `tests/screenshots/`:

1. `01-pr-page-loaded.png` - Initial PR page load
2. `02-language-stats-panel.png` - Page with stats panel visible
3. `03-panel-closeup.png` - Close-up of just the stats panel
4. `04-files-changed-tab.png` - Files changed tab view
5. `05-full-page.png` - Full page reference screenshot

### Screenshot Utilities

The `screenshot-utils.js` provides advanced screenshot capabilities:

```javascript
import { ScreenshotHelper } from './screenshot-utils.js';

const helper = new ScreenshotHelper(page, screenshotsDir);

// Full page screenshot
await helper.fullPage('my-test');

// Viewport only
await helper.viewport('visible-area');

// Specific element
await helper.element('#my-element', 'element-capture');

// Element with highlight
await helper.elementWithHighlight('#my-element', 'highlighted', {
  color: 'red',
  width: 3,
  padding: 10
});

// Before/after comparison
await helper.comparison('action-test', 
  null, // before action (optional)
  async () => { /* perform action */ }
);

// Custom clip region
await helper.clip({ x: 100, y: 200, width: 300, height: 400 }, 'cropped');

// Annotated screenshot
await helper.annotated('annotated-view', [
  { x: 100, y: 100, text: 'Panel here', color: 'red' },
  { x: 300, y: 200, text: 'Stats here', color: 'blue' }
]);
```

## Unit Tests (Future)

Unit tests will be added for testing individual functions:

```bash
npm run test           # Run once
npm run test:watch     # Watch mode
npm run test:ui        # Open Vitest UI
npm run test:coverage  # Generate coverage report
```

## Writing New Tests

### E2E Test Template

```javascript
import puppeteer from 'puppeteer';
import { ScreenshotHelper } from './screenshot-utils.js';

async function testFeature() {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const page = await browser.newPage();
  const screenshots = new ScreenshotHelper(page, './screenshots');

  try {
    await page.goto('https://github.com/...');
    await screenshots.viewport('initial-state');
    
    // Your test logic here
    
    await screenshots.fullPage('final-state');
  } finally {
    await browser.close();
  }
}
```

## Debugging

- Tests run in **headed mode** by default so you can see what's happening
- Browser stays open for 30 seconds after tests complete
- Error screenshots are automatically captured on failure
- Check `tests/screenshots/error-*.png` for debugging failed tests

## CI/CD Integration

For headless CI environments, modify the Puppeteer launch options:

```javascript
const browser = await puppeteer.launch({
  headless: true,  // Change to true for CI
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    // ... other args
  ]
});
```

## Test Coverage

Generate coverage reports:

```bash
npm run test:coverage
```

Coverage reports will be generated in the `coverage/` directory.

