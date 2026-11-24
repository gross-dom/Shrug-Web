import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// The studio's stage, in 3D (design/v1-workspace, WORKSPACE.md, section 2): the chair on a turntable, lit
// from above and in front, with a soft shadow where it meets the floor. One light and one camera for every
// color: only the paint changes. The cove itself is the window's own ground, behind this, so the canvas is
// clear wherever the chair is not.
//
// THE CHAIR HERE IS A PLACEHOLDER. The real one is a licensed model of the painted Ergohuman, which has
// not been supplied; this is built from plain solids to its proportions (a mesh headrest, back and seat,
// black arms, a chrome gas lift, the paint on the spine at the back and on the five-star base), so that the
// stage, the materials and the controls can be made and judged against something. To put the real model in:
// load it in `chair()` in place of what is built there, and give its painted parts `paint` as their
// material. Nothing else here knows what the chair is made of.

export interface Stage {
  /** Paints the chair: a color, or for a color-shifting paint the colors it moves through. It cross-fades from what it was. */
  paint(color: string, shift?: string[]): void
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

const hex = (color: string) => new THREE.Color(color)

/** The paint: a gloss coat over a color. For a color-shifting paint the color is mixed from the angle it is seen at. */
function paintOf() {
  const material = new THREE.MeshPhysicalMaterial({ color: '#888', metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1 })
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

/** The chair, built of solids. What is painted is given `paint`; the rest is mesh, plastic and chrome. */
function chair(paint: THREE.Material) {
  const group = new THREE.Group()
  const mesh = new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.92, metalness: 0 })
  const plastic = new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 0.55, metalness: 0.1 })
  const chrome = new THREE.MeshStandardMaterial({ color: '#d9dce1', roughness: 0.12, metalness: 1 })
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, at: [number, number, number], turn: [number, number, number] = [0, 0, 0]) => {
    const part = new THREE.Mesh(geometry, material)
    part.position.set(...at)
    part.rotation.set(...turn)
    group.add(part)
    return part
  }

  // The five-star base, painted: five arms out from the middle, each ending over a caster
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.045, 0.07, 4, 0.02), paint)
    arm.position.set(Math.cos(a) * 0.17, 0.085, Math.sin(a) * 0.17)
    arm.rotation.set(0, -a, -0.12)
    group.add(arm)
    add(new THREE.CylinderGeometry(0.032, 0.032, 0.05, 20), plastic, [Math.cos(a) * 0.33, 0.032, Math.sin(a) * 0.33], [Math.PI / 2, 0, a])
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 12), chrome, [Math.cos(a) * 0.33, 0.07, Math.sin(a) * 0.33])
  }
  add(new THREE.CylinderGeometry(0.06, 0.075, 0.07, 28), paint, [0, 0.11, 0])
  // The gas lift, chrome, and the works under the seat
  add(new THREE.CylinderGeometry(0.03, 0.036, 0.16, 24), plastic, [0, 0.21, 0])
  add(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 24), chrome, [0, 0.36, 0])
  add(new RoundedBoxGeometry(0.26, 0.06, 0.3, 4, 0.02), plastic, [0, 0.455, 0])
  // The seat: mesh, in a dark frame
  add(new RoundedBoxGeometry(0.5, 0.055, 0.48, 6, 0.027), mesh, [0, 0.51, 0.04])
  add(new RoundedBoxGeometry(0.52, 0.03, 0.5, 6, 0.015), plastic, [0, 0.487, 0.04])
  // The arms: a post and a pad, either side
  for (const side of [-1, 1]) {
    add(new RoundedBoxGeometry(0.04, 0.24, 0.05, 4, 0.015), plastic, [side * 0.29, 0.6, 0.02])
    add(new RoundedBoxGeometry(0.085, 0.035, 0.27, 5, 0.017), plastic, [side * 0.29, 0.735, 0.05])
  }
  // The spine, painted: up the back from under the seat to the headrest, and the two limbs that hold the back
  const tube = (points: [number, number, number][], radius: number) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 40, radius, 14, false)
  add(tube([[0, 0.46, -0.1], [0, 0.5, -0.27], [0, 0.68, -0.33], [0, 0.98, -0.31], [0, 1.2, -0.3]], 0.03), paint, [0, 0, 0])
  for (const side of [-1, 1]) add(tube([[0, 0.7, -0.33], [side * 0.1, 0.86, -0.31], [side * 0.19, 0.98, -0.27], [side * 0.2, 1.06, -0.26]], 0.022), paint, [0, 0, 0])
  // The lumbar pad, the back and the headrest: mesh, each leaning a little
  add(new RoundedBoxGeometry(0.34, 0.11, 0.045, 5, 0.02), plastic, [0, 0.66, -0.26], [-0.08, 0, 0])
  add(new RoundedBoxGeometry(0.47, 0.52, 0.04, 6, 0.02), mesh, [0, 0.93, -0.245], [-0.1, 0, 0])
  add(new RoundedBoxGeometry(0.49, 0.54, 0.02, 6, 0.01), plastic, [0, 0.93, -0.258], [-0.1, 0, 0])
  add(new RoundedBoxGeometry(0.3, 0.14, 0.05, 6, 0.024), mesh, [0, 1.29, -0.27], [0.06, 0, 0])
  add(new RoundedBoxGeometry(0.32, 0.16, 0.025, 6, 0.012), plastic, [0, 1.29, -0.287], [0.06, 0, 0])
  return group
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

/** Makes the stage on a canvas. Throws where the browser cannot draw in 3D: the still stays, and the app works without turning. */
export function makeStage(canvas: HTMLCanvasElement, settle: boolean, drawn: () => void): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  // What the gloss and the chrome have to reflect: a plain lit room, made here, so no picture is fetched for it
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  // Lit from above and in front, the same for every color
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9b9c2', 0.55))
  const key = new THREE.DirectionalLight('#ffffff', 2.1)
  key.position.set(1.4, 3.2, 2.6)
  scene.add(key)
  const fill = new THREE.DirectionalLight('#ffffff', 0.5)
  fill.position.set(-2.2, 1.6, -1.8)
  scene.add(fill)

  const { material, shift } = paintOf()
  const table = new THREE.Group()
  table.add(chair(material))
  table.rotation.y = OPEN
  scene.add(table)
  scene.add(shadow())

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20)
  let tilt = 0
  const look = () => {
    const far = 4.1
    camera.position.set(0, 0.74 + Math.sin(0.1 + tilt) * far * 0.6, Math.cos(0.1 + tilt) * far)
    camera.lookAt(0, 0.7, 0)
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
    drawn()
    if (fading || settling) ask()
  }
  // Drawn when something has changed, and not otherwise: a chair standing still costs nothing
  const ask = () => {
    if (!frame && !stopped) frame = requestAnimationFrame(draw)
  }

  let first = true
  return {
    paint(color, moving) {
      const to = hex(color)
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
      scene.traverse((thing) => {
        if (thing instanceof THREE.Mesh) {
          thing.geometry.dispose()
          for (const m of Array.isArray(thing.material) ? thing.material : [thing.material]) m.dispose()
        }
      })
      scene.environment?.dispose()
      pmrem.dispose()
      renderer.dispose()
    },
  }
}
