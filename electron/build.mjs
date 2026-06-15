import { build } from 'esbuild'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outdir = path.join(root, 'dist-electron')

/**
 * Resolve TypeScript's `.js`-means-`.ts` import convention (used in
 * server/aircraftFeed.ts) so esbuild can bundle the server cleanly.
 */
const tsExtResolve = {
  name: 'ts-ext-resolve',
  setup(b) {
    b.onResolve({ filter: /\.js$/ }, (args) => {
      if (args.kind === 'entry-point' || !args.path.startsWith('.')) return
      const abs = path.resolve(args.resolveDir, args.path)
      if (fs.existsSync(abs)) return
      const tsPath = abs.replace(/\.js$/, '.ts')
      if (fs.existsSync(tsPath)) return { path: tsPath }
      return
    })
  },
}

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  logLevel: 'info',
  plugins: [tsExtResolve],
  // The package is "type": "module", so CJS output must use a .cjs extension
  // to be loaded as CommonJS by both Node and Electron.
  outExtension: { '.js': '.cjs' },
}

await build({
  ...common,
  entryPoints: { main: path.join(root, 'electron', 'main.ts') },
  outdir,
  // Electron provides these at runtime; never bundle them.
  external: ['electron'],
})

await build({
  ...common,
  entryPoints: { serve: path.join(root, 'server', 'serve.ts') },
  outdir,
})

console.log('Electron bundles written to dist-electron/')
