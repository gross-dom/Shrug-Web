// Words as type sets them. The testimonials and the companies' lines are kept
// as they were published, some with typewriter quotes and hyphens for dashes
// and some without; drawn, they all read alike. Nothing but the marks changes.

export function typeset(text: string) {
  return text
    .replace(/(\w)'(?=\w)/g, '$1’') // an apostrophe inside a word: don't, they're
    .replace(/(^|[\s([{“])'/g, '$1‘')
    .replace(/'/g, '’')
    .replace(/(^|[\s([{‘])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/ - /g, ' – ')
}
