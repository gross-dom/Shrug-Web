/// <reference types="vite/client" />

declare module 'virtual:picture-sizes' {
  /** The width and height of each of the drops' photographs, by its address (vc/vite.config.ts reads them from the files). */
  const sizes: Record<string, [number, number] | undefined>
  export default sizes
}
