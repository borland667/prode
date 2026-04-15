import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

const outdir = 'dist';

// Clean dist
mkdirSync(outdir, { recursive: true });
mkdirSync(`${outdir}/assets`, { recursive: true });

// Bundle React app
await esbuild.build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  outdir: `${outdir}/assets`,
  format: 'esm',
  jsx: 'automatic',
  splitting: true,
  minify: true,
  sourcemap: true,
  target: ['es2020'],
  loader: {
    '.jsx': 'jsx',
    '.js': 'js',
    '.css': 'css',
    '.png': 'file',
    '.svg': 'file',
    '.jpg': 'file',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  entryNames: '[name]-[hash]',
  chunkNames: '[name]-[hash]',
  assetNames: '[name]-[hash]',
});

// Read index.html and inject built assets
let html = readFileSync('index.html', 'utf-8');

// Find the built files
import { readdirSync } from 'fs';
const files = readdirSync(`${outdir}/assets`);
const jsFile = files.find(f => f.startsWith('main-') && f.endsWith('.js'));
const cssFile = files.find(f => f.endsWith('.css'));

// Replace the module script src
html = html.replace(
  '<script type="module" src="/src/main.jsx"></script>',
  `${cssFile ? `<link rel="stylesheet" href="/assets/${cssFile}">` : ''}
    <script type="module" src="/assets/${jsFile}"></script>`
);

writeFileSync(`${outdir}/index.html`, html);

// Copy public files
if (existsSync('public')) {
  const publicFiles = readdirSync('public');
  for (const file of publicFiles) {
    copyFileSync(`public/${file}`, `${outdir}/${file}`);
  }
}

console.log('Build complete! Output in dist/');
