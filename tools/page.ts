import type { Plugin } from 'vite'
import { answerBlocks, FAQS, type Inline } from '../src/data/faqs'
import { PEOPLE } from '../src/data/people'
import { markSvg } from '../src/data/logo'
import { COMPANIES, COMPANY_COUNT } from '../src/data/portfolio'
import { SITE } from '../src/data/site'
import { ALIASES, APP_IDS, type AppId } from '../src/os/apps'

// What the page is before, without and around the site that runs in it. Two
// plugins for vite.config.ts, both writing from the site's own data so that
// nothing is said twice by hand:
//
//   page()     the words: what a link preview and a search engine read (the
//              head's tags), the plain page inside #root (what is there with
//              scripts off, in a browser too old to draw the site, or when it
//              fails to arrive), robots.txt, sitemap.xml, llms.txt (the same
//              words for a machine that reads text) and 404.html.
//   arrival()  the speed: the built page asks for what it is about to need.

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** How many testimonials the plain page carries. The rest are in the conversation itself. */
const QUOTED = 12

/** Where this build is served from: the address a link preview and a search engine are given. On Vercel
 * that is the project's own address (its domain once it has one, its vercel.app address until then), so
 * that a link to it unfolds with a picture that is there to fetch. Anywhere else it is the site's home,
 * `SITE.url`, unless `SITE_URL` says otherwise when the site is built. */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const served = env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : SITE.url)
const HOME = served.endsWith('/') ? served : `${served}/`

const TITLE = SITE.name
/** What a link to the site says under its name: what Shrug is (`SITE.line`), and then what the site
 * holds, counted from the data. Nothing is said of the fund here that the data does not say. */
const DESCRIPTION = `${SITE.line} On its site: what ${PEOPLE.length} people say about working with it, the ${COMPANY_COUNT} companies in its portfolio, and its answers to the questions it gets asked.`
const PICTURE = `${HOME}og.png`
const PICTURE_SAYS = 'The Testimonials group chat. Shrug asks: ok be honest. what’s it actually like working with us? The first reply is under it.'

/** The head's tags: the description, the address, and what a link unfolds into when it is sent. */
function tags() {
  const about = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.legalName,
    alternateName: SITE.name,
    url: HOME,
    logo: `${HOME}icon-512.png`,
    description: SITE.line,
  }
  return [
    `<meta name="description" content="${esc(DESCRIPTION)}" />`,
    `<link rel="canonical" href="${HOME}" />`,
    `<meta property="og:site_name" content="${esc(SITE.name)}" />`,
    `<meta property="og:title" content="${esc(TITLE)}" />`,
    `<meta property="og:description" content="${esc(DESCRIPTION)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${HOME}" />`,
    `<meta property="og:image" content="${PICTURE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(PICTURE_SAYS)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(TITLE)}" />`,
    `<meta name="twitter:description" content="${esc(DESCRIPTION)}" />`,
    `<meta name="twitter:image" content="${PICTURE}" />`,
    `<meta name="twitter:image:alt" content="${esc(PICTURE_SAYS)}" />`,
    `<script type="application/ld+json">${JSON.stringify(about).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ')
}

/** Where a link to one of the site's own apps goes when there is no app to open: the address that opens it. */
const appAddress = (app: AppId) => `${HOME}?open=${Object.keys(ALIASES).find((name) => ALIASES[name] === app) ?? app}`

/** An answer as plain HTML: its paragraphs, its lists, and the links, the stress and the crossings-out in them. */
function drawn(answer: string) {
  const run = (parts: Inline[]) =>
    parts
      .map((part) => {
        if (typeof part === 'string') return esc(part)
        if ('em' in part) return `<em>${esc(part.em)}</em>`
        if ('struck' in part) return `<s>${esc(part.struck)}</s>`
        return 'app' in part ? `<a href="${esc(appAddress(part.app))}">${esc(part.label)}</a>` : `<a href="${esc(part.href)}" rel="noopener">${esc(part.label)}</a>`
      })
      .join('')
  return answerBlocks(answer)
    .map((block) => (block.kind === 'list' ? `<ul>${block.items.map((item) => `<li>${run(item)}</li>`).join('')}</ul>` : `<p>${run(block.parts)}</p>`))
    .join('')
}

/** The site as plain words: who Shrug is, what is said of it, who it has backed, and the one-pager. */
function plain() {
  const quoted = PEOPLE.filter((person) => person.quote).slice(0, QUOTED)
  const answered = FAQS.filter((faq) => faq.answer)
  const said = quoted.map((person) => `<figure><blockquote>${esc(person.quote!)}</blockquote><figcaption>${esc(person.name)}, ${esc(person.role)}</figcaption></figure>`)
  const backed = COMPANIES.map((company) => {
    const name = company.url ? `<a href="${esc(company.url)}" rel="noopener">${esc(company.name)}</a>` : esc(company.name)
    return `<li>${name}${company.blurb ? `: ${esc(company.blurb)}` : ''}</li>`
  })
  const asked = answered.map((faq) => `<dt>${esc(faq.question)}</dt><dd>${drawn(faq.answer!)}</dd>`)
  return [
    `<main class="plain">`,
    `<noscript><p class="plain-note">This is Shrug’s site in plain words. The site itself is drawn as a desktop, or as an iPhone on a phone, and needs JavaScript: turn it on and reload to see it.</p></noscript>`,
    `<p class="plain-mark" aria-hidden="true">${markSvg(17, '#fff')}</p>`,
    `<h1>${esc(SITE.name)}</h1>`,
    `<p class="plain-line">${esc(SITE.line)}</p>`,
    `<p><a class="plain-go" href="${SITE.onePager}" rel="noopener">Read the one-pager</a></p>`,
    `<h2>What people say</h2>`,
    ...said,
    `<p class="plain-more">And ${PEOPLE.length - quoted.length} more, in the group chat on the site itself.</p>`,
    `<h2>Portfolio</h2>`,
    `<p class="plain-more">${COMPANY_COUNT} companies.</p>`,
    `<ul>`,
    ...backed,
    `</ul>`,
    ...(asked.length ? [`<h2>FAQs</h2>`, `<dl>`, ...asked, `</dl>`] : []),
    `</main>`,
  ].join('\n      ')
}

/** The site as text for a machine that reads no scripts: everything said of Shrug, and every company. */
function text() {
  const said = PEOPLE.filter((person) => person.quote).map((person) => `- “${person.quote}” ${person.name}, ${person.role}`)
  const backed = COMPANIES.map((company) => `- ${company.url ? `[${company.name}](${company.url})` : company.name}${company.blurb ? `: ${company.blurb}` : ''}`)
  // (A link to one of the site's apps is the address that opens it; words crossed out are marked as Markdown marks them)
  const asked = FAQS.filter((faq) => faq.answer).flatMap((faq) => [
    `### ${faq.question}`,
    '',
    faq
      .answer!.replace(/\]\(app:([\w-]+)\)/g, (_, app: AppId) => `](${appAddress(app)})`)
      .replace(/~([^~\s](?:[^~\n]*[^~\s])?)~/g, '~~$1~~'),
    '',
  ])
  return [
    `# ${SITE.name}`,
    '',
    `> ${SITE.line}`,
    '',
    `The site (${HOME}) is interactive: it is drawn as a desktop, or as an iPhone on a phone. This file is what it holds, as text.`,
    '',
    `- [One-pager](${SITE.onePager})`,
    '',
    `## What people say (${said.length})`,
    '',
    ...said,
    '',
    `## Portfolio (${COMPANY_COUNT} companies)`,
    '',
    ...backed,
    '',
    ...(asked.length ? ['## FAQs', '', ...asked] : []),
  ].join('\n')
}

/** The page an address the site does not have is answered with, where the host serves 404.html:
 * `/portfolio`, `/faqs` and the like go to that app; anything else goes to the site. With scripts
 * off it says so and links there. */
function lost() {
  const names = [...APP_IDS, ...Object.keys(ALIASES)]
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Not here · ${esc(SITE.name)}</title>
    <style>
      html { background: #040618; }
      body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; padding: 32px 28px; color: #fff; font: 15px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center; }
      .mark { line-height: 0; }
      h1 { margin: 26px 0 6px; font-size: 19px; line-height: 1.3; font-weight: 600; }
      p { margin: 0; color: rgba(255, 255, 255, 0.72); }
      a { display: inline-block; margin-top: 22px; padding: 12px 20px; border-radius: 22px; background: #fff; color: #040618; font-weight: 600; line-height: 20px; text-decoration: none; }
    </style>
    <script>
      ;(function () {
        // An address that names one of the site's apps opens it; any other is the site
        var names = ${JSON.stringify(names)}
        var asked = decodeURIComponent(location.pathname).replace(/^\\/+|\\/+$/g, '').split('/')[0].toLowerCase()
        location.replace('/' + (names.indexOf(asked) >= 0 ? '?open=' + asked : ''))
      })()
    </script>
  </head>
  <body>
    <div class="mark" aria-hidden="true">${markSvg(18)}</div>
    <h1>That page isn’t here</h1>
    <p>The site is one page. Everything is on it.</p>
    <a href="/">Go to ${esc(SITE.name)}</a>
  </body>
</html>
`
}

export function page(): Plugin {
  return {
    name: 'shrug-page',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        for (const token of ['<!--tags-->', '<!--plain-->', '<!--mark-->']) if (!html.includes(token)) throw new Error(`index.html has lost its ${token} marker (tools/page.ts)`)
        // The logo over the loading bar: the same drawing the site has (src/data/logo.ts)
        return html.replace('<!--tags-->', tags).replace('<!--plain-->', plain).replace('<!--mark-->', markSvg(20, '#fff'))
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${HOME}sitemap.xml\n` })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${HOME}</loc></url>\n</urlset>\n` })
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: text() })
      this.emitFile({ type: 'asset', fileName: '404.html', source: lost() })
    },
  }
}

// What the built page does for a visitor on a slow connection. Two things,
// both to the page Vite writes:
//
// 1. The stylesheet stays first in the head, where its rules must be (the two
//    halves' own stylesheets are added after it and are written to win over
//    it), but no longer holds back the first paint: it is asked for as if for
//    print and switched on when it has arrived, so the loading screen is drawn
//    at once. The loading screen and the site both wait for it before the
//    site is shown (`styled` in index.html, src/os/Desktop.tsx).
// 2. The site is two downloads after the first: the desktop, or the iPhone
//    (src/os/Desktop.tsx). Which one a screen needs is known before any script
//    has arrived, so the page asks for it straight away, alongside the first
//    script, rather than after it. The rule is the one in src/os/wm.ts; if the
//    two ever disagree the cost is one wasted download, nothing else.
export function arrival(): Plugin {
  let base = '/'
  return {
    name: 'shrug-arrival',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // A stylesheet asked for as if for print is fetched last of all; the preload beside it has it fetched first
        html = html.replace(/<link rel="stylesheet"([^>]*)>/g, (_, rest: string) => {
          const told = rest.replace(/\s*\/$/, '')
          return `<link rel="preload" as="style"${told}>\n    <link rel="stylesheet"${told} media="print" data-styles onload="this.onload=null;this.media='all'">`
        })

        // Each half's files: its own script, the scripts that one imports, and their stylesheets
        const chunks = Object.values(ctx.bundle ?? {}).flatMap((file) => (file.type === 'chunk' ? [file] : []))
        const named = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
        const filesOf = (source: string) => {
          // (found by the module it was made for, or, where the chunk also hands something to another chunk and
          // so is no module's own face any more, by having that module in it)
          const start = chunks.find((chunk) => chunk.isDynamicEntry && chunk.facadeModuleId?.endsWith(source)) ?? chunks.find((chunk) => chunk.isDynamicEntry && Object.keys(chunk.modules).some((id) => id.endsWith(source)))
          if (!start) return null
          const seen = new Set<string>()
          const files: string[] = []
          const visit = (name: string) => {
            const chunk = named.get(name)
            if (!chunk || chunk.isEntry || seen.has(name)) return
            seen.add(name)
            files.push(name, ...(chunk.viteMetadata?.importedCss ?? []))
            chunk.imports.forEach(visit)
          }
          visit(start.fileName)
          return [...new Set(files)].map((name) => base + name)
        }
        const desk = filesOf('/src/os/Surface.tsx')
        const phone = filesOf('/src/phone/Phone.tsx')
        // One file for everything (tools/preview.cjs builds it so): nothing to ask for
        if (!desk || !phone) return html
        // The type the site is set in where Apple's own is not installed (src/styles/base.css)
        const type = Object.keys(ctx.bundle ?? {}).find((name) => /inter-latin-wght-normal[^/]*\.woff2$/.test(name))

        const ask = `<script>
      ;(function () {
        // The half of the site this screen shows, asked for now (the rule is src/os/wm.ts's)
        var phone = /[?&]phone\\b/.test(location.search) || (window.__shrugHost && window.__shrugHost.phone === true) || innerWidth < 740 || innerHeight < 480
        var files = phone ? ${JSON.stringify(phone)} : ${JSON.stringify(desk)}
        function ask(rel, as, href, type) {
          var link = document.createElement('link')
          link.rel = rel
          if (as) link.as = as
          if (type) link.type = type
          link.crossOrigin = ''
          link.href = href
          document.head.appendChild(link)
        }
        for (var i = 0; i < files.length; i++) {
          if (/\\.css$/.test(files[i])) ask('preload', 'style', files[i])
          else ask('modulepreload', '', files[i])
        }
        // Where Apple's own type is not installed the site is set in Inter: asked for now, so that it is
        // there by the time there are words to set
        var type = ${JSON.stringify(type ? base + type : '')}
        if (type && !/Macintosh|iPhone|iPad|iPod/.test(navigator.userAgent)) ask('preload', 'font', type, 'font/woff2')
      })()
    </script>`
        return html.replace(/([ \t]*)<\/head>/, (end, indent: string) => indent + '  ' + ask + '\n' + end)
      },
    },
  }
}
