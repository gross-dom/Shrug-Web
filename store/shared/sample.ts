// For the demos only (the store's, and the desktop's): a document's file when there is no server to fetch one from.

/** A few pages that say what they are: stands in for a document's file. */
export function samplePdf(title: string, pages = 1): string {
  const text = (s: string) => s.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '?')
  const count = Math.max(1, Math.round(pages))
  // Lines of grey where the words of the real one will be, so that a page looks like a page
  const lines = (from: number, n: number) =>
    Array.from({ length: n }, (_, i) => `0.86 g 72 ${from - i * 22} ${i % 5 === 4 ? 300 : 468} 9 re f`).join('\n')
  const page = (n: number) =>
    n === 1
      ? `BT /F1 26 Tf 72 700 Td (${text(title)}) Tj ET\nBT /F1 12 Tf 72 670 Td (A sample file from the Shrug VIP demo. The real document goes here.) Tj ET\n${lines(620, 22)}\n0 g BT /F1 10 Tf 72 48 Td (Page 1 of ${count}) Tj ET`
      : `BT /F1 16 Tf 72 716 Td (${text(title)}) Tj ET\n${lines(676, 26)}\n0 g BT /F1 10 Tf 72 48 Td (Page ${n} of ${count}) Tj ET`
  // 1 the catalog, 2 the pages, 3 the font; then each page and what is drawn on it
  const kids = Array.from({ length: count }, (_, i) => `${4 + i * 2} 0 R`).join(' ')
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${kids}] /Count ${count} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  for (let n = 1; n <= count; n++) {
    const stream = page(n)
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${5 + (n - 1) * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  }
  let out = '%PDF-1.4\n'
  const at: number[] = []
  objects.forEach((body, n) => {
    at.push(out.length)
    out += `${n + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${at.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return out
}
