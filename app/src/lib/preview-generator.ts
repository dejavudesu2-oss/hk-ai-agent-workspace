import { VFSMap, normalizePath } from './vfs';

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function safeReplace(str: string, pattern: RegExp | string, replacement: string): string {
  return str.replace(pattern, () => replacement);
}

export const WATCHDOG_SCRIPT = `
  <script>
    (function() {
      window.onerror = function(msg, url, line, col, error) {
        window.parent.postMessage({
          type: 'WATCHDOG_ERROR',
          message: String(msg) + ' (line ' + line + ':' + col + ')'
        }, '*');
      };
      window.onunhandledrejection = function(event) {
        window.parent.postMessage({
          type: 'WATCHDOG_ERROR',
          message: 'Unhandled Promise: ' + (event.reason ? (event.reason.message || event.reason) : 'Unknown')
        }, '*');
      };
    })();
  </script>
`;

export const PREVIEW_CSP = `
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https://cdn.tailwindcss.com https://unpkg.com; img-src * data: blob:; connect-src *;">
`;

export const BROWSER_MODULE_SHIM = `
  <script>
    (function() {
      window.exports = window.exports || {};
      window.module = window.module || { exports: window.exports };
      window.require = window.require || function(name) {
        if (name === 'react') return window.React;
        if (name === 'react-dom' || name === 'react-dom/client') return window.ReactDOM;
        if (name === 'lucide-react' || name === 'lucide') return window.lucide || {};
        return window[name] || {};
      };
    })();
  </script>
`;

export const REACT_AUTO_MOUNT = `
  <script>
    window.addEventListener('load', function() {
      const rootEl = document.getElementById('root');
      if (rootEl && !rootEl.hasChildNodes()) {
        const Component = (window.exports && window.exports.default) || window.App;
        if (Component && window.ReactDOM && window.React) {
          try {
            if (window.ReactDOM.createRoot) {
              window.ReactDOM.createRoot(rootEl).render(window.React.createElement(Component));
            } else if (window.ReactDOM.render) {
              window.ReactDOM.render(window.React.createElement(Component), rootEl);
            }
          } catch(e) {
            console.error('Auto-mount failed:', e);
          }
        }
      }
    });
  </script>
`;

/**
 * Compiles in-memory virtual files into an isolated HTML document string for sandboxed iframe preview.
 */
export function generatePreviewHtml(files: VFSMap): string {
  // Normalize file dictionary keys
  const normalizedFiles: VFSMap = {};
  for (const [key, val] of Object.entries(files)) {
    const norm = normalizePath(key || val.path);
    if (norm) {
      normalizedFiles[norm] = { path: norm, content: val.content };
    }
  }

  const hasAnyFiles = Object.keys(normalizedFiles).length > 0;
  const indexHtml =
    normalizedFiles['index.html']?.content ||
    normalizedFiles['public/index.html']?.content ||
    normalizedFiles['index.htm']?.content;

  if (!hasAnyFiles) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        ${WATCHDOG_SCRIPT}
        ${PREVIEW_CSP}
        <style>
          body {
            background: #0d1117;
            color: #8b949e;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .spinner {
            border: 3px solid rgba(255,255,255,0.1);
            border-top: 3px solid #58a6ff;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="spinner"></div>
        <p>正在等待代碼流式寫入完成...</p>
      </body>
      </html>
    `;
  }

  // Check if project has React/JSX/TSX files
  const hasReactFiles = Object.keys(normalizedFiles).some((p) => {
    if (/\.(jsx|tsx|ts)$/i.test(p)) return true;
    const content = normalizedFiles[p]?.content || '';
    return /from\s+['"]react['"]|React\./.test(content);
  });

  let html = indexHtml || `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${PREVIEW_CSP}
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0f172a] text-slate-100 min-h-screen">
  <div id="root"></div>
</body>
</html>`;

  // 1. Inject Watchdog script at the VERY TOP of <head> so it captures all runtime & syntax errors
  if (!html.includes('WATCHDOG_ERROR')) {
    if (html.includes('<head>')) {
      html = safeReplace(html, '<head>', `<head>\n  ${WATCHDOG_SCRIPT}`);
    } else {
      html = `${WATCHDOG_SCRIPT}${html}`;
    }
  }

  // 2. Inject CSP into head if not present
  if (!html.includes('Content-Security-Policy')) {
    if (html.includes('<head>')) {
      html = safeReplace(html, '<head>', `<head>\n  ${PREVIEW_CSP}`);
    } else {
      html = `${PREVIEW_CSP}\n${html}`;
    }
  }

  // 3. If project contains React/JSX files, ensure React, Babel Standalone, and CommonJS shims are in head
  if (hasReactFiles && !html.includes('babel.min.js')) {
    const reactBabelScripts = `
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  ${BROWSER_MODULE_SHIM}
`;
    if (html.includes('</head>')) {
      html = safeReplace(html, '</head>', `${reactBabelScripts}</head>`);
    } else {
      html = `${reactBabelScripts}${html}`;
    }
  }

  // 4. Inline CSS files safely
  for (const [path, file] of Object.entries(normalizedFiles)) {
    if (path.endsWith('.css')) {
      const fileName = path.split('/').pop() || path;
      const cssContent = file.content || '';
      const styleTag = `<style>/* ${path} */\n${cssContent}</style>`;

      const linkRegex = new RegExp(
        `<link[^>]*href=["'][^"']*${escapeRegExp(fileName)}["'][^>]*>`,
        'i'
      );

      if (linkRegex.test(html)) {
        html = safeReplace(html, linkRegex, styleTag);
      } else if (html.includes('</head>')) {
        html = safeReplace(html, '</head>', `${styleTag}</head>`);
      } else {
        html = `${styleTag}${html}`;
      }
    }
  }

  // 5. Inline JavaScript / TypeScript / JSX files safely
  for (const [path, file] of Object.entries(normalizedFiles)) {
    const isScript = /\.(js|mjs|jsx|ts|tsx)$/i.test(path);
    const isConfig = path.endsWith('.config.js') || path.endsWith('.config.ts');

    if (isScript && !isConfig) {
      const fileName = path.split('/').pop() || path;
      const jsContent = file.content || '';
      const isBabel = /\.(jsx|tsx|ts)$/i.test(path);
      const scriptType = isBabel ? 'text/babel' : 'text/javascript';
      const sanitizedJs = jsContent.replace(/<\/script/gi, '<\\/script');
      const scriptTag = `<script type="${scriptType}">/* ${path} */\n${sanitizedJs}\n</script>`;

      const scriptRegex = new RegExp(
        `<script[^>]*src=["'][^"']*${escapeRegExp(fileName)}["'][^>]*>\\s*</script>`,
        'i'
      );

      if (scriptRegex.test(html)) {
        html = safeReplace(html, scriptRegex, scriptTag);
      } else if (html.includes('</body>')) {
        html = safeReplace(html, '</body>', `${scriptTag}</body>`);
      } else {
        html = `${html}${scriptTag}`;
      }
    }
  }

  // 6. If React is used, append auto-mount helper before body close
  if (hasReactFiles && !html.includes('Auto-mount failed')) {
    if (html.includes('</body>')) {
      html = safeReplace(html, '</body>', `${REACT_AUTO_MOUNT}</body>`);
    } else {
      html = `${html}${REACT_AUTO_MOUNT}`;
    }
  }

  return html;
}
