import {parseArgs} from "util";

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    outdir: {
      type: 'string',
    },
  },
  strict: true,
  allowPositionals: true,
});
const outdir = values["outdir"];
const buildOutput = await Bun.build({
  entrypoints: ['./src/turtle.js'],
  outdir: outdir ?? './website/js',
  external: [],
  minify: false,
});
if (!buildOutput.success) {
  console.error(buildOutput.logs);
  throw new Error('Build was not successful.');
}