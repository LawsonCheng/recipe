#!/usr/bin/env node

console.error(`
LEGACY PER-ASSET APPROVAL BLOCKED

Production approval requires complete, independent, exact-set visual QA
reports. A single command-line confirmation must not bypass that review.

Use:
  npm run images:visual-qa:consolidate -- <all review report paths>
  npm run images:visual-qa:apply -- tmp/visual-qa/final-consolidated.json
`.trim());

process.exitCode = 2;
