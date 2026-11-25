'use strict';
// Runs the suite and writes results.csv (Test Case ID, Status, Failure note) for the TDR's
// "Actual Output" / "Status" columns.   Usage: npm run report
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap'], { encoding: 'utf8', env: process.env });
const lines = (r.stdout || '').split('\n');
const rows = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^\s*(not ok|ok) \d+ - (TC-AI-[A-Z]+-\d+): (.*?)\s*(#.*)?$/);
  if (!m) continue;
  let note = '';
  if (m[1] === 'not ok') {
    const msg = lines.slice(i + 1, i + 40).find((l) => /error:|message:/i.test(l));
    note = (msg || '').replace(/^\s*(error|message):\s*/i, '').replace(/['"]/g, '').trim();
  }
  rows.push([m[2], m[1] === 'ok' ? 'PASS' : 'FAIL', note]);
}
rows.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
const csv = ['Test Case ID,Status,Failure note', ...rows.map((x) => x.map((v) => `"${v}"`).join(','))].join('\n');
fs.writeFileSync('results.csv', csv + '\n');
const pass = rows.filter((x) => x[1] === 'PASS').length;
console.log(`results.csv written: ${pass} PASS, ${rows.length - pass} FAIL, ${rows.length} total`);
process.exit(r.status === 0 ? 0 : 1);
