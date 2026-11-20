// What is typed into a search is seldom what is written. The site's words are
// typeset (don’t, “proprietary”) and a keyboard types the plain marks; nobody
// looking for a word types its capitals or its accents. So what is looked for
// and what is looked through are both read the same way before they are
// compared.

/** Words as a search reads them: without their case or their accents, and with the quotation marks type
 * is set with as the plain ones a keyboard has, so that "don't" typed with a straight apostrophe finds the
 * "don’t" a reply is set with. A letter stays one letter, so a place found in the folded words is the same
 * place in the words as they are written. */
export const folded = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’‚‛ʼ′`´]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .toLowerCase()
