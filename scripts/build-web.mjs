import { build } from 'esbuild';
await build({ entryPoints: ['src/web/app.ts'], outfile: 'web/app.js', bundle: true, target: 'es2022', sourcemap: true });
