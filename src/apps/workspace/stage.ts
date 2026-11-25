import * as THREE from 'three'
import type { Finish } from '../../../store/shared/colors'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CHAIR_MODEL } from '../../data/workspace'

// The studio's stage, in 3D (design/v1-workspace, WORKSPACE.md, section 2): the chair on a turntable, lit
// from above and in front, with a soft shadow where it meets the floor. One light and one camera for every
// color: only the paint changes. The cove itself is the window's own ground, behind this, so the canvas is
// clear wherever the chair is not.
//
// THE CHAIR IS DOM'S MODEL of the real one (public/workspace/chair.glb, "WS chair build 2", supplied on
// 25 Nov): metres, Y up, its front to +Z, its origin on the gas lift's axis at the floor, so that is the
// axis it turns about. It is recolored as the file says to be: by the base color of its material Paint,
// which is on Paint_Spine (the frame up the back) and Paint_Base (the five-star base). Its mesh is
// see-through between the threads, in four panels (Fabric_Seat, Fabric_Lumbar, Fabric_Back,
// Fabric_Headrest) so that they are drawn back to front. Everything else (frame, trim, lift, castors, the
// badge) is drawn as the file has it. Nothing here is built by hand any more.
//
// The file as served is the supplied one made lighter to fetch, with nothing of it changed: its points
// packed (meshopt) and its four pictures as WebP, 1.6 MB for 5.7. To put a newer file in its place:
//   npx @gltf-transform/cli webp chair-from-dom.glb a.glb --quality 92
//   npx @gltf-transform/cli meshopt a.glb public/workspace/chair.glb --level medium
// (neither step joins or renames anything: the paint is still found by its material's name.)

export interface Stage {
  /** Paints the chair: a color, or for a color-shifting paint the colors it moves through. It cross-fades from what it was. */
  /** `finish`: how the paint is lit (store/shared/colors.ts): matte, high gloss, pearl, metallic and the rest. */
  paint(color: string, shift?: string[], finish?: Finish): void
  /** Turns the chair by a drag: so far across, and so far up or down. */
  turn(dx: number, dy: number): void
  /** How far round the chair is, in whole degrees from where it opens. */
  angle(): number
  /** Fits the picture to its place. */
  size(w: number, h: number): void
  /** Lets go of everything it holds. */
  stop(): void
}

/** How the chair opens: from behind, at a slight three-quarter, because that is where the color is. */
const OPEN = Math.PI + 0.42
/** How far the camera may tilt, either way: the turn is kept level. */
const TILT = 0.16
const FADE = 400
/** How tall the chair stands on the stage, in the stage's own units: the camera is set for this. */
const TALL = 1.46

const hex = (color: string) => new THREE.Color(color)

/** How each finish is lit: its clear coat and how rough that is, how rough and how metallic the paint under
 * it is, and how much of a pearl's sheen it has. High gloss is the file's own Paint, as supplied. */
const LIT: Record<Finish, { coat: number; coatRough: number; rough: number; metal: number; pearl: number }> = {
  matte: { coat: 0, coatRough: 0.15, rough: 0.78, metal: 0, pearl: 0 },
  gloss: { coat: 1, coatRough: 0.06, rough: 0.38, metal: 0, pearl: 0 },
  pearl: { coat: 0.9, coatRough: 0.1, rough: 0.34, metal: 0.18, pearl: 0.55 },
  metallic: { coat: 0.85, coatRough: 0.1, rough: 0.3, metal: 0.62, pearl: 0 },
  shift: { coat: 0.9, coatRough: 0.1, rough: 0.34, metal: 0.35, pearl: 0.2 },
  holo: { coat: 1, coatRough: 0.05, rough: 0.28, metal: 0.55, pearl: 1 },
  uv: { coat: 0.9, coatRough: 0.1, rough: 0.4, metal: 0, pearl: 0 },
}

/** The paint: a clear coat over a color. For a color-shifting paint the color is mixed from the angle it is seen at. */
function paintOf() {
  const material = new THREE.MeshPhysicalMaterial({ name: 'Paint', color: '#888', metalness: 0, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide })
  const shift = { uShift: { value: 0 }, uA: { value: hex('#000') }, uB: { value: hex('#000') }, uC: { value: hex('#000') } }
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shift)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uShift;\nuniform vec3 uA;\nuniform vec3 uB;\nuniform vec3 uC;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          // Seen square on it is the first color; glancing along it, the last; the middle one between
          float glance = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 0.8);
          vec3 moved = mix(mix(uA, uB, smoothstep(0.0, 0.55, glance)), uC, smoothstep(0.45, 1.0, glance));
          diffuseColor.rgb = mix(diffuseColor.rgb, moved, uShift);
        }`,
      )
  }
  return { material, shift }
}

/** The chair's file, read once for the page: each stage is given its own copy of it to paint. */
let read: Promise<THREE.Group> | null = null
function chairFile(): Promise<THREE.Group> {
  if (!CHAIR_MODEL) return Promise.reject(new Error('no chair'))
  return (read ??= new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(CHAIR_MODEL)
    .then((file) => file.scene)
    .catch((err: unknown) => {
      // (not had: the next stage asks again)
      read = null
      throw err
    }))
}

/** A soft shadow where the chair meets the floor: a dark round that fades to nothing at its edge. */
function shadow() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const fade = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  fade.addColorStop(0, 'rgba(0,0,0,0.42)')
  fade.addColorStop(0.55, 'rgba(0,0,0,0.16)')
  fade.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, size, size)
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }))
  plane.rotation.x = -Math.PI / 2
  plane.position.y = 0.002
  return plane
}

/** Makes the stage on a canvas, and puts the chair on it when its file has arrived: `drawn` is called once
 * the chair has been drawn, and `lost` if it cannot be (the still then stays, and the app works without
 * turning). Throws where the browser cannot draw in 3D at all. */
export function makeStage(canvas: HTMLCanvasElement, settle: boolean, drawn: () => void, lost: () => void = () => {}): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // (the mapping made for showing a product in its true color: a filmic one washes a strong paint pale)
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1

  const scene = new THREE.Scene()
  // What the gloss and the black frame have to reflect: a plain lit room, made here, so no picture is fetched for it
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  // (dimmed here, on the scene: three reads the room's strength from the scene and not from a material. At its
  // full strength the room lights a paint past white, and the mapping below then washes it pale)
  scene.environmentIntensity = 0.35
  // Lit from above and in front, the same for every color
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9b9c2', 0.9))
  const key = new THREE.DirectionalLight('#ffffff', 2)
  key.position.set(1.4, 3.2, 2.6)
  scene.add(key)
  const fill = new THREE.DirectionalLight('#ffffff', 0.5)
  fill.position.set(-2.2, 1.6, -1.8)
  scene.add(fill)

  const { material, shift } = paintOf()
  const table = new THREE.Group()
  table.rotation.y = OPEN
  scene.add(table)
  const under = shadow()
  scene.add(under)
  /** Whether the chair is on the table yet. */
  let stood = false
  chairFile()
    .then((file) => {
      if (stopped) return
      // (a copy: its parts are this stage's to paint and to let go of; what they are made of is shared with the file)
      const model = file.clone(true)
      const box = new THREE.Box3().setFromObject(model)
      const tall = box.max.y - box.min.y
      if (!(tall > 0)) throw new Error('an empty chair')
      // Stood on the floor at the height the camera is set for, about its own origin (the gas lift's axis)
      const fit = TALL / tall
      model.scale.setScalar(fit)
      model.position.y = -box.min.y * fit
      let painted = 0
      model.traverse((thing) => {
        if (!(thing instanceof THREE.Mesh)) return
        if ([thing.material].flat().some((m: THREE.Material) => m.name === 'Paint')) {
          thing.material = material
          painted++
        }
      })
      // (a file with no Paint is not this chair: better the still than a chair in the wrong color)
      if (!painted) throw new Error('no Paint in the chair')
      table.add(model)
      stood = true
      if (settling) settling.began = performance.now()
      ask()
    })
    .catch(() => {
      if (!stopped) lost()
    })

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20)
  let tilt = 0
  const look = () => {
    const far = 4.05
    camera.position.set(0, 0.74 + Math.sin(0.1 + tilt) * far * 0.6, Math.cos(0.1 + tilt) * far)
    camera.lookAt(0, 0.73, 0)
  }
  look()

  let frame = 0
  let stopped = false
  // What is on its way: a color fading to another, and a turn settling
  let fading: { from: THREE.Color; to: THREE.Color; fromShift: number; toShift: number; began: number } | null = null
  let settling: { from: number; to: number; began: number } | null = settle ? { from: OPEN - 0.5, to: OPEN, began: performance.now() } : null
  if (settling) table.rotation.y = settling.from

  const draw = () => {
    frame = 0
    if (stopped) return
    const now = performance.now()
    if (fading) {
      const t = Math.min(1, (now - fading.began) / FADE)
      material.color.copy(fading.from).lerp(fading.to, t)
      shift.uShift.value = fading.fromShift + (fading.toShift - fading.fromShift) * t
      if (t >= 1) fading = null
    }
    if (settling) {
      const t = Math.min(1, (now - settling.began) / 900)
      table.rotation.y = settling.from + (settling.to - settling.from) * (1 - Math.pow(1 - t, 3))
      if (t >= 1) settling = null
    }
    renderer.render(scene, camera)
    if (stood) drawn()
    if (fading || settling) ask()
  }
  // Drawn when something has changed, and not otherwise: a chair standing still costs nothing
  const ask = () => {
    if (!frame && !stopped) frame = requestAnimationFrame(draw)
  }

  let first = true
  return {
    paint(color, moving, finish = 'gloss') {
      const to = hex(color)
      // One paint material, in a setting for each finish: a gloss paint has a clear coat over it; Matte Black
      // has none, and scatters what light it gets; a metallic one takes its color into what it mirrors; a
      // pearl has a soft sheen; a shifting or holographic one is mixed from the angle it is seen at (below)
      const lit = LIT[finish]
      material.clearcoat = lit.coat
      material.clearcoatRoughness = lit.coatRough
      material.roughness = lit.rough
      material.metalness = lit.metal
      material.iridescence = lit.pearl
      const toShift = moving ? 1 : 0
      if (moving) {
        shift.uA.value = hex(moving[0] ?? color)
        shift.uB.value = hex(moving[Math.floor(moving.length / 2)] ?? color)
        shift.uC.value = hex(moving[moving.length - 1] ?? color)
      }
      if (first) {
        // The first paint is simply the paint: there is nothing to fade from
        first = false
        material.color.copy(to)
        shift.uShift.value = toShift
      } else fading = { from: material.color.clone(), to, fromShift: shift.uShift.value, toShift, began: performance.now() }
      ask()
    },
    turn(dx, dy) {
      settling = null
      table.rotation.y += dx * 0.0085
      tilt = Math.max(-TILT, Math.min(TILT, tilt + dy * 0.003))
      look()
      ask()
    },
    angle() {
      const turned = ((table.rotation.y - OPEN) * 180) / Math.PI
      return ((Math.round(turned) % 360) + 360) % 360
    },
    size(w, h) {
      renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(1, h)
      camera.updateProjectionMatrix()
      ask()
    },
    stop() {
      stopped = true
      cancelAnimationFrame(frame)
      // (the chair's own shapes and materials are the file's, kept for the next stage: only this stage's paint goes)
      material.dispose()
      under.geometry.dispose()
      under.material.map?.dispose()
      under.material.dispose()
      scene.environment?.dispose()
      pmrem.dispose()
      renderer.dispose()
    },
  }
}
