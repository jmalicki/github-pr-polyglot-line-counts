# Project Structure

```
github-linecount/
├── README.md                    # Main documentation
├── LICENSE                      # MIT License
├── manifest.json               # Chrome extension config
├── package.json                # Node.js dependencies
│
├── content.js                  # Main extension logic
├── styles.css                  # UI styling
│
├── lib/                        # Shared libraries
│   └── language-detector.js   # Language detection logic
│
├── icons/                      # Extension icons
│   ├── icon.svg               # Source SVG
│   ├── icon16.png             # 16x16
│   ├── icon48.png             # 48x48
│   └── icon128.png            # 128x128
│
├── docs/                       # Documentation
│   ├── CHANGELOG.md           # Version history
│   ├── INSTALLATION.md        # Install guide
│   ├── TESTING.md             # Testing guide
│   ├── API_RESEARCH.md        # GitHub API research
│   ├── development/           # Dev docs
│   │   ├── STATUS.md
│   │   ├── FINAL_SUMMARY.md
│   │   └── READY_TO_TEST.md
│   └── features/              # Feature ideas
│       ├── FEATURE_IDEAS.md
│       └── FEATURE_BRAINSTORM.md
│
└── tests/                      # Test suite
    ├── README.md              # Testing docs
    ├── unit/                  # Unit tests (fast)
    │   ├── language-detection.test.js
    │   ├── api-analysis.test.js
    │   ├── error-handling.test.js
    │   ├── new-vs-modified.test.js
    │   ├── unknown-languages.test.js
    │   └── null-totals.test.js.skip
    ├── e2e/                   # E2E tests
    │   ├── run-tests.js       # Main E2E runner
    │   ├── screenshot-utils.js
    │   └── debug/             # Debug scripts
    │       ├── debug-dom.js
    │       ├── debug-stats-extraction.js
    │       ├── dom-snapshot-timeline.js
    │       ├── explore-available-data.js
    │       ├── find-generated-markers.js
    │       ├── inspect-github-selectors.js
    │       ├── investigate-gitattributes.js
    │       └── visual-timeline.js
    └── screenshots/            # Test output (gitignored)
```

## Key Files

### Extension Files (Load These)
- `manifest.json` - Extension metadata
- `content.js` - Main logic
- `styles.css` - Styling
- `lib/language-detector.js` - Shared logic
- `icons/` - Extension icons

### Documentation (Read These)
- `README.md` - Start here!
- `docs/INSTALLATION.md` - How to install
- `docs/TESTING.md` - How to test
- `docs/CHANGELOG.md` - What's new

### Development (For Contributors)
- `docs/development/` - Status and summaries
- `docs/features/` - Future ideas
- `docs/API_RESEARCH.md` - Technical research

### Testing (For Developers)
- `tests/unit/` - Fast unit tests
- `tests/e2e/run-tests.js` - E2E with screenshots
- `tests/e2e/debug/` - Debugging tools

## Clean Root Directory

Only essential files in root:
- Documentation: README.md, LICENSE
- Extension code: manifest.json, content.js, styles.css
- Configuration: package.json
- Directories: lib/, icons/, docs/, tests/

No clutter!

