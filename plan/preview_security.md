# Preview Sandbox Security Specification & Audit (T21)

## 1. Exact CSP and Sandbox Attributes in Use

### Sandbox Attribute
In `app/src/components/LivePreview.tsx`:
```html
<iframe
  ref={iframeRef}
  srcDoc={srcDoc}
  title="Sandbox Preview"
  sandbox="allow-scripts allow-modals allow-forms"
  className="w-full h-full border-none"
/>
```

**Critical Security Invariant**: `allow-same-origin` is **STRICTLY EXCLUDED**.
Under the HTML Living Standard § 4.8.5:
When `allow-same-origin` is omitted from the `sandbox` attribute, the document inside the iframe is placed into a unique, opaque origin (`origin: "null"`).

### Content Security Policy (CSP)
In `app/src/lib/preview-generator.ts`:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https://cdn.tailwindcss.com https://unpkg.com; img-src * data: blob:; connect-src *;">
```

| Directive | Allowed Sources | Security Rationale |
| :--- | :--- | :--- |
| `default-src` | `'self'`, `'unsafe-inline'`, `'unsafe-eval'`, `data:`, `blob:`, `cdn.tailwindcss.com`, `unpkg.com` | Allows loading vetted CDNs (React 18, Babel Standalone, Tailwind CSS) and running inlined generated app code. |
| `img-src` | `* data: blob:` | Enables images from any source for realistic web application previews. |
| `connect-src` | `*` | Permits client-side preview apps to fetch mock APIs (e.g. weather, public REST APIs). |

---

## 2. Babel Standalone and 'unsafe-eval' Analysis

### Why Babel Standalone Forces `'unsafe-eval'`
Babel Standalone (`@babel/standalone`) parses JSX, TSX, and modern ES syntax in the browser into an Abstract Syntax Tree (AST), transpiles it into standard ES5/ES6, and executes the compiled JavaScript string using `new Function(...)` or dynamic `eval(...)`.

If `'unsafe-eval'` is omitted from the CSP, the browser halts execution immediately:
```
EvalError: Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script in the following Content Security Policy directive: "default-src 'self' ..."
```

Furthermore, inlined user scripts and dynamic CSS require `'unsafe-inline'`.

### What We Did About It (Defense-in-Depth)
Because in-browser transpilation requires `'unsafe-eval'`, granting eval rights without proper isolation would be disastrous. We implemented a strict defense-in-depth architecture:

1. **Opaque Origin (`origin: "null"`)**: By omitting `allow-same-origin` from the iframe sandbox, modern browser sandboxing rules force the preview into a `null` origin. Even if malicious code executes via `eval()`:
   - It cannot access `window.parent.document` (throws `SecurityError: Blocked a frame with origin "null" from accessing a cross-origin frame`).
   - It cannot access parent DOM nodes or inject keyloggers.
   - It cannot access parent `document.cookie` or parent `window.localStorage`.
2. **Credential Stripping on Network Requests**: In cross-origin requests from a `null` origin, browsers do not attach same-site cookies by default.
3. **No Top-Level Navigation**: We omitted `allow-top-navigation` and `allow-popups-to-escape-sandbox`, preventing the preview from redirecting the parent application or displaying phishing prompts.

---

## 3. Sandboxed Storage Shim (`localStorage` & `sessionStorage`)

### The Browser Access-Denied Failure
When an iframe runs with `sandbox="allow-scripts"` and without `allow-same-origin`, standard browser implementations (Chrome, Firefox, Safari, Edge) throw a synchronous `DOMException`:
```
DOMException: Failed to read the 'localStorage' property from 'Window': Access is denied for this document.
```
Any generated component or library that attempts to use `localStorage` (e.g., Todo list persistence, dark mode toggles) crashes on launch.

### In-Memory Shim Implementation
We inject an in-memory storage shim at the top of the preview `<head>` (before any user code runs). It performs an active probe:
```javascript
try {
  var testKey = '__test_storage__';
  window.localStorage.setItem(testKey, '1');
  window.localStorage.removeItem(testKey);
} catch (e) {
  var memLocalStorage = createMemoryStorage();
  try {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      enumerable: true,
      get: function() { return memLocalStorage; }
    });
  } catch (_) {
    window.localStorage = memLocalStorage;
  }
}
```
The polyfill exposes a compliant `Storage` interface:
- `getItem(key)`: retrieves stored string or `null`
- `setItem(key, val)`: stores string value
- `removeItem(key)`: deletes key
- `clear()`: resets store
- `key(index)`: retrieves key by numeric index
- `length`: returns active count of keys

---

## 4. Parent `event.source` postMessage Verification

In `app/src/components/LivePreview.tsx`:
```typescript
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    // Security Check: Verify that event.source matches our preview iframe's contentWindow
    // Strictly prevents spoofed postMessages from external windows or other frames
    if (iframeRef.current && iframeRef.current.contentWindow) {
      if (event.source !== iframeRef.current.contentWindow) {
        return;
      }
    }

    if (event.data && event.data.type === 'WATCHDOG_ERROR') {
      const errMsg = event.data.message || 'Unknown runtime error';
      setRuntimeError(errMsg);
    }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

### Why checking `event.origin` alone is insufficient
Because the sandboxed iframe has an opaque origin, `event.origin` is serialized as the string `"null"`.
Checking `event.origin === 'null'` would allow **ANY** other sandboxed iframe, data URI, or malicious third-party frame on the user's machine to send spoofed watchdog events!
Checking `event.source === iframeRef.current.contentWindow` cryptographically and referentially checks that the message originated precisely from the specific iframe element instance managed by React.

---

## 5. Security Verification Record

### Automated Unit Tests
Automated in `app/src/__tests__/preview-security.test.ts`:
1. CSP and sandbox string assertion (verifies absence of `allow-same-origin`).
2. Storage shim execution test: tests that when native storage throws, `createMemoryStorage` polyfill correctly implements `setItem`, `getItem`, `removeItem`, `clear`, `key`, and `length`.
3. `event.source` isolation test: simulates parent message event receiver, asserting that messages from foreign sources are rejected while messages matching `iframe.contentWindow` are accepted.

### Manual Verification Protocol
*To be executed in Chrome/Firefox/Safari:*
1. Start the development server: `npm run dev` and navigate to `http://localhost:3000`.
2. Generate an app with malicious code injected into `app.js`:
   ```javascript
   // Attempt 1: Read parent cookie
   try {
     console.log('Parent cookie:', window.parent.document.cookie);
   } catch (e) {
     console.log('Blocked cookie read:', e.message);
   }

   // Attempt 2: Read parent localStorage
   try {
     console.log('Parent localStorage:', window.parent.localStorage.getItem('token'));
   } catch (e) {
     console.log('Blocked localStorage read:', e.message);
   }

   // Attempt 3: Fetch parent API route with credentials
   fetch('/api/chat', { method: 'POST', credentials: 'include' })
     .then(r => console.log('Fetch status:', r.status))
     .catch(e => console.log('Fetch error:', e.message));
   ```
3. Open Browser DevTools Console:
   - **Expected Result 1**: `DOMException: Blocked a frame with origin "null" from accessing a cross-origin frame.`
   - **Expected Result 2**: `DOMException: Blocked a frame with origin "null" from accessing a cross-origin frame.`
   - **Expected Result 3**: Request is sent with `Origin: null`; parent session credentials/cookies are NOT transmitted.
