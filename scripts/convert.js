#!/usr/bin/env node

/**
 * GitBook to Starlight MDX Converter
 * Converts GitBook-specific markdown syntax to standard MDX components
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  sourceDir: process.env.SOURCE_DIR || '../vectary-docs',
  outputDir: './src/content/docs',
  assetsSourceDir: '.gitbook/assets',
  assetsOutputDir: './src/assets/gitbook',
  excludeDirs: ['model-api-new', '.git', 'node_modules'],
  excludeFiles: ['SUMMARY.md'],
  // Skip root README.md - we have a custom index.mdx for the homepage
  skipRootReadme: true,
};

// ============================================================================
// CONVERTERS
// ============================================================================

/**
 * Convert {% hint style="..." %} to Starlight <Aside>
 */
function convertHints(content) {
  // Map GitBook hint styles to Starlight Aside types
  const styleMap = {
    'success': 'tip',
    'info': 'note',
    'warning': 'caution',
    'danger': 'danger',
  };

  // Pattern: {% hint style="type" %} ... {% endhint %}
  const hintRegex = /\{%\s*hint\s+style="(\w+)"\s*%\}([\s\S]*?)\{%\s*endhint\s*%\}/g;

  return content.replace(hintRegex, (match, style, innerContent) => {
    const asideType = styleMap[style] || 'note';
    
    // Extract title if present (#### Title format) - match until end of line
    const titleMatch = innerContent.match(/^[\s\n]*####\s*(.+)$/m);
    let title = '';
    let body = innerContent;
    
    if (titleMatch) {
      // Escape quotes in title for JSX attribute
      const escapedTitle = titleMatch[1].trim().replace(/"/g, '&quot;');
      title = ` title="${escapedTitle}"`;
      body = innerContent.replace(/^[\s\n]*####\s*.+$/m, '');
    }
    
    return `<Aside type="${asideType}"${title}>\n${body.trim()}\n</Aside>`;
  });
}

/**
 * Convert {% tabs %} {% tab title="..." %} to Starlight <Tabs><TabItem>
 */
function convertTabs(content) {
  // First, find all tabs blocks (with optional attributes like fullWidth="true")
  const tabsRegex = /\{%\s*tabs[^%]*%\}([\s\S]*?)\{%\s*endtabs\s*%\}/g;

  return content.replace(tabsRegex, (match, tabsContent) => {
    // Find individual tabs
    const tabRegex = /\{%\s*tab\s+title="([^"]+)"\s*%\}([\s\S]*?)(?=\{%\s*(?:tab|endtabs)\s*|\{%\s*endtab\s*%\})/g;
    
    let tabs = [];
    let tabMatch;
    
    // Also handle {% endtab %} markers
    const cleanContent = tabsContent.replace(/\{%\s*endtab\s*%\}/g, '');
    
    const tabRegex2 = /\{%\s*tab\s+title="([^"]+)"\s*%\}([\s\S]*?)(?=\{%\s*tab\s+title=|$)/g;
    
    while ((tabMatch = tabRegex2.exec(cleanContent)) !== null) {
      tabs.push({
        title: tabMatch[1],
        content: tabMatch[2].trim()
      });
    }

    if (tabs.length === 0) return match;

    const tabItems = tabs.map(tab =>
      `<TabItem label="${tab.title}">\n${tab.content}\n</TabItem>`
    ).join('\n');

    return `<Tabs>\n${tabItems}\n</Tabs>`;
  });
}

/**
 * Convert {% stepper %} {% step %} to numbered list
 */
function convertStepper(content) {
  // Pattern: {% stepper %} ... {% endstepper %}
  const stepperRegex = /\{%\s*stepper\s*%\}([\s\S]*?)\{%\s*endstepper\s*%\}/g;

  return content.replace(stepperRegex, (match, stepperContent) => {
    // Find individual steps
    const stepRegex = /\{%\s*step\s*%\}([\s\S]*?)(?=\{%\s*step\s*%\}|\{%\s*endstep\s*%\}|$)/g;

    let steps = [];
    let stepMatch;

    // Clean endstep markers
    const cleanContent = stepperContent.replace(/\{%\s*endstep\s*%\}/g, '');

    while ((stepMatch = stepRegex.exec(cleanContent)) !== null) {
      steps.push(stepMatch[1].trim());
    }

    if (steps.length === 0) return match;

    // Convert to numbered list with Steps component style
    const stepItems = steps.map((step, index) => {
      return `${index + 1}. ${step}`;
    }).join('\n\n');

    return stepItems;
  });
}

/**
 * Convert {% file src="..." %} to download link
 */
function convertFileRefs(content) {
  // Pattern: {% file src="..." %} with optional text after
  const fileRegex = /\{%\s*file\s+src="([^"]+)"[^%]*%\}/g;

  return content.replace(fileRegex, (match, src) => {
    const filename = src.split('/').pop();
    // Convert .gitbook/assets path to proper path
    const cleanSrc = src.includes('.gitbook/assets/')
      ? `~/assets/gitbook/${filename}`
      : src;
    return `[Download ${filename}](${cleanSrc})`;
  });
}

/**
 * Convert {% content-ref %} to simple link
 */
function convertContentRefs(content) {
  // Pattern: {% content-ref url="..." %} ... {% endcontent-ref %}
  const contentRefRegex = /\{%\s*content-ref\s+url="([^"]+)"\s*%\}[\s\S]*?\{%\s*endcontent-ref\s*%\}/g;

  return content.replace(contentRefRegex, (match, url) => {
    // Remove .md extension and create a simple link
    const cleanUrl = url.replace(/\.md$/, '');
    const linkText = cleanUrl.split('/').pop().replace(/-/g, ' ');
    return `[${linkText}](${cleanUrl})`;
  });
}

/**
 * Convert {% embed url="..." %} to appropriate iframe/embed
 */
function convertEmbeds(content) {
  // First handle embeds with caption: {% embed url="..." %} caption {% endembed %}
  const embedWithCaptionRegex = /\{%\s*embed\s+url="([^"]+)"[^%]*%\}([\s\S]*?)\{%\s*endembed\s*%\}/g;

  content = content.replace(embedWithCaptionRegex, (match, url, caption) => {
    const iframe = createIframe(url);
    const trimmedCaption = caption.trim();
    if (trimmedCaption) {
      return `${iframe}\n<figcaption>${trimmedCaption}</figcaption>`;
    }
    return iframe;
  });

  // Then handle simple embeds without endembed
  const embedRegex = /\{%\s*embed\s+url="([^"]+)"[^%]*%\}/g;

  return content.replace(embedRegex, (match, url) => {
    return createIframe(url);
  });
}

/**
 * Create iframe HTML for a given URL
 */
function createIframe(url) {
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        return `<iframe 
  width="100%" 
  height="400" 
  src="https://www.youtube.com/embed/${videoId}" 
  title="YouTube video" 
  frameborder="0" 
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
  allowfullscreen
></iframe>`;
      }
    }

    // Screen.studio
    if (url.includes('screen.studio')) {
      return `<iframe 
  width="100%" 
  height="400" 
  src="${url}" 
  title="Screen recording" 
  frameborder="0" 
  allowfullscreen
></iframe>`;
    }

  // Generic embed - use iframe
  return `<iframe
  width="100%"
  height="400"
  src="${url}"
  title="Embedded content"
  frameborder="0"
></iframe>`;
}

/**
 * Extract YouTube video ID from various URL formats
 */
function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /youtube\.com\/v\/([^&\s?]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Convert <table data-view="cards"> to Cards component
 */
function convertCards(content) {
  const cardTableRegex = /<table\s+data-view="cards"[^>]*>([\s\S]*?)<\/table>/gi;

  return content.replace(cardTableRegex, (match, tableContent) => {
    // Extract rows from tbody
    const tbodyMatch = tableContent.match(/<tbody>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) return match;

    const rows = [];
    const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tbodyMatch[1])) !== null) {
      const cells = [];
      const cellRegex = /<td>([\s\S]*?)<\/td>/gi;
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(cellMatch[1].trim());
      }

      if (cells.length > 0) {
        // First cell is title, second is link, third is cover image
        const title = cells[0]?.replace(/<\/?strong>/g, '') || '';
        const linkMatch = cells[1]?.match(/<a\s+href="([^"]+)"[^>]*>([^<]*)<\/a>/i);
        const link = linkMatch ? linkMatch[1] : '';
        const coverMatch = cells[2]?.match(/<a\s+href="([^"]+)"/i);
        const cover = coverMatch ? coverMatch[1] : '';

        rows.push({ title, link, cover });
      }
    }

    if (rows.length === 0) return match;

    const cardItems = rows.map(row => {
      const href = row.link.replace('.md', '');
      return `  <Card title="${row.title}" href="${href}" />`;
    }).join('\n');

    return `<CardGrid>\n${cardItems}\n</CardGrid>`;
  });
}

/**
 * Convert <figure><img> with width to styled image
 */
function convertFigures(content) {
  // Pattern: <figure><img src="..." alt="..." width="..."><figcaption>...</figcaption></figure>
  const figureRegex = /<figure>\s*<img\s+([^>]*)>\s*(?:<figcaption>([^<]*)<\/figcaption>)?\s*<\/figure>/gi;

  return content.replace(figureRegex, (match, imgAttrs, caption) => {
    const srcMatch = imgAttrs.match(/src="([^"]+)"/i);
    const altMatch = imgAttrs.match(/alt="([^"]*)"/i);
    const widthMatch = imgAttrs.match(/width="([^"]+)"/i);

    if (!srcMatch) return match;

    const src = fixAssetPath(srcMatch[1]);
    const alt = altMatch ? altMatch[1] : (caption || '');
    const width = widthMatch ? widthMatch[1] : '';

    let style = '';
    if (width) {
      style = ` style={{ maxWidth: '${width}px' }}`;
    }

    const captionEl = caption ? `\n<figcaption>${caption}</figcaption>` : '';
    
    return `<figure>\n  <img src="${src}" alt="${alt}"${style} />${captionEl}\n</figure>`;
  });
}

/**
 * Convert <div align="..."> to styled div
 */
function convertAlignedDivs(content) {
  const alignRegex = /<div\s+align="(\w+)">/gi;
  
  return content.replace(alignRegex, (match, align) => {
    return `<div style={{ textAlign: '${align}' }}>`;
  });
}

/**
 * Convert <img data-size="line"> to inline image
 */
function convertInlineImages(content) {
  const inlineImgRegex = /<img\s+([^>]*data-size="line"[^>]*)>/gi;

  return content.replace(inlineImgRegex, (match, attrs) => {
    const srcMatch = attrs.match(/src="([^"]+)"/i);
    const altMatch = attrs.match(/alt="([^"]*)"/i);

    if (!srcMatch) return match;

    const src = fixAssetPath(srcMatch[1]);
    const alt = altMatch ? altMatch[1] : '';

    return `<img src="${src}" alt="${alt}" style={{ display: 'inline', height: '1.2em', verticalAlign: 'middle' }} />`;
  });
}

/**
 * Convert <mark style="color:..."> to styled span
 */
function convertMarks(content) {
  const markRegex = /<mark\s+style="color:\s*([^"]+)">([\s\S]*?)<\/mark>/gi;

  return content.replace(markRegex, (match, color, text) => {
    // Remove semicolon if present in color value
    const cleanColor = color.replace(/;$/, '');
    return `<span style={{ color: '${cleanColor}' }}>${text}</span>`;
  });
}

/**
 * Resolve all internal links in content
 * Handles: markdown links, mention links, HTML links
 *
 * @param {string} content - File content
 * @param {string} currentFilePath - Path to current file (e.g., "documentation/design-process/background.md")
 */
function resolveLinks(content, currentFilePath) {
  // Determine current file's URL structure
  const isIndex = path.basename(currentFilePath).toLowerCase() === 'readme.md';
  const currentDir = path.dirname(currentFilePath);
  const currentFileName = path.basename(currentFilePath, '.md').toLowerCase();

  // Map of GitBook tab anchors to real section anchors
  const tabAnchorMap = {
    '#green-dot': '#project-tips',
    '#order-of-workspaces': '#workspace-tips',
    '#workspace-id': '#workspace-tips',
    '#project-movement': '#project-tips',
    '#project-selection': '#project-tips',
  };

  /**
   * Resolve a link URL relative to current file
   */
  function resolveUrl(rawUrl, anchor) {
    // Handle anchor-only links
    if (!rawUrl || rawUrl === '') {
      const mappedAnchor = anchor ? (tabAnchorMap[anchor.toLowerCase()] || anchor) : '';
      return mappedAnchor || '#';
    }

    // Don't modify external links
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl + (anchor || '');
    }

    // Handle absolute paths (starting with /)
    if (rawUrl.startsWith('/')) {
      const cleanUrl = rawUrl.replace(/\.md$/, '');
      const mappedAnchor = anchor ? (tabAnchorMap[anchor.toLowerCase()] || anchor) : '';
      return cleanUrl + mappedAnchor;
    }

    // Map tab anchors
    const mappedAnchor = anchor ? (tabAnchorMap[anchor.toLowerCase()] || anchor) : '';

    // Remove .md extension and normalize ./ prefix
    let targetPath = rawUrl.replace(/\.md$/, '').replace(/^\.\//, '');

    // Resolve target path relative to current directory
    const resolvedTarget = path.normalize(path.join(currentDir, targetPath));

    // Check if linking to self
    const targetFileName = path.basename(resolvedTarget).toLowerCase();
    const targetDir = path.dirname(resolvedTarget);
    if ((targetFileName === currentFileName || (isIndex && targetFileName === 'readme')) && targetDir === currentDir) {
      return mappedAnchor || '#';
    }

    // Calculate the URL path for current file
    // README.md -> folder URL (e.g., /folder)
    // other.md -> file URL (e.g., /folder/other)
    let currentUrlPath;
    if (isIndex) {
      // Index file: URL = directory path
      currentUrlPath = currentDir;
    } else {
      // Regular file: URL = directory + filename (without extension)
      currentUrlPath = path.join(currentDir, path.basename(currentFilePath, '.md'));
    }

    // Calculate target URL path
    // If target is README (index), URL is the folder
    // Otherwise URL is folder/filename
    let targetUrlPath;
    const targetBasename = path.basename(targetPath).toLowerCase();
    if (targetBasename === 'readme') {
      targetUrlPath = path.dirname(resolvedTarget);
    } else {
      targetUrlPath = resolvedTarget;
    }

    // Calculate relative path from current URL to target URL
    // For index files, we calculate from the directory itself
    // For regular files, we calculate from the file's "parent" (since URL is /dir/file)
    const baseForRelative = isIndex ? currentUrlPath : path.dirname(currentUrlPath);
    const relativePath = path.relative(baseForRelative, targetUrlPath);

    // Convert backslashes to forward slashes (Windows compatibility)
    let finalPath = relativePath.replace(/\\/g, '/');

    // Ensure we don't have empty path
    if (!finalPath) {
      finalPath = '.';
    }

    return finalPath + mappedAnchor;
  }

  /**
   * Clean up link text (for mention links where text = filename)
   */
  function cleanLinkText(text) {
    if (text.endsWith('.md')) {
      let clean = text.replace(/\.md$/, '').replace(/-/g, ' ');
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    // Also handle anchor-only text like "#settings"
    if (text.startsWith('#')) {
      return text;
    }
    return text;
  }

  // 1. Handle mention links with anchor: [#anchor](file.md#anchor "mention")
  const mentionWithAnchorRegex = /\[([^\]]+)\]\(([^)#]*)(#[^)\s]+)?\s+"mention"\)/g;
  content = content.replace(mentionWithAnchorRegex, (match, text, url, anchor) => {
    const cleanText = cleanLinkText(text);
    const resolvedUrl = resolveUrl(url, anchor);
    return `[${cleanText}](${resolvedUrl})`;
  });

  // 2. Handle HTML data-mention links: <a data-mention href="file.md">text</a>
  const htmlMentionRegex = /<a\s+data-mention\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  content = content.replace(htmlMentionRegex, (match, href, text) => {
    // Parse href for anchor
    const anchorMatch = href.match(/(#[^"]+)$/);
    const anchor = anchorMatch ? anchorMatch[1] : null;
    const url = anchor ? href.replace(anchor, '') : href;

    const cleanText = cleanLinkText(text);
    const resolvedUrl = resolveUrl(url, anchor);
    return `[${cleanText}](${resolvedUrl})`;
  });

  // 3. Handle regular HTML links: <a href="file.md">text</a>
  const htmlLinkRegex = /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  content = content.replace(htmlLinkRegex, (match, href, text) => {
    // Skip external links
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
      return match;
    }

    // Parse href for anchor
    const anchorMatch = href.match(/(#[^"]+)$/);
    const anchor = anchorMatch ? anchorMatch[1] : null;
    const url = anchor ? href.replace(anchor, '') : href;

    const resolvedUrl = resolveUrl(url, anchor);
    return `[${text}](${resolvedUrl})`;
  });

  // 4. Handle regular markdown links with .md: [text](url.md) or [text](url.md#anchor)
  const mdLinkRegex = /\[([^\]]+)\]\(([^)#]+\.md)(#[^)]+)?\)/g;
  content = content.replace(mdLinkRegex, (match, text, url, anchor) => {
    const resolvedUrl = resolveUrl(url, anchor);
    return `[${text}](${resolvedUrl})`;
  });

  return content;
}

/**
 * Remove/decode HTML entities
 */
function removeHtmlEntities(content) {
  return content
    .replace(/&#x20;/g, ' ')
    .replace(/&#x3C;/gi, '<')
    .replace(/&#x3E;/gi, '>')
    .replace(/&#60;/g, '<')
    .replace(/&#62;/g, '>');
}

/**
 * Fix malformed bold text caused by HTML entities
 * E.g., "**is **text" should become "**is** text"
 */
function fixMalformedBold(content) {
  // Fix "**word **" pattern (space before closing **)
  // This happens when &#x20; is decoded inside bold markers
  // Add space after closing ** to separate from following content
  return content.replace(/\*\*(\w+)\s+\*\*(?=<)/g, '**$1** ');
}

/**
 * Convert <pre><code> blocks to markdown code blocks
 */
function convertPreCodeBlocks(content) {
  // Pattern: <pre class="language-xxx"><code class="lang-xxx">...</code></pre>
  const preCodeRegex = /<pre[^>]*class="language-(\w+)"[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi;

  return content.replace(preCodeRegex, (match, language, code) => {
    // Remove <strong> tags and other HTML from code
    let cleanCode = code
      .replace(/<\/?strong>/gi, '')
      .replace(/<\/?em>/gi, '')
      .replace(/<\/?b>/gi, '')
      .replace(/<\/?i>/gi, '')
      .trim();

    return '```' + language + '\n' + cleanCode + '\n```';
  });
}

/**
 * Escape angle brackets inside inline <code> tags to prevent JSX parsing
 */
function escapeInlineCode(content) {
  // Match <code>...</code> that's NOT inside a markdown code block
  const inlineCodeRegex = /<code>([^<]*(?:<(?!\/code>)[^<]*)*)<\/code>/gi;

  return content.replace(inlineCodeRegex, (match, code) => {
    // Skip if it looks like it's already escaped
    if (code.includes('&lt;') || code.includes('&gt;')) {
      return match;
    }
    // Escape < and > that look like type parameters (e.g., Array<Type>)
    const escaped = code
      .replace(/<(?!\s)/g, '&lt;')
      .replace(/(?<!\s)>/g, '&gt;');
    return `<code>${escaped}</code>`;
  });
}

/**
 * Convert GitBook escaped brackets \[ and \] to regular brackets
 */
function convertEscapedBrackets(content) {
  return content
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']');
}

/**
 * Fix figures inside list items - move them outside the list
 * MDX doesn't support block elements inside list items
 */
function fixFiguresInLists(content) {
  // Pattern: list item with indented figure on next lines
  // Match: "* text\n\n    <figure>...</figure>"
  const listFigureRegex = /^(\*\s+[^\n]+)<br\s*\/?>\s*\n\n(\s{4}<figure>[\s\S]*?<\/figure>)/gm;

  return content.replace(listFigureRegex, (match, listItem, figure) => {
    // Remove the indentation from figure and place it after the list item
    const cleanFigure = figure.replace(/^\s{4}/gm, '');
    return `${listItem}\n\n${cleanFigure}`;
  });
}

/**
 * Convert void HTML tags to self-closing for JSX/MDX compatibility
 */
function convertVoidTags(content) {
  return content
    // <br> → <br />
    .replace(/<br\s*>/gi, '<br />')
    // <hr> → <hr />
    .replace(/<hr\s*>/gi, '<hr />')
    // <img ...> → <img ... /> (only if not already self-closing)
    .replace(/<img\s+([^>]*[^/])>/gi, '<img $1 />');
}

/**
 * Fix asset paths from GitBook format to Starlight format
 */
function fixAssetPath(originalPath) {
  if (originalPath.includes('.gitbook/assets/')) {
    // Convert to public assets path (works with base path)
    const filename = path.basename(originalPath);
    return `/vectary-docs-site/assets/gitbook/${filename}`;
  }
  return originalPath;
}

/**
 * Fix markdown image paths with gitbook assets
 * Handles: ![alt](<../.gitbook/assets/file.png>) and ![alt](../.gitbook/assets/file.png)
 */
function fixMarkdownImagePaths(content) {
  // Pattern with angle brackets: ![...](<...gitbook/assets/...>)
  const imgWithBracketsRegex = /!\[([^\]]*)\]\(<([^>]*\.gitbook\/assets\/[^>]+)>\)/g;
  content = content.replace(imgWithBracketsRegex, (match, alt, src) => {
    const filename = path.basename(src);
    return `![${alt}](/vectary-docs-site/assets/gitbook/${filename})`;
  });

  // Pattern without angle brackets: ![...](...gitbook/assets/...)
  const imgRegex = /!\[([^\]]*)\]\(([^)]*\.gitbook\/assets\/[^)]+)\)/g;
  content = content.replace(imgRegex, (match, alt, src) => {
    const filename = path.basename(src);
    return `![${alt}](/vectary-docs-site/assets/gitbook/${filename})`;
  });

  return content;
}


/**
 * Process frontmatter - convert GitBook frontmatter to Starlight format
 */
function processFrontmatter(content, filePath) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    // No frontmatter, add basic one
    const title = extractTitleFromContent(content) || path.basename(filePath, '.md');
    return `---\ntitle: "${title}"\n---\n\n${content}`;
  }

  const frontmatterRaw = match[1];
  const body = content.slice(match[0].length);

  // Parse YAML-style frontmatter more carefully
  const fm = {};
  let currentKey = null;
  let currentValue = [];
  let multilineMode = null; // '>-', '>', '|', or null

  const lines = frontmatterRaw.split('\n');
  let inNestedBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this is a new top-level key (starts with word followed by colon, no leading spaces)
    const keyMatch = line.match(/^(\w+):\s*(.*)?$/);

    if (keyMatch && !line.startsWith(' ')) {
      // Save previous key-value if exists
      if (currentKey && !inNestedBlock) {
        // For >- and > modes, join with spaces; for | mode, join with newlines
        const joiner = (multilineMode === '|') ? '\n' : ' ';
        fm[currentKey] = currentValue.length > 0
          ? currentValue.join(joiner).trim()
          : '';
      }

      currentKey = keyMatch[1];
      const value = keyMatch[2] || '';

      // Check for multiline indicators or nested YAML blocks
      if (value === '>-' || value === '|' || value === '>') {
        multilineMode = value;
        inNestedBlock = false;
        currentValue = [];
      } else if (value === '') {
        // Empty value could be start of nested block - check next line
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.match(/^\s{2,}\w+:/)) {
          // Next line is indented key - this is a nested block, skip it
          inNestedBlock = true;
          currentValue = [];
        } else {
          inNestedBlock = false;
          multilineMode = null;
          currentValue = [];
        }
      } else {
        inNestedBlock = false;
        multilineMode = null;
        currentValue = [value];
      }
    } else if (currentKey && !inNestedBlock && (line.startsWith('  ') || line.trim() === '')) {
      // Continuation of multiline value (only if not in nested block)
      if (!line.match(/^\s{2,}\w+:/)) {
        // Not a nested key
        currentValue.push(line.replace(/^  /, '').trim());
      }
    }
  }

  // Save last key-value (only if not in nested block)
  if (currentKey && !inNestedBlock) {
    const joiner = (multilineMode === '|') ? '\n' : ' ';
    fm[currentKey] = currentValue.length > 0
      ? currentValue.join(joiner).trim()
      : '';
  }

  // Build new frontmatter
  const newFm = [];
  
  // Title
  if (!fm.title) {
    const title = extractTitleFromContent(body) || path.basename(filePath, '.md');
    newFm.push(`title: "${title}"`);
  } else {
    const title = fm.title.replace(/^["']|["']$/g, '');
    newFm.push(`title: "${title}"`);
  }

  // Description - use single quotes to avoid escape issues with special chars
  if (fm.description) {
    // Replace single quotes with escaped single quotes for YAML
    const desc = fm.description.replace(/'/g, "''");
    newFm.push(`description: '${desc}'`);
  }

  // Hidden pages
  if (fm.hidden === 'true') {
    newFm.push('draft: true');
  }

  // Icon (for sidebar) - comment out for now
  if (fm.icon) {
    newFm.push(`# icon: ${fm.icon}`);
  }

  return `---\n${newFm.join('\n')}\n---\n${body}`;
}

/**
 * Extract title from markdown content (first # heading)
 */
function extractTitleFromContent(content) {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return titleMatch ? titleMatch[1].trim() : null;
}

/**
 * Add required imports at the top of MDX file
 */
function addImports(content, usedComponents) {
  const imports = [];
  
  if (usedComponents.has('Aside')) {
    imports.push("import { Aside } from '@astrojs/starlight/components';");
  }
  if (usedComponents.has('Tabs') || usedComponents.has('TabItem')) {
    imports.push("import { Tabs, TabItem } from '@astrojs/starlight/components';");
  }
  if (usedComponents.has('CardGrid') || usedComponents.has('Card')) {
    imports.push("import { Card, CardGrid } from '@astrojs/starlight/components';");
  }

  if (imports.length === 0) return content;

  // Insert imports after frontmatter
  const frontmatterEnd = content.indexOf('---', 4);
  if (frontmatterEnd === -1) {
    return imports.join('\n') + '\n\n' + content;
  }

  const beforeImports = content.slice(0, frontmatterEnd + 3);
  const afterImports = content.slice(frontmatterEnd + 3);

  return beforeImports + '\n\n' + imports.join('\n') + afterImports;
}

/**
 * Detect which components are used in content
 */
function detectUsedComponents(content) {
  const components = new Set();
  
  if (content.includes('<Aside')) components.add('Aside');
  if (content.includes('<Tabs')) components.add('Tabs');
  if (content.includes('<TabItem')) components.add('TabItem');
  if (content.includes('<CardGrid')) components.add('CardGrid');
  if (content.includes('<Card ')) components.add('Card');
  
  return components;
}

// ============================================================================
// MAIN CONVERTER
// ============================================================================

/**
 * Convert a single markdown file
 */
function convertFile(content, filePath) {
  let result = content;

  // Apply all conversions in order
  result = convertHints(result);
  result = convertTabs(result);
  result = convertStepper(result);
  result = convertContentRefs(result);
  result = convertFileRefs(result);
  result = convertEmbeds(result);
  result = convertCards(result);
  result = convertFigures(result);
  result = convertAlignedDivs(result);
  result = convertInlineImages(result);
  result = convertMarks(result);
  result = resolveLinks(result, filePath);
  result = removeHtmlEntities(result);
  result = fixMalformedBold(result);
  result = convertPreCodeBlocks(result);
  result = escapeInlineCode(result);
  result = convertEscapedBrackets(result);
  result = convertVoidTags(result);
  result = fixFiguresInLists(result);
  result = fixMarkdownImagePaths(result);
  result = processFrontmatter(result, filePath);

  // Detect and add imports
  const usedComponents = detectUsedComponents(result);
  result = addImports(result, usedComponents);

  return result;
}

/**
 * Process all files in source directory
 */
async function processDirectory(sourceDir, outputDir) {
  const absoluteSourceDir = path.resolve(__dirname, '..', sourceDir);
  const absoluteOutputDir = path.resolve(__dirname, '..', outputDir);

  console.log(`\n📁 Source: ${absoluteSourceDir}`);
  console.log(`📁 Output: ${absoluteOutputDir}\n`);

  // Check if source exists
  if (!fs.existsSync(absoluteSourceDir)) {
    console.error(`❌ Source directory not found: ${absoluteSourceDir}`);
    console.log('\n💡 Make sure to clone the source repo first:');
    console.log('   git clone https://github.com/vibe-and-pray/vectary-docs.git ../vectary-docs\n');
    process.exit(1);
  }

  // Create output directory
  fs.mkdirSync(absoluteOutputDir, { recursive: true });

  // Process files recursively
  await processDir(absoluteSourceDir, absoluteOutputDir, '');

  console.log('\n✅ Conversion complete!\n');
}

async function processDir(sourceBase, outputBase, relativePath) {
  const currentSource = path.join(sourceBase, relativePath);
  const currentOutput = path.join(outputBase, relativePath);

  const entries = fs.readdirSync(currentSource, { withFileTypes: true });

  for (const entry of entries) {
    const entryRelPath = path.join(relativePath, entry.name);

    // Skip excluded directories
    if (entry.isDirectory() && CONFIG.excludeDirs.includes(entry.name)) {
      console.log(`⏭️  Skipping: ${entryRelPath}`);
      continue;
    }

    // Skip excluded files
    if (entry.isFile() && CONFIG.excludeFiles.includes(entry.name)) {
      console.log(`⏭️  Skipping: ${entryRelPath}`);
      continue;
    }

    // Skip .gitbook directory (we'll copy assets separately)
    if (entry.name === '.gitbook') {
      // Copy to public/assets/gitbook for static serving
      await copyAssets(path.join(currentSource, entry.name, 'assets'),
                       path.resolve(outputBase, '..', '..', '..', 'public', 'assets', 'gitbook'));
      continue;
    }

    if (entry.isDirectory()) {
      fs.mkdirSync(path.join(currentOutput, entry.name), { recursive: true });
      await processDir(sourceBase, outputBase, entryRelPath);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Skip root README.md - we have a custom index.mdx for homepage
      if (CONFIG.skipRootReadme && relativePath === '' && entry.name.toLowerCase() === 'readme.md') {
        console.log(`⏭️  Skipping root: ${entry.name}`);
        continue;
      }

      const sourcePath = path.join(currentSource, entry.name);
      // Rename README.md to index.mdx for proper routing
      let outputName = entry.name.replace(/\.md$/, '.mdx');
      if (entry.name.toLowerCase() === 'readme.md') {
        outputName = 'index.mdx';
      }
      const outputPath = path.join(currentOutput, outputName);

      try {
        const content = fs.readFileSync(sourcePath, 'utf-8');
        const converted = convertFile(content, entryRelPath);
        
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, converted, 'utf-8');
        
        console.log(`✅ ${entryRelPath}`);
      } catch (error) {
        console.error(`❌ Error processing ${entryRelPath}: ${error.message}`);
      }
    }
  }
}

/**
 * Copy assets from .gitbook/assets to src/assets/gitbook
 */
async function copyAssets(sourceDir, outputDir) {
  if (!fs.existsSync(sourceDir)) {
    console.log('⚠️  No .gitbook/assets directory found');
    return;
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const files = fs.readdirSync(sourceDir);
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const outputPath = path.join(outputDir, file);

    if (fs.statSync(sourcePath).isFile()) {
      fs.copyFileSync(sourcePath, outputPath);
    }
  }

  console.log(`📦 Copied ${files.length} assets to ${outputDir}`);
}

// ============================================================================
// CLI
// ============================================================================

const args = process.argv.slice(2);
const watchMode = args.includes('--watch');

if (watchMode) {
  console.log('👀 Watch mode enabled. Watching for changes...\n');
  
  // Initial conversion
  await processDirectory(CONFIG.sourceDir, CONFIG.outputDir);
  
  // Watch for changes (requires chokidar)
  try {
    const chokidar = await import('chokidar');
    const absoluteSourceDir = path.resolve(__dirname, '..', CONFIG.sourceDir);
    
    chokidar.default.watch(absoluteSourceDir, {
      ignored: /(^|[\/\\])\../,
      persistent: true
    }).on('change', async (filePath) => {
      if (filePath.endsWith('.md')) {
        console.log(`\n🔄 File changed: ${filePath}`);
        await processDirectory(CONFIG.sourceDir, CONFIG.outputDir);
      }
    });
  } catch (e) {
    console.log('⚠️  chokidar not installed. Run: npm install chokidar');
  }
} else {
  await processDirectory(CONFIG.sourceDir, CONFIG.outputDir);
}
