// The chair as a still: what the studio shows while the 3D chair is on its way, what stays where 3D cannot
// run, and the chair on a slab and on an owner's card. It is the chair the studio turns: a picture taken of
// Dom's model of it in each color's paint, from where the studio opens on it, with nothing behind it and
// the shadow it stands on (tools/chair-mockups.cjs makes them: public/workspace/chairs/<color>.webp). So a
// slab's chair, the still and the chair in 3D are one chair, and the still gives way to the 3D chair without
// anything about it changing. It is a render of the model, not a photograph of the chair.

/** The picture's own shape: 600 by 800. */
const SHAPE = 0.75

export function ChairStill({ paint, width = 320, className, label, held }: { /** The color's id: "scuderia-red". */ paint: string; width?: number; className?: string; label?: string; /** It is kept on the page unseen until it is wanted, and is then to be there at once: drawn in the frame it is shown in, not the one after. */ held?: boolean }) {
  return <img className={className} src={`/workspace/chairs/${paint}.webp`} width={width} height={Math.round(width / SHAPE)} alt={label ?? ''} aria-hidden={label ? undefined : true} draggable={false} decoding={held ? 'sync' : 'async'} />
}
