// pdf.js, which draws a PDF's pages for Preview. It is a large thing, so it is fetched the first time a
// document that is a PDF is opened, and never by a visitor who opens none. (The build used is the one made
// for browsers a few years old as well as this year's.)

type Lib = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
export type Pdf = Awaited<ReturnType<Lib['getDocument']>['promise']>
export type PdfPage = Awaited<ReturnType<Pdf['getPage']>>

let lib: Promise<Lib> | null = null
function pdfjs(): Promise<Lib> {
  return (lib ??= Promise.all([import('pdfjs-dist/legacy/build/pdf.min.mjs' as string) as Promise<Lib>, import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]).then(([got, worker]) => {
    got.GlobalWorkerOptions.workerSrc = worker.default
    return got
  })).catch((error) => {
    // Not fetched (a connection lost): the next document tries again
    lib = null
    throw error
  })
}

const base = import.meta.env.BASE_URL

/** Opens a PDF from its bytes. What it needs beyond them (a standard font, a decoder) it fetches from this site. */
export async function openPdf(data: Uint8Array): Promise<Pdf> {
  const { getDocument, VerbosityLevel } = await pdfjs()
  return getDocument({ data, verbosity: VerbosityLevel.ERRORS, standardFontDataUrl: `${base}pdfjs/standard_fonts/`, wasmUrl: `${base}pdfjs/wasm/`, iccUrl: `${base}pdfjs/iccs/` }).promise
}
