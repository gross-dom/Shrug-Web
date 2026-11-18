// Runs one of the checks against a site that is out on the network (the deployed one), from a machine
// whose way out is a proxy: every browser the check opens goes through it.
//   node live.cjs place.cjs https://shrug-web.vercel.app/
const path = require('path')
const { chromium } = require('playwright')
const server = process.env.HTTPS_PROXY || process.env.https_proxy
if (server) {
  const launch = chromium.launch.bind(chromium)
  chromium.launch = (options = {}) => launch({ ...options, proxy: { server } })
}
const script = process.argv[2]
process.argv.splice(2, 1)
require(path.resolve(__dirname, script))
