// Words as type sets them. The testimonials and the companies' lines are kept
// as they were published, some with typewriter quotes and hyphens for dashes
// and some without; drawn, they all read alike. Nothing but the marks changes.
//
// A typewriter's quotation mark does not say which way it faces: that is read
// from what is on either side of it. One opens at the start of the text, after
// a space, after an opening bracket or another opening mark, and after a dash
// that words follow. Anywhere else a single mark is an apostrophe or closes,
// and a double mark closes the quotation that is open. With none open it opens
// one, if words follow hard on it: a phrase quoted in the middle of a sentence
// with no spaces round it (English inside Japanese, straight after a full
// stop) then has a mark at each end that faces it, where a rule that looked
// only for a space before gave it two closing marks.

/** What an opening mark can follow, besides nothing at all: a space, an opening bracket, another opening mark. */
const OPENS_AFTER = /[\s([{“‘]/

/** A dash, as it is typed or as it is set. A mark after one opens only if words follow it: one that ends a broken-off sentence closes. */
const DASH = /[-–—]/

/** What follows a mark that cannot be opening anything: the end of the text, a space, or the punctuation that ends a phrase. */
const ENDS = /^$|[\s.,;:!?)\]}]/

export function typeset(text: string) {
  let set = ''
  /** Double marks opened and not yet closed. */
  let open = 0
  for (let at = 0; at < text.length; at++) {
    const mark = text[at]!
    if (mark !== '"' && mark !== "'") {
      // A mark that already faces a way is counted, so that a typewriter's mark set against it is read right
      if (mark === '“') open++
      else if (mark === '”') open = Math.max(0, open - 1)
      set += mark
      continue
    }
    const before = set.slice(-1)
    const after = text[at + 1] ?? ''
    const leads = !before || OPENS_AFTER.test(before) || (DASH.test(before) && /\S/.test(after))
    if (mark === "'") set += leads ? '‘' : '’'
    else if (leads || (!open && !ENDS.test(after))) {
      set += '“'
      open++
    } else {
      set += '”'
      open = Math.max(0, open - 1)
    }
  }
  return set.replace(/ - /g, ' – ')
}
