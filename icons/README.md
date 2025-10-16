# Extension Icons

This directory should contain the extension icons in PNG format:

- `icon16.png` - 16x16 pixels (browser toolbar)
- `icon48.png` - 48x48 pixels (extensions management page)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Creating Icons

You can create the icons using any graphics editor. The icon should represent the extension's purpose (language statistics/code analysis).

Suggested design:
- A bar chart or pie chart symbol
- Code brackets with a chart
- The GitHub logo with a stats overlay
- Use colors that work well with both light and dark themes

## Temporary Placeholder

Until custom icons are created, you can use a simple placeholder. Here's a quick way to generate placeholder icons using ImageMagick:

```bash
# Install ImageMagick if not already installed
sudo apt-get install imagemagick  # Ubuntu/Debian
brew install imagemagick          # macOS

# Generate placeholder icons
convert -size 16x16 xc:blue -fill white -gravity center -pointsize 10 -annotate +0+0 "PR" icon16.png
convert -size 48x48 xc:blue -fill white -gravity center -pointsize 32 -annotate +0+0 "PR" icon48.png
convert -size 128x128 xc:blue -fill white -gravity center -pointsize 96 -annotate +0+0 "PR" icon128.png
```

Or create an SVG icon and export it at different sizes.

