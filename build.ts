import { parseArgs } from 'util';
import type { BuildConfig } from 'bun';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    outdir: { type: 'string' },
  },
  strict: true,
  allowPositionals: true,
});

const outdir = values['outdir'] ?? './build';

const configs: Array<BuildConfig> = [
  {
    entrypoints: ['./src/turtle-devtools.js'],
    outdir: `${outdir}/esm`,
    target: 'bun',
    format: 'esm',
    external: ['basic-ftp', 'ssh2'],
    minify: false,
  },
  {
    entrypoints: ['./src/turtle-devtools.js'],
    outdir: `${outdir}/cjs`,
    target: 'node',
    //format: 'cjs',
    external: ['basic-ftp', 'ssh2'],
    minify: false,
  },
];

for (const config of configs) {
  const buildOutput = await Bun.build(config);
  if (!buildOutput.success) {
    console.error(buildOutput.logs);
    throw new Error('Build was not successful.');
  } else {
    console.log(`Build successful for format ${config.format}`);
  }
}