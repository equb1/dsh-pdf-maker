// Build the dsh-pdf-maker applications from source — the single build mode (pnpm).
//
//   pnpm run build:lib     → lib/index.js (host) + lib/client.js (client bundle)
//   pnpm run build:gateway → artifacts/gateway.cjs (bundled Gateway subprocess)
//   pnpm run build         → all targets
import { mkdir, rm, writeFile } from 'node:fs/promises'
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
  await writeFile(
    'lib/client.js',
    `window.__ModuleLoader__.load({\n  id: "dsh-pdf-maker",\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;\n${indent(clientCode, 4)}\n    return module.exports;\n  }\n});\n`,
  )
  console.log('built lib/index.js + lib/client.js')
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
