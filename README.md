# GitHub PR Polyglot Line Counts

A Chrome extension that shows line count statistics by programming language for GitHub pull requests - see exactly what languages changed and how long the review will take.

![Language Statistics Panel](tests/screenshots/03-panel-closeup.png)

## What It Does

Like "Better Line Counts" but shows **which languages** changed, not just totals.

## Features

- 📊 **Language Breakdown**: See exactly how many lines were added/removed per programming language
- 📝 **Review Time Estimate**: Calculates estimated review time based on language complexity
- ☑️ **Exclude Generated**: Toggle to filter out generated files
- ⚡ **Fast**: Uses GitHub API for instant results
- 🎨 **GitHub Native Design**: Seamlessly integrates with GitHub's UI

## Installation

### From Source (Development)

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd github-linecount
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in the top right)

4. Click "Load unpacked" and select the `github-linecount` directory

5. The extension is now installed! Visit any GitHub pull request to see it in action.

### From Chrome Web Store

*Coming soon!*

## Usage

1. Navigate to any GitHub pull request
2. The language statistics panel will automatically appear below the PR header
3. View the breakdown of added/removed lines by language

The extension shows:
- Language name
- Number of files per language
- Lines added (+) per language
- Lines removed (-) per language
- Percentage of total changes

## How It Works

The extension:
1. Detects when you're viewing a GitHub pull request  
2. Fetches file data from GitHub API
3. Groups changes by programming language
4. Displays a summary table in the PR interface

Supports 40+ programming languages via file extension mapping.

## Privacy

- ✅ Only runs on GitHub.com
- ✅ Uses GitHub's public API
- ✅ No data collection or tracking
- ✅ Open source

## Documentation

- [Installation Guide](docs/INSTALLATION.md) - How to install the extension
- [Testing Guide](docs/TESTING.md) - Running tests
- [Changelog](docs/CHANGELOG.md) - Version history
- [Project Structure](docs/PROJECT_STRUCTURE.md) - Codebase organization

## Development

### Making Changes

1. Make your changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Refresh the GitHub PR page to see changes

### Testing

Run automated E2E tests with screenshots:

```bash
npm install           # Install dependencies (first time only)
npm run test:e2e      # Run E2E tests with Puppeteer
```

The tests will:
- Launch Chrome with the extension loaded
- Navigate to a real GitHub PR
- Take screenshots documenting the extension behavior
- Verify the language stats panel appears correctly

See [tests/README.md](tests/README.md) for detailed testing documentation.

### Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Acknowledgments

Inspired by [Better Line Counts](https://chromewebstore.google.com/detail/github-better-line-counts/ocfdgncpifmegplaglcnglhioflaimkd) - which filters generated files from PR totals. We wanted the same accuracy, but broken down **by language** to understand what actually changed.

## License

MIT License - see [LICENSE](LICENSE) file for details

---

**Note**: Independent project, not affiliated with GitHub.

