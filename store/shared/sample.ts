// For the demos only (the store's, and the desktop's): a document's file when there is no server to fetch one from.

/** One page that says what it is: stands in for a document's file. */
export function samplePdf(title: string): string {
  const text = (s: string) => s.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '?')
  const stream = `BT /F1 26 Tf 72 700 Td (${text(title)}) Tj ET\nBT /F1 12 Tf 72 670 Td (A sample file from the Shrug VIP demo. The real document goes here.) Tj ET`
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
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
