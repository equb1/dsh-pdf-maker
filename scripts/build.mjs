// Build the dsh-pdf-maker applications from source — the single build mode (pnpm).
//
//   pnpm run build:lib     → lib/index.js (host) + lib/client.js (client bundle)
//   pnpm run build:gateway → artifacts/gateway.cjs (bundled Gateway subprocess)
//   pnpm run build         → all targets
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { build } from 'esbuild'

const target = process.argv[2] ?? 'all'

// Inline-bundle packaging:
//   - everything JS is inlined (packages: 'bundle')
//   - node builtins stay external
//   - the DSH host peer dependencies stay external (the Harness runtime provides them)
//   - large / binary packages stay external and are declared as runtime deps
const hostExternal = [
  ...builtinModules.map((id) => `node:${id}`),
  ...builtinModules,
  // DSH host peers (provided by the Harness runtime, not shipped in the tarball)
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-attachment',
  '@deepseek-ai/dsh-host-webserver',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-skill',
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/schemastery',
  // CJS runtime deps resolved from the plugin's node_modules (never inlined)
  'fontkit',
]

if (target === 'all' || target === 'lib') {
  await rm('lib', { recursive: true, force: true })
  await mkdir('lib', { recursive: true })

  await build({
    entryPoints: ['src/host/index.ts'],
    outfile: 'lib/index.js',
    bundle: true,
    packages: 'bundle',
    external: hostExternal,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    sourcemap: false,
    legalComments: 'none',
  })

  // Browser half: react stays external (the DSH client runtime provides it);
  // everything else is inlined into the single client bundle.
  const client = await build({
    entryPoints: ['src/client/index.tsx'],
    bundle: true,
    write: false,
    packages: 'bundle',
    external: ['react'],
    platform: 'browser',
    target: 'es2022',
    format: 'cjs',
    legalComments: 'none',
  })
  const clientCode = client.outputFiles[0]?.text
  if (clientCode === undefined)
    throw new Error('client build produced no JavaScript')
  // pdfjs-dist v6 accesses `Iterator.prototype.join` at module top-level and
  // assumes the ES2024 `Iterator` global exists. Older browsers without it
  // crash the whole plugin client during load, which hides every preview card.
  // Inject a tiny, safe shim at the very top of the factory so that check
  // never throws. Native `Iterator` (when present) is left untouched.
  const iteratorShim = `if (typeof Iterator === "undefined") {
  globalThis.Iterator = { prototype: {} };
}
if (typeof Iterator.prototype.join !== "function") {
  try { Iterator.prototype.join = function (separator) { return Array.from(this).join(separator); }; } catch (e) {}
}`

  // Inject pdfjs's viewer CSS as a <style> so the PDFViewer renders correctly.
  // The css is read at build time and inlined into the client factory.
  const viewerCssPath = new URL(
    '../node_modules/pdfjs-dist/web/pdf_viewer.css',
    import.meta.url,
  )
  const viewerCss = (await readFile(viewerCssPath, 'utf8'))
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
  const cssInject = `if (typeof document !== "undefined") {
  var _tag = document.createElement("style");
  _tag.dataset.plugin = "dsh-pdf-maker";
  _tag.dataset.pluginCss = "pdfjs-viewer-css";
  _tag.textContent = \`${viewerCss}\`;
  document.head.appendChild(_tag);
}`

  await writeFile(
    'lib/client.js',
    `window.__ModuleLoader__.load({\n  id: "dsh-pdf-maker",\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;\n${iteratorShim}\n${cssInject}\n${indent(clientCode, 4)}\n    return module.exports;\n  }\n});\n`,
  )

  // Ship the pdfjs worker alongside the client so the browser can load it from
  // the same origin (GlobalWorkerOptions.workerSrc → /pdf-api/pdf.worker.mjs).
  // Worker is a JS module, not inlined into the client bundle. It also touches
  // `Iterator.prototype.join` at top level, so prepend the same safety shim.
  const workerSource = new URL(
    '../node_modules/pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  )
  const workerRaw = await readFile(workerSource, 'utf8')
  await writeFile(
    'lib/pdf.worker.mjs',
    `${iteratorShim}\n${workerRaw}`,
  )
  console.log('built lib/index.js + lib/client.js + lib/pdf.worker.mjs')
}

if (target === 'all' || target === 'gateway') {
  const gatewayOut = 'artifacts/gateway.cjs'
  await mkdir('artifacts', { recursive: true })
  await build({
    entryPoints: ['src/gateway-app/gateway-entry.ts'],
    outfile: gatewayOut,
    bundle: true,
    packages: 'bundle',
    external: hostExternal,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    legalComments: 'none',
    sourcemap: false,
  })
  console.log('built', gatewayOut)
}

function indent(value, width) {
  const prefix = ' '.repeat(width)
  return value
    .split('\n')
    .map((line) => (line.length === 0 ? line : `${prefix}${line}`))
    .join('\n')
}
