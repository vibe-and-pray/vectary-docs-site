# Vectary Docs Site

Self-hosted documentation for Vectary, built with [Astro Starlight](https://starlight.astro.build/).

## Architecture

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  vectary-docs           │     │  vectary-docs-site      │
│  (GitBook source)       │────▶│  (Starlight site)       │
│                         │     │                         │
│  - Markdown files       │     │  - Converter script     │
│  - .gitbook/assets      │     │  - Astro/Starlight      │
│  - SUMMARY.md           │     │  - GitHub Actions       │
└─────────────────────────┘     └─────────────────────────┘
                                          │
                                          ▼
                                ┌─────────────────────────┐
                                │  GitHub Pages           │
                                │  (Static hosting)       │
                                └─────────────────────────┘
```

## Quick Start

### Local Development

```bash
# 1. Clone both repos
git clone https://github.com/vibe-and-pray/vectary-docs-site.git
git clone https://github.com/vibe-and-pray/vectary-docs.git

# 2. Install dependencies
cd vectary-docs-site
npm install

# 3. Convert GitBook markdown to MDX
npm run convert

# 4. Start dev server
npm run dev
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build production site to `./dist` |
| `npm run preview` | Preview production build locally |
| `npm run convert` | Convert GitBook markdown to MDX |
| `npm run convert:watch` | Convert + watch for changes |

## GitBook Conversions

The converter (`scripts/convert.js`) handles these GitBook-specific constructs:

| GitBook | Starlight |
|---------|-----------|
| `{% hint style="..." %}` | `<Aside type="...">` |
| `{% tabs %}{% tab %}` | `<Tabs><TabItem>` |
| `{% embed url="youtube..." %}` | YouTube iframe |
| `{% embed url="..." %}` | Generic iframe |
| `<table data-view="cards">` | `<Card>` components |
| `<figure><img width="...">` | Styled `<img>` |
| `<div align="...">` | Styled `<div>` |
| `<img data-size="line">` | Inline image |
| `<mark style="color:...">` | `<span>` with color |
| `[text](url "mention")` | Regular link |
| `&#x20;` | Removed |

## Deployment

### Automatic (GitHub Actions)

1. Push to `main` branch triggers build & deploy
2. Source repo changes can trigger via `repository_dispatch`

### Manual

```bash
npm run build
# Upload ./dist to any static host
```

### GitHub Pages Setup

1. Go to repo Settings → Pages
2. Set Source to "GitHub Actions"
3. The workflow will deploy automatically

### Cross-repo Trigger Setup

To auto-rebuild when source docs change:

1. Create a Personal Access Token with `repo` scope
2. Add it as `DOCS_SITE_TOKEN` secret in `vectary-docs` repo
3. Copy `trigger-from-source.yml.example` to the source repo as `.github/workflows/trigger-rebuild.yml`

## Project Structure

```
vectary-docs-site/
├── .github/workflows/     # GitHub Actions
│   └── deploy.yml         # Build & deploy workflow
├── scripts/
│   └── convert.js         # GitBook → MDX converter
├── src/
│   ├── assets/           # Static assets
│   │   └── gitbook/      # Copied from .gitbook/assets
│   ├── content/docs/     # Converted MDX files
│   ├── components/       # Custom Astro components
│   └── styles/
│       └── custom.css    # Custom styles
├── astro.config.mjs      # Astro configuration
├── package.json
└── README.md
```

## Customization

### Sidebar Navigation

Edit `astro.config.mjs` to customize the sidebar structure:

```js
sidebar: [
  {
    label: 'Getting Started',
    autogenerate: { directory: 'documentation/getting-started' },
  },
  // ... more sections
]
```

### Styling

Edit `src/styles/custom.css` to customize colors, fonts, etc.

### Logo

Replace `src/assets/vectary-logo.svg` with your actual logo.

## Troubleshooting

### Conversion Issues

If a file doesn't convert correctly:

1. Check the console output for errors
2. The original GitBook syntax might have edge cases
3. Update `scripts/convert.js` regex patterns as needed

### Build Errors

```bash
# Clear cache and rebuild
rm -rf node_modules .astro dist
npm install
npm run convert
npm run build
```

### Missing Assets

Make sure `.gitbook/assets` exists in the source repo and contains all referenced images.

## License

MIT
