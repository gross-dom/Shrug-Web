import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Rotate3d } from 'lucide-react'
import type { Finish } from '../../../store/shared/colors'
import { TEMPLATED } from '../../data/site'
import { MAKING, OWNERS, type Paint } from '../../data/workspace'
import { prefersReducedMotion } from '../../os/dom'
import type { Stage } from './stage'
import { ChairStill } from './Still'

// What the desk's studio (../Workspace.tsx) and the phone's (src/phone/apps/Workspace.tsx) are both made of:
// a color as either holds it, what is said of it, who owns one and how one is made as a visitor may read
// them, and the chair itself on its turntable.

/** A color as the studio holds it. */
export interface Chosen {
  id: string
  name: string
  color: string
  shift?: string[]
  paint: Paint
}

export const chosenOf = (paint: Paint): Chosen => ({ id: paint.id, name: paint.name, color: paint.color, shift: paint.shift, paint })
/** What a slab, a dot or the cove is painted with: the color, or for a shifting paint the colors it moves through. */
export const ground = (c: { color: string; shift?: string[] }) => (c.shift ? `linear-gradient(135deg, ${c.shift.join(', ')})` : c.color)
/** How a chair in a color is to be had, as its slab says it: the eight the studio opens on are in stock. */
export const stockOf = (paint: Paint) => (paint.stock === 'now' ? 'Available now' : 'Made to Order')
/** And as the studio says it on the color's tag: every color can be bought; one that is not in stock (the sixteen more) is made, and takes its weeks. */
export const leadOf = (paint: Paint) => (paint.stock === 'now' ? 'Available now' : 'Made to Order · 2–3 weeks')
/** A visitor never reads a note written for Shrug: what is still templated is the demo's and the editor's. */
const real = (text: string) => !text.startsWith('[')
export const OWNERS_SHOWN = TEMPLATED ? OWNERS : OWNERS.filter((owner) => real(owner.name))
export const MAKING_SHOWN = TEMPLATED ? MAKING : MAKING.filter((piece) => piece.src && real(piece.says))

/** The chair on its turntable: dragged to turn it. A drawing stands in for it until the 3D chair has been
 * drawn, and stays where it cannot be. `cls` begins the names its parts are styled by: the desk's studio has
 * them as st-table, st-ring, st-still and st-turn, and the phone's by names of its own. */
export function Turntable({ id, color, shift, finish, name, live, cls = 'st' }: { id: string; color: string; shift?: string[]; finish: Finish; name: string; live: boolean; cls?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const stage = useRef<Stage | null>(null)
  const [drawn, setDrawn] = useState(false)
  const [angle, setAngle] = useState(0)
  const paint = useRef({ color, shift, finish })
  paint.current = { color, shift, finish }

  // The stage is made when the studio is first seen, and three.js is fetched then and not before
  useEffect(() => {
    if (!live || stage.current) return
    let gone = false
    void import('./stage')
      .then(({ makeStage }) => {
        if (gone || !canvas.current || !box.current) return
        const made = makeStage(
          canvas.current,
          !prefersReducedMotion(),
          () => setDrawn(true),
          () => {
            // The chair's file did not arrive: the drawing stays, and nothing is held for a chair that is not there
            made.stop()
            if (stage.current === made) stage.current = null
          },
        )
        stage.current = made
        made.size(box.current.clientWidth, box.current.clientHeight)
        made.paint(paint.current.color, paint.current.shift, paint.current.finish)
      })
      .catch(() => {
        // No 3D here: the drawing stays, and the app works without turning
      })
    return () => {
      gone = true
    }
  }, [live])
  useEffect(
    () => () => {
      stage.current?.stop()
      stage.current = null
    },
    [],
  )
  // A new color: the paint fades to it, as the cove does
  useEffect(() => stage.current?.paint(color, shift, finish), [color, shift, finish])
  useEffect(() => {
    const el = box.current
    if (!el) return
    const watch = new ResizeObserver(() => stage.current?.size(el.clientWidth, el.clientHeight))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  const turn = (dx: number, dy: number) => {
    stage.current?.turn(dx, dy)
    if (stage.current) setAngle(stage.current.angle())
  }
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!stage.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    let last = { x: e.clientX, y: e.clientY }
    const move = (ev: PointerEvent) => {
      turn(ev.clientX - last.x, ev.clientY - last.y)
      last = { x: ev.clientX, y: ev.clientY }
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeAttribute('data-held')
    }
    el.setAttribute('data-held', '')
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    turn(e.key === 'ArrowLeft' ? -30 : 30, 0)
  }

  return (
    <>
      <span className={`${cls}-ring`} aria-hidden />
      <div
        ref={box}
        className={`${cls}-table`}
        data-autofocus
        tabIndex={0}
        role="slider"
        aria-label={`The chair in ${name}. Drag, or use the arrow keys, to turn it`}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={angle}
        aria-valuetext={`${angle} degrees`}
        data-3d={drawn || undefined}
        onPointerDown={onDown}
        onKeyDown={onKey}
      >
        <ChairStill className={`${cls}-still`} paint={id} width={300} />
        <canvas ref={canvas} aria-hidden />
      </div>
      {drawn && (
        <span className={`${cls}-turn`} aria-hidden>
          <Rotate3d size={13} strokeWidth={2} />
          Drag to turn · {angle}°
        </span>
      )}
    </>
  )
}
