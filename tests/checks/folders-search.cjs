// Fixer S2 (the Home Screen's two folders, and Home Screen search): every fix, checked in one go.
//   node folders-search.cjs [base] [nowk]        base defaults to the dev server; `nowk` leaves the WebKit pass out
// It runs the four part scripts in turn and exits non-zero if any check in any of them fails:
//   folders-home.cjs    PH-2, PH-5: how the folders are drawn at fifty-odd screen sizes, and that what is drawn fits
//   folders-open.cjs    PH-15, AX-5, AX-7, AX-13, AX-19 / PH-12, AX-26: an open folder (keyboard, strip, motion, fit)
//   search.cjs  UX-13, PH-9, PH-12, AX-11: search (what comes first, nothing found, Return, roles, the field)
//   folders-webkit.cjs      the same rules read by WebKit (Safari's engine), and nothing thrown there
const { spawnSync } = require('child_process')
const path = require('path')
const base = process.argv[2] && /^https?:/.test(process.argv[2]) ? process.argv[2] : process.env.BASE || 'http://127.0.0.1:5173/'
const parts = ['folders-home.cjs', 'folders-open.cjs', 'search.cjs', ...(process.argv.includes('nowk') ? [] : ['folders-webkit.cjs'])]
let failed = 0
for (const part of parts) {
  const run = spawnSync(process.execPath, [path.join(__dirname, part), base], { encoding: 'utf8', env: process.env, timeout: 9 * 60 * 1000 })
  const lines = (run.stdout + run.stderr).split('\n').filter(Boolean)
  const bad = lines.filter((line) => /^FAIL|FAILED$|^\w*Error:|^\s+at /.test(line))
  const passed = lines.filter((line) => /^ok /.test(line)).length
  const ok = run.status === 0
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${part}: ${ok ? lines[lines.length - 1] : `exit ${run.status ?? run.signal}`}${passed ? ` (${passed} checks passed)` : ''}`)
  for (const line of bad.slice(0, 20)) console.log('     ' + line.slice(0, 300))
}
console.log(failed ? `S2: ${failed} of ${parts.length} parts FAILED` : `S2: all ok (${base})`)
process.exit(failed ? 1 : 0)
