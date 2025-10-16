# GitHub PR Language Stats

A Chrome extension that shows line count statistics by programming language for GitHub pull requests.

## Features

- 📊 **Language Breakdown**: See exactly how many lines were added/removed per programming language
- 🎯 **Accurate Detection**: Uses file extensions to identify languages
- 🎨 **GitHub Native Design**: Seamlessly integrates with GitHub's UI
- 🌙 **Dark Mode Support**: Automatically adapts to your GitHub theme

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
2. Analyzes the diff view to extract file changes
3. Identifies the programming language from file extensions
4. Calculates line counts (added/removed) per language
5. Displays a summary table in the PR interface

## Supported Languages

The extension detects 40+ programming languages including:
- **Web**: JavaScript, TypeScript, HTML, CSS, Vue, React (JSX/TSX)
- **Backend**: Python, Ruby, PHP, Java, Go, Rust, C/C++, C#
- **Data**: JSON, YAML, SQL, XML
- **Markup**: Markdown, reStructuredText
- And many more!

## Privacy

This extension:
- ✅ Only runs on GitHub.com
- ✅ Analyzes data locally in your browser
- ✅ Does not collect or transmit any data
- ✅ Does not require authentication
- ✅ Open source for transparency

## Development

### Project Structure

```
github-linecount/
├── manifest.json       # Extension configuration
├── content.js          # Main logic for analyzing PRs
├── styles.css          # UI styling
├── icons/              # Extension icons
├── tests/              # Automated tests
│   ├── e2e/           # Puppeteer E2E tests
│   └── README.md      # Testing documentation
├── package.json        # Node.js dependencies
└── README.md          # This file
```

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

## License

MIT License - see [LICENSE](LICENSE) file for details

## Roadmap

Potential future enhancements:
- [ ] Support for GitHub Enterprise
- [ ] Filtering options (e.g., exclude generated files)
- [ ] Export statistics as CSV/JSON
- [ ] Language-specific configurations
- [ ] Integration with GitHub's Linguist API for improved detection
- [ ] Support for commits view (not just PRs)

## Acknowledgments

- Inspired by GitHub's language statistics
- Built with respect for user privacy
- Uses GitHub's native design system

---

**Note**: This is an independent project and is not affiliated with GitHub.

