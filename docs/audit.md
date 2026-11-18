# The audit

In November 2026 the whole site was gone over by seven testers, each a different visitor, and what they found was fixed. This is the record: who looked, what they found, and what became of each finding.

## Who looked

| Tester | Looked at | Found |
| --- | --- | --- |
| A founder on her phone, then her laptop (also the editor) | The first minute, dead ends, every word, dates, link previews | 26 |
| A founder who pokes at everything | The desktop with a mouse and a keyboard, 760px to 4K, zoomed | 19 |
| A partner on an iPad and a touch laptop | Touch on the desktop, turning, the sizes between phone and laptop | 21 |
| A keyboard and screen-reader user, with colleagues at 400% zoom and with reduced motion | Both layouts: keys, focus, names, contrast, forced colours, time limits | 27 |
| Someone with whatever phone is to hand | Every iPhone screen at 15 sizes, upright, on its side, framed | 15 |
| Someone on a train with two bars | Slow and failed loads, scripts off, old browsers, long sessions, strange addresses | 23 |
| A nineteen-year-old who taps before things finish | Double taps, taps mid-move, gestures, Back and Forward mashed, nonsense in every field | 19 |

About 150 findings, a good many of them the same fault seen from two or three sides. Five were blocking: no key woke the screen saver (four testers); the framed iPhone was cut off in a short or zoomed window with nothing to scroll (three); and the page was blank for good with scripts off, when a file failed to arrive, and when the layout changed with the connection gone.

## How it was tested, and what that leaves

Playwright's Chromium, at every size from a 280px phone to a 4K desktop: with touch, with a keyboard only, slowed down, throttled to 3G, offline, with scripts off, with reduced motion and with forced colours. WebKitGTK (Safari's engine) for what engines differ on. Every finding was reproduced by a script before it was written down, and each fix is checked by one (`tests/`).

Not available, so not tested: real iPhones, Androids and iPads; Firefox; a real screen reader; a real Windows High Contrast theme; the sites the links go to. Where a finding rests on emulation (safe areas, a phone's keyboard), it says so.

Severity: **P0** blocked or blank · **P1** clearly wrong for many people · **P2** polish a careful eye notices · **P3** would make it smarter.

## What became of each finding


### First-time visitor, copy and product sense

| | | Finding | Outcome |
| --- | --- | --- | --- |
| UX-1 | P1 | No way to reach Shrug | Fixed: one way to Shrug (`reach()` in `src/data/site.ts`) is used wherever one is offered. **Needs Shrug:** the address itself. |
| UX-2 | P1 | Not Delivered explains nothing | Fixed: the red mark is a button; it says the conversation is a recording and offers Shrug's address (once there is one), the one-pager, or deleting the message. |
| UX-3 | P1 | Access request ends in "prototype: nothing has been sent." | Fixed: the terminal no longer asks for an email it cannot use; it links the two public case studies and the way to ask for the rest. |
| UX-4 | P1 | FAQs show an editor's note | Fixed: a line for the visitor and the one-pager; the editor's note only with `?draft`. **Needs Shrug:** the answers. |
| UX-5 | P1 | VIP shows PHOTO SLOT / [Name] | Fixed: quiet tiles with the drop's name, nothing counted that is not there; the slots only with `?draft`. **Needs Shrug:** the pictures. |
| UX-6 | P1 | Nothing says who Shrug is | Fixed: one sentence (`SITE.line`) in About, Settings, the description, the link preview and the plain page. **Needs Shrug:** their own sentence. |
| UX-7 | P1 | Link preview: relative picture, no canonical | Fixed: full addresses, a canonical link, site name, alt text and Twitter tags, written from `SITE.url`; the picture carries the mark. |
| UX-8 | P2 | No-script page says nothing | Fixed: the site in plain words is inside the page, written from the data at build time. |
| UX-9 | P2 | No robots.txt, sitemap, 404, favicon.ico | Fixed: `robots.txt`, `sitemap.xml`, `llms.txt`, `404.html` and `favicon.ico`. |
| UX-10 | P2 | Dates in the visitor's language inside English UI | Fixed: one formatter, English, visitor's clock |
| UX-11 | P2 | 24-hour clock loses its zero | Fixed: in the same formatter |
| UX-12 | P2 | Screen saver starts over a conversation being read | Fixed: not while replies are arriving in front |
| UX-13 | P2 | Search misses the site's own nouns; No Results is a dead end | Fixed: aliases, one-pager + Settings pages as rows, two ways on under No Results |
| UX-14 | P2 | Lock Screen: a tap does nothing; torch and camera dead | Fixed: tap bounces + shows hint, second tap opens; torch toggles, camera answers |
| UX-15 | P2 | Desktop icons need a double-click | Fixed: a click on a selected icon opens it; label |
| UX-16 | P2 | Seven companies with no site are dead tiles | Fixed: "No website listed" where the link would be (not "No longer online": some of them are still running); a preview instead of a dead double-click; a note per company for Shrug to fill. |
| UX-17 | P2 | Video button opens Details | Fixed: answers in character |
| UX-18 | P2 | 60 company links are http | Left: the 60 links could not be reached from where this was built, and a wrong https is a dead link. **To verify** from a machine with a network. |
| UX-19 | P2 | Copy inconsistencies | Fixed: each line |
| UX-20 | P3 | Testimonial slips | **For Shrug:** two slips to check against the authors' own text (Ashton Kutcher, Maggie Norris); `caseStudies.ts` lists Feastables, which is not among the companies. |
| UX-21 | P3 | Address never changes | Fixed afterwards: the address follows the visitor on both layouts (`?open=portfolio&at=eight-sleep`), so a copied link, or Share, opens where they were. |
| UX-22 | P3 | Terminal answers "y or n." to everything | Fixed: help, ls, open, clear, whoami |
| UX-23 | P3 | Conversation ends with nothing after it | Fixed: a closing link bubble |
| UX-24 | P3 | Screen saver shows a name without the words | Fixed: the words over the name |
| UX-25 | P3 | Easter-egg copy risks | Fixed: the two factual risks (a sender that could be someone's number; a code that read as real). The rest of that copy is Shrug's to write. |
| UX-26 | P3 | noreferrer hides Shrug from its companies | Fixed: noopener on company links |

### Desktop, with a mouse and a keyboard

| | | Finding | Outcome |
| --- | --- | --- | --- |
| DK-1 | P1 | Screen saver: no key wakes it | Fixed |
| DK-2 | P1 | Case Studies: no way back out of the email question | Fixed |
| DK-3 | P1 | Framed iPhone cut off under ~456px tall, nothing scrolls | Fixed |
| DK-4 | P2 | A message sent after scrolling back never comes into view | Fixed |
| DK-5 | P2 | Search finds people who have not replied yet | Fixed |
| DK-6 | P2 | Screen saver starts mid-conversation, chat plays on behind it | Fixed |
| DK-7 | P2 | Windows squashed in the corner after the browser shrinks and grows | Fixed |
| DK-8 | P2 | Messages under 640px loses its list and search | Fixed |
| DK-9 | P2 | Portfolio list view cuts names | Fixed |
| DK-10 | P2 | Search fields ignore Enter, ArrowDown, Escape; clear drops focus | Fixed |
| DK-11 | P2 | Small desktops: windows open jammed against edges | Fixed |
| DK-12 | P3 | Terminal answers "y or n." to everything | Fixed |
| DK-13 | P3 | No-site company says nothing; two tiles read "Atoms" | Fixed |
| DK-14 | P3 | Big screens: every window opens in one central pile | Fixed: on a big desk a new window lands beside what is open. |
| DK-15 | P3 | Focus lost after some actions | Fixed |
| DK-16 | P3 | Dock badge silent when chat is wholly covered | Fixed: the group counts as seen only while its window can be seen (not when wholly covered). |
| DK-17 | P3 | Select All spans windows; draggable links; avatars selectable | Fixed |
| DK-18 | P3 | Screen saver clock keeps day period outside English | Fixed |
| DK-19 | P3 | VIP tile on desktop opens nothing | Fixed: a tile with a file opens large (arrows, Escape); an empty one is not a button. |

### Tablets and hybrids: touch on the desktop

| | | Finding | Outcome |
| --- | --- | --- | --- |
| tb-1 | P0 | No key wakes the screen saver | Fixed |
| tb-2 | P1 | The tap that wakes the saver also presses what is under it | Fixed |
| tb-3 | P1 | Terminal: a finger only gets the caret on the 26px prompt line | Fixed |
| tb-4 | P1 | Turning a tablet swaps the desktop for a locked iPhone; nothing comes along | Fixed |
| tb-5 | P1 | A keyboard shrinking the page under 480px swaps layouts mid-typing | Fixed |
| tb-6 | P2 | Unsent words lost when the layout changes | Fixed |
| tb-7 | P2 | A window cannot be resized with a finger | Fixed |
| tb-8 | P2 | Small touch targets on the desktop | Fixed |
| tb-9 | P2 | Hybrids get mouse sizes | Fixed |
| tb-10 | P2 | Send / clear buttons take the caret | Fixed |
| tb-11 | P2 | Saver mid-conversation; hint names nothing a touch screen has | Fixed |
| tb-12 | P2 | Opening window covers the One-pager icon on upright iPads | Fixed |
| tb-13 | P3 | Green light's choices never show for a finger; edge tiling needs 3px | Fixed |
| tb-14 | P3 | Windows pushed in by a turn do not go back | Fixed |
| tb-15 | P3 | Tap outside an open menu also presses what is under it | Fixed |
| tb-16 | P3 | iPad mini upright is 16px short of the desktop | Fixed: the line is 740 wide, so an iPad mini is a desktop both ways up. |
| tb-17 | P3 | Terminal could offer y / n to tap on touch | Fixed |
| tb-s1 | suspected | Dock label left hanging after a tap | Fixed |
| tb-s2 | suspected | Double tap may zoom on iPad | Fixed |
| tb-s3 | suspected | iPad keyboard leaves the page nudged up | Fixed as far as it can be without a device: the page is scrolled back when a field loses the keyboard. |
| tb-s4 | suspected | Back swipe leaves the site from the desktop | Left: the desktop adds no steps to the browser's history, so there is nothing to give that swipe. |

### Accessibility

| | | Finding | Outcome |
| --- | --- | --- | --- |
| AX-1 | P0 | No key wakes the screen saver; it swallows every key | Fixed; desk inert under it, saver labelled |
| AX-2 | P0 | Zoomed in, the framed iPhone is cut off and nothing scrolls | Fixed: the frame is drawn only where it fits at a readable size; otherwise the phone is edge to edge and reflows. |
| AX-3 | P1 | Forced colours: windows lose edges and lights | Fixed |
| AX-4 | P1 | Forced colours: on/off, selected, focused look the same | Fixed |
| AX-5 | P1 | Focus ring too faint (2.3:1 on white, 1.2:1 on the Home Screen) | Fixed |
| AX-6 | P1 | Saver covers the playing conversation; cannot be turned off | Fixed + "Screen Saver: Never", remembered |
| AX-7 | P1 | Focus dropped on close, not taken on open | Fixed |
| AX-8 | P2 | Replies never announced; whose message is whose | Fixed |
| AX-9 | P2 | iPhone sheets do not hold Tab | Fixed |
| AX-10 | P2 | Three Tab stops show nothing | Fixed |
| AX-11 | P2 | Lists do not say which item is active | Fixed |
| AX-12 | P2 | + menu and iPhone menus ignore the arrow keys | Fixed |
| AX-13 | P2 | Reduced motion leftovers | Fixed |
| AX-14 | P2 | Reduced motion drops the reader at the end of 90 replies | Fixed |
| AX-15 | P2 | Desktop contrast: faint grey and five others | Fixed |
| AX-16 | P2 | Title never changes; screens without a heading | Fixed |
| AX-17 | P2 | Auto-Lock not remembered; locks under a reader | Fixed |
| AX-18 | P2 | App Switcher and closing an app need a drag | Fixed |
| AX-19 | P2 | Folder page dots 15x24 | Fixed |
| AX-20 | P2 | Replies can be paused from one place only | Fixed |
| AX-21 | P2 | Forced colours: bubbles, fields, buttons lose shape | Fixed |
| AX-22 | P3 | axe on the desktop: five small rule failures | Fixed |
| AX-23 | P3 | Names that would read better | Fixed |
| AX-24 | P3 | Windows cannot be moved or sized from the keyboard; 12px lights | Fixed |
| AX-25 | P3 | Tab walks every window before the Dock | Fixed |
| AX-26 | P3 | Text spacing breaks the FAQs folder face | Fixed |
| AX-s | suspected | Not Delivered silent; page div unlabelled; search live region rereads | Fixed: Not Delivered is announced; a pushed screen is named; search announces only how many results there are. |

### The iPhone layout on every size

| | | Finding | Outcome |
| --- | --- | --- | --- |
| PH-1 | P1 | Window under 463px tall cuts the framed phone off | Fixed: the frame is drawn only where it fits at 0.68 of its size or more; otherwise edge to edge. |
| PH-2 | P1 | Folders left off screens they fit on; Search lands on icon names at 430x660 | Fixed: large where they fit (by width and height), icon-sized folders among the icons where they do not, left off only on a very short screen. |
| PH-3 | P2 | On its side, Lock Screen notification dead over most of it | Fixed |
| PH-4 | P2 | On its side, menus run under the foot bar | Fixed |
| PH-5 | P2 | On its side on small phones, folders collide, stray letters, Search on names | Fixed |
| PH-6 | P2 | On its side, nothing keeps clear of side safe areas | Fixed, on emulated safe areas (no real notched phone here): everything pressable keeps inside the side bands, search and the open folder included. |
| PH-7 | P2 | At 280px: clock clipped, names collide, VIP search half off | Fixed |
| PH-8 | P2 | The fade above the foot bar swallows touches | Fixed |
| PH-9 | P3 | Search keeps a Dock's height free where there is no Dock | Fixed |
| PH-10 | P3 | On its side with the keyboard up, only bars are left | Fixed |
| PH-11 | P3 | Framed phone's type very small in short windows | Fixed |
| PH-12 | P3 | Small targets: Search pill, page dots, clear buttons | Fixed |
| PH-13 | P3 | Swipe-home strip 5px taller than the gap under foot controls | Fixed |
| PH-14 | P3 | Lock hint under the home bar with a bottom safe area | Fixed |
| PH-15 | P3 | Folder opened by keyboard gets a blue rectangle | Fixed |

### Loading, failure, time and odd ways of arriving

| | | Finding | Outcome |
| --- | --- | --- | --- |
| RS-1 | P0 | Scripts off: an empty dark screen | Fixed: the plain page is inside `#root`. |
| RS-2 | P0 | A script fails or stalls: blank for good | Fixed: a loading screen with states (still loading, didn't load, needs a newer browser) and a card at the root with another go. |
| RS-3 | P0 | Resize across the line offline blanks a working page | Fixed: a card, the other half fetched ahead of need, and going back to the size that worked brings that layout back. |
| RS-4 | P0 | Screen saver cannot be woken by a key | Fixed; Ctrl/Meta/Alt keys pass through |
| RS-5 | P1 | Auto-lock with an app open draws the Lock Screen through the app | Fixed |
| RS-6 | P1 | Phones download the desktop wallpaper too (180 KB) | Fixed: the desktop's wallpaper is asked for only where it shows. |
| RS-7 | P1 | Older browsers: blank or broken, nothing said | Fixed: a check before the site starts, a card that says so, the plain version, and Continue Anyway where the site did start. |
| RS-8 | P1 | Nothing to look at while loading | Fixed |
| RS-9 | P2 | Phone stylesheet not waited for (each half imported twice) | Fixed: each half is asked for once, and that asking is what everything waits on. |
| RS-10 | P2 | A logo that fails shows a broken picture, never retried | Fixed |
| RS-11 | P2 | Back from another tab, the phone locks within a second | Fixed |
| RS-12 | P2 | Waking tap presses what is under it | Fixed |
| RS-13 | P2 | Windows/Android: type arrives late and swaps | Fixed: the type is asked for at once where Apple's is not installed, and never swapped in under a reader. |
| RS-14 | P2 | 60 company links are http | Left (see UX-18). |
| RS-15 | P2 | Saver over a conversation still arriving | Fixed |
| RS-16 | P3 | No robots.txt | Fixed (see UX-9). |
| RS-17 | P3 | Reload restarts the conversation; desktop forgets windows | Fixed for the conversation, the visitor's notes, favourites, drafts and settings; and afterwards for the desktop, whose windows come back after a reload as they were left. |
| RS-18 | P3 | Layout chunk waits for the main script; phone carries desktop styles | Fixed: the half a screen needs is asked for alongside the first script. Left: moving stylesheets between the downloads (it would reorder the cascade). |
| RS-19 | P3 | Address switches could forgive more | Fixed |
| RS-20 | P3 | `?open=` shows the Lock Screen first | Fixed |
| RS-21 | P3 | Saver runs a script 56 times a second | Left: it is what a screen saver does, and only while it shows. |
| RS-22 | P3 | Tab brought back offline is the browser's error page | Left: a service worker's risk of serving a stale site outweighs it here. |
| RS-23 | P3 | Conversation ends on a shrug | Fixed |

### Behaviour under pressure

| | | Finding | Outcome |
| --- | --- | --- | --- |
| MK-1 | P1 | A tap on a Switcher card also presses what is under it in the app | Fixed |
| MK-2 | P1 | A second tap lands on whatever arrives under the finger | Fixed |
| MK-3 | P2 | Home bar does nothing while a folder or search is open | Fixed |
| MK-4 | P2 | Back with search open leaves the site | Fixed |
| MK-5 | P2 | An app left quickly after the switcher loses its opening and closing | Fixed |
| MK-6 | P2 | A long word in search pushes "No Results" off screen | Fixed |
| MK-7 | P2 | A reload forgets what the visitor made; can land on an empty "Notes" | Fixed: notes, folders, favourites, drafts, settings and the conversation are kept in the visitor's own browser; a place that no longer exists shows its parent. |
| MK-8 | P2 | A sheet can only be swiped away by its bar | Fixed |
| MK-9 | P2 | The keyboard gets behind every sheet | Fixed |
| MK-10 | P2 | A home-bar swipe taken back, or sideways, still goes Home | Fixed |
| MK-11 | P3 | Very long folder names | Fixed |
| MK-12 | P3 | Half a message lost by going Back | Fixed |
| MK-13 | P3 | Messages keeps its search after being flicked out | Fixed |
| MK-14 | P3 | New Folder again right after Done: old name, no keyboard | Fixed |
| MK-15 | P3 | Escape means three things in five search fields | Fixed |
| MK-16 | P3 | Switcher panned then turned rests between cards | Fixed |
| MK-17 | P3 | Small things (folder numbering, dead Back press, dir=auto, draggable icon, banner timing) | Fixed: folders numbered, no dead Back press, right-to-left text laid out as such, the icon not draggable, a banner that waits 300ms before taking a press. |
| MK-s1 | suspected | Pinch zoom on a real iPhone | Left: zoom stays on (it is an accessibility feature). Not tested on a device. |
| MK-s2 | suspected | Two steps back for one | Fixed |

## Found while fixing

Three things no tester reported, because they came from the fixes themselves, and were caught before anything shipped:

- **A built page drew grids as single columns.** To let the loading screen be drawn at once, the site's stylesheet had been moved below it; in a built page that put it after the stylesheets of the desktop and the iPhone and reversed which rules won. The dev server keeps stylesheets in the order they are imported, so nothing run there showed it: looking at pictures of the built site did. The stylesheet now stays first and still does not hold up the loading screen, and the checks that run against a built page test the order.
- **Safari's engine says twice that a stylesheet has loaded** when it is switched on, and the loading screen threw on the second. Found by running the built page in WebKit.
- **Search knew people who had not replied yet** on the iPhone after the desktop had been corrected; both now look only through what has been said so far.

## What is left for Shrug

- A way to be reached (`SITE.contact` in `src/data/site.ts`): the day it is written, the Not Delivered sheet, the terminal, an unanswered FAQ, Settings, About and search all use it.
- Their own sentence for what Shrug is (`SITE.line`), the seven FAQ answers, the VIP pictures, the easter eggs' words, ten logos, and a line for each of the seven companies with no site.
- From a machine that can reach them: whether the 60 `http://` company links answer on `https://`; the two testimonial slips; and a look on a real iPhone, an Android and an iPad.
