#!/usr/bin/env bun

import { build } from "./tasks/build.js";
import { deploy } from "./tasks/deploy.js";
import { parseArgs } from "util";

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    task: {
      type: 'string',
    },
  },
  strict: true,
  allowPositionals: true,
});

async function runTask(taskName) {
    switch (taskName) {
        case 'build':
            await build();
            break;
        case 'deploy':
            await deploy();
            break;
        case 'watch':
            await import("./tasks/watch.js");
            break;
        default:
            console.log(`Unknown task: ${taskName}`);
            process.exit(1);
    }
}

runTask(values['task']);
