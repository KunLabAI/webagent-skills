#!/usr/bin/env node
// Thin ESM entry so the package works as an npm `bin` without a shebang in
// compiled output. All logic lives in dist/cli.js (built from src/cli.ts).
import { run } from '../dist/cli.js';

run(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
