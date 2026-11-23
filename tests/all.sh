#!/bin/sh
# Every check, on the site as a host would serve it: the build, behind a server that compresses and
# answers 404 for files that are gone.
#   sh tests/all.sh             builds, serves dist/ on :4273 and runs everything
#   sh tests/all.sh nobuild     the same without building first
#   sh tests/all.sh nowebkit    leaves out the passes in Safari's engine (WebKitGTK)
# One line per suite: PASS or FAIL, and the lines that failed. See tests/README.md for what it needs.
cd "$(dirname "$0")/.." || exit 1
BASE=http://127.0.0.1:4273/
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
build=1; webkit=1
for arg in "$@"; do case "$arg" in nobuild) build=0 ;; nowebkit) webkit=0 ;; esac; done
if [ $build -eq 1 ]; then npm run build > /dev/null 2>&1 || { echo "BUILD FAILED"; npm run build 2>&1 | tail -20; exit 1; }; fi
node tests/checks/serve.cjs dist 4273 > /dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null' EXIT
sleep 2
cd tests/checks || exit 1
failed=0
run() {
  name=$1; shift
  out=$(timeout 900 "$@" 2>&1); code=$?
  bad=$(printf '%s\n' "$out" | grep -E "^ *(FAIL|not ok)|^[0-9]+ FAILED|FAILED$|^[A-Za-z]*Error:" | head -8)
  if [ $code -ne 0 ] || [ -n "$bad" ]; then failed=$((failed + 1)); echo "FAIL  $name (exit $code)"; printf '%s\n' "$bad" | sed 's/^/      /'; else echo "PASS  $name"; fi
}
# The walks through each layout
run "phone: lock, home, apps"        node phone-flow.cjs $BASE
run "phone: each app"                node phone-apps.cjs $BASE
run "phone: links between apps"      node phone-links.cjs $BASE
run "phone: folders"                 node phone-folders.cjs $BASE
run "phone: the badge"               node badge.cjs $BASE
run "desktop: windows and apps"      node desktop-flow.cjs $BASE
# Arriving, and when it goes wrong
run "arriving"                       node arriving.cjs $BASE
run "a change of layout"             node crossing.cjs $BASE
run "addresses"                      node addresses.cjs $BASE
run "the address follows; reload"    node place.cjs $BASE
# What the audit found, area by area: each fix has its check
run "portfolio and FAQs"             node portfolio-faqs.cjs $BASE
run "terminal and VIP"               node terminal-vip.cjs $BASE
run "wallpapers"                     node wallpapers.cjs $BASE
run "log in and LP Updates"          node account.cjs $BASE
run "desktop shell"                  node desktop-shell.cjs $BASE
run "forced colours, reduced motion" node forced-colours.cjs $BASE
run "messages"                       node messages.cjs $BASE
if [ $webkit -eq 1 ]; then run "folders and search" node folders-search.cjs $BASE; else run "folders and search" node folders-search.cjs $BASE nowk; fi
run "iOS parts, replies, About"      node ios-parts.cjs $BASE
run "phone shell"                    node phone-shell.cjs $BASE
run "between apps"                   node between-apps.cjs $BASE
# Safari's engine, one driver at a time
if [ $webkit -eq 1 ]; then
  for f in ios-parts messages phone-shell portfolio-faqs terminal-vip desktop-shell; do
    pkill -f WebKitWebDriver 2>/dev/null; pkill -f MiniBrowser 2>/dev/null; sleep 1
    run "webkit: $f" node $f-webkit.cjs $BASE
  done
fi
run "accessibility scan (axe)"       node phone-axe.cjs $BASE
echo "---"
[ $failed -eq 0 ] && echo "ALL PASS" || echo "$failed FAILED"
[ $failed -eq 0 ]
