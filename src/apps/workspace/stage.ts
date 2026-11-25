import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CHAIR_MODEL } from '../../data/workspace'

// The studio's stage, in 3D (design/v1-workspace, WORKSPACE.md, section 2): the chair on a turntable, lit
// from above and in front, with a soft shadow where it meets the floor. One light and one camera for every
// color: only the paint changes. The cove itself is the window's own ground, behind this, so the canvas is
// clear wherever the chair is not.
//
// THE CHAIR IS DRAWN, NOT SCANNED. It is built here from solids, after Shrug's own photographs of the
// painted Ergohuman (store/public/pictures: the back of the red one, the side of the black one): the
// painted frame up the back (two blades rising from under the seat to a closed yoke, and a neck from the
// yoke to the headrest), the band across it that carries the W/S badge, the mesh back, lumbar pad,
// headrest and seat in their black rims, the arms on their chrome brackets, the gas lift, and the painted
// five-star base. A scan or a modelled file of the real chair will be truer than this can be: put one at
// CHAIR_MODEL (data/workspace.ts) and it is loaded in place of what is built here, with the paint given to
// whichever of its materials has "paint" in its name. Nothing else here knows what the chair is made of.

export interface Stage {
  /** Paints the chair: a color, or for a color-shifting paint the colors it moves through. It cross-fades from what it was. */
  /** `matte`: not a gloss paint (Matte Black, the chair as it comes). */
  paint(color: string, shift?: string[], matte?: boolean): void
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
  // (hardly metal at all, and with little of the room in it: the color has to be read as the color it is)
  const material = new THREE.MeshPhysicalMaterial({ color: '#888', metalness: 0, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.15 })
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

/** The weave of the mesh, as a sheet that is see-through between its threads: threads are white (there), the gaps black (not). */
function weave(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 13
  // Two sets of threads, crossing: drawn past the edges so that the sheet repeats without a seam
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(i * size - size, -size)
    ctx.lineTo(i * size + size, size * 2 - size)
    ctx.moveTo(i * size + size, -size)
    ctx.lineTo(i * size - size, size * 2 - size)
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** The badge on the band across the back: W/S in gold, on a dark oval. */
function badge(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#101113'
  ctx.fillRect(0, 0, 256, 128)
  ctx.fillStyle = '#c9a85a'
  ctx.font = "italic 800 78px 'Inter Variable', Inter, Helvetica, Arial, sans-serif"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('W/S', 128, 68)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** A value between points given as [at, value] pairs, eased through them (a spline of one number). */
function through(points: [number, number][], at: number): number {
  const last = points.length - 1
  if (at <= points[0]![0]) return points[0]![1]
  if (at >= points[last]![0]) return points[last]![1]
  let i = 0
  while (i < last - 1 && at > points[i + 1]![0]) i++
  const p0 = points[Math.max(0, i - 1)]!
  const p1 = points[i]!
  const p2 = points[i + 1]!
  const p3 = points[Math.min(last, i + 2)]!
  const t = (at - p1[0]) / (p2[0] - p1[0])
  return 0.5 * (2 * p1[1] + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t * t + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t * t * t)
}

interface Sheet {
  /** How wide it is at its top and at its foot, how tall, and how round its corners are. */
  top: number
  foot: number
  tall: number
  round: number
  /** How far its sides come forward of its middle: a back wraps the sitter a little. */
  bow: number
  /** For a seat: how far its front edge falls away. */
  droop?: number
}

/** A point of a sheet: `u` across it (-1 to 1) and `v` up it (0 to 1). Its corners are round, so it is narrower at its top and foot. */
function onSheet(sheet: Sheet, u: number, v: number): THREE.Vector3 {
  const y = (v - 0.5) * sheet.tall
  const fromEdge = Math.min(v, 1 - v) * sheet.tall
  const inset = fromEdge >= sheet.round ? 0 : sheet.round - Math.sqrt(Math.max(0, sheet.round * sheet.round - (sheet.round - fromEdge) ** 2))
  const half = (sheet.foot + (sheet.top - sheet.foot) * v) / 2 - inset
  const x = u * half
  const widest = Math.max(sheet.top, sheet.foot) / 2
  let z = sheet.bow * (x / widest) ** 2
  if (sheet.droop && v < 0.3) z -= sheet.droop * ((0.3 - v) / 0.3) ** 2
  return new THREE.Vector3(x, y, z)
}

/** A sheet of mesh, and the rim it is stretched in. */
function sheetOf(sheet: Sheet, cloth: THREE.Material, rim: THREE.Material, thick = 0.013): THREE.Group {
  const across = 22
  const up = 22
  const positions: number[] = []
  const uvs: number[] = []
  const index: number[] = []
  for (let j = 0; j <= up; j++)
    for (let i = 0; i <= across; i++) {
      const p = onSheet(sheet, (i / across) * 2 - 1, j / up)
      positions.push(p.x, p.y, p.z)
      // (the weave is laid by the sheet's own size, so that it is the same weave on every sheet)
      uvs.push(p.x / 0.0105, p.y / 0.0105)
    }
  for (let j = 0; j < up; j++)
    for (let i = 0; i < across; i++) {
      const a = j * (across + 1) + i
      index.push(a, a + 1, a + across + 1, a + 1, a + across + 2, a + across + 1)
    }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  const group = new THREE.Group()
  group.add(new THREE.Mesh(geometry, cloth))
  // The rim: round the sheet's own edge
  const edge: THREE.Vector3[] = []
  const steps = 26
  for (let i = 0; i < steps; i++) edge.push(onSheet(sheet, -1 + (2 * i) / steps, 0))
  for (let i = 0; i < steps; i++) edge.push(onSheet(sheet, 1, i / steps))
  for (let i = 0; i < steps; i++) edge.push(onSheet(sheet, 1 - (2 * i) / steps, 1))
  for (let i = 0; i < steps; i++) edge.push(onSheet(sheet, -1, 1 - i / steps))
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true), 120, thick, 8, true), rim))
  return group
}

/** How far back the painted frame is at each height: out from under the seat, round behind the lumbar, and up the back. */
const SPINE_BACK: [number, number][] = [
  [0.4, -0.08],
  [0.46, -0.2],
  [0.55, -0.305],
  [0.7, -0.352],
  [0.9, -0.362],
  [1.1, -0.35],
  [1.36, -0.335],
]

/** The painted frame up the back: two blades from under the seat, spreading as they rise to a closed yoke, and a neck from the yoke to the headrest. */
function frame(paint: THREE.Material): THREE.Mesh {
  const half = (shape: THREE.Shape | THREE.Path, side: 1 | -1, points: [number, number][]) => {
    for (const [x, y] of points) shape.lineTo(side * x, y)
  }
  /** Points along a curve from one place to another, bowed by two handles: enough of them that the frame can be bent. */
  const bezier = (from: [number, number], h1: [number, number], h2: [number, number], to: [number, number], n = 18): [number, number][] =>
    Array.from({ length: n }, (_, i) => {
      const t = (i + 1) / n
      const m = 1 - t
      return [m * m * m * from[0] + 3 * m * m * t * h1[0] + 3 * m * t * t * h2[0] + t * t * t * to[0], m * m * m * from[1] + 3 * m * m * t * h1[1] + 3 * m * t * t * h2[1] + t * t * t * to[1]] as [number, number]
    })
  const line = (from: [number, number], to: [number, number], n = 8): [number, number][] => Array.from({ length: n }, (_, i) => [from[0] + ((to[0] - from[0]) * (i + 1)) / n, from[1] + ((to[1] - from[1]) * (i + 1)) / n] as [number, number])
  // Its right-hand side, from the foot up: the outside of a blade, the yoke's corner, the fillet into the neck, the neck
  const outer: [number, number][] = [
    ...bezier([0.042, 0.4], [0.05, 0.56], [0.142, 0.7], [0.152, 0.93]),
    ...bezier([0.152, 0.93], [0.156, 1.02], [0.135, 1.045], [0.1, 1.045], 8),
    ...line([0.1, 1.045], [0.056, 1.045], 3),
    ...bezier([0.056, 1.045], [0.03, 1.045], [0.027, 1.06], [0.027, 1.09], 6),
    ...line([0.027, 1.09], [0.027, 1.36], 10),
  ]
  const shape = new THREE.Shape()
  shape.moveTo(-0.042, 0.4)
  shape.lineTo(0.042, 0.4)
  half(shape, 1, outer)
  shape.lineTo(-0.027, 1.36)
  half(shape, -1, [...outer].reverse().slice(1))
  shape.lineTo(-0.042, 0.4)
  // The opening between the blades: from where they part, up to the underside of the yoke
  const inner: [number, number][] = [...bezier([0, 0.54], [0.03, 0.63], [0.086, 0.75], [0.094, 0.92]), ...bezier([0.094, 0.92], [0.096, 0.975], [0.085, 0.985], [0.06, 0.985], 6)]
  const hole = new THREE.Path()
  hole.moveTo(0, 0.54)
  half(hole, -1, inner)
  hole.lineTo(0.06, 0.985)
  half(hole, 1, [...inner].reverse().slice(1))
  hole.lineTo(0, 0.54)
  shape.holes.push(hole)
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.007, bevelSegments: 4, curveSegments: 6 })
  // Flat as it is drawn: bent to the chair's back, by how high each part of it is
  const at = geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < at.count; i++) at.setZ(i, at.getZ(i) - 0.01 + through(SPINE_BACK, at.getY(i)))
  at.needsUpdate = true
  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, paint)
}

/** One arm of the base: thick at the hub, slighter and lower at its caster. */
function baseArm(paint: THREE.Material, long: number): THREE.Mesh {
  const geometry = new RoundedBoxGeometry(long, 0.052, 0.074, 4, 0.022)
  const at = geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < at.count; i++) {
    const t = at.getX(i) / long + 0.5
    at.setY(i, at.getY(i) * (1 - 0.42 * t) - 0.03 * t * t)
    at.setZ(i, at.getZ(i) * (1 - 0.36 * t))
  }
  at.needsUpdate = true
  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, paint)
}

/** The chair, built of solids. What is painted is given `paint`; the rest is mesh, plastic and chrome. */
function chair(paint: THREE.Material) {
  const group = new THREE.Group()
  const cloth = new THREE.MeshStandardMaterial({ color: '#17181b', roughness: 0.95, metalness: 0, alphaMap: weave(), transparent: true, depthWrite: false, side: THREE.DoubleSide })
  const plastic = new THREE.MeshStandardMaterial({ color: '#0e0f11', roughness: 0.52, metalness: 0.08 })
  const pad = new THREE.MeshStandardMaterial({ color: '#131416', roughness: 0.8, metalness: 0 })
  const chrome = new THREE.MeshStandardMaterial({ color: '#d9dce1', roughness: 0.12, metalness: 1 })
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, at: [number, number, number], turn: [number, number, number] = [0, 0, 0]) => {
    const part = new THREE.Mesh(geometry, material)
    part.position.set(...at)
    part.rotation.set(...turn)
    group.add(part)
    return part
  }
  const put = <T extends THREE.Object3D>(part: T, at: [number, number, number], turn: [number, number, number] = [0, 0, 0]) => {
    part.position.set(...at)
    part.rotation.set(...turn)
    group.add(part)
    return part
  }
  const tube = (points: [number, number, number][], radius: number, around = 12) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 36, radius, around, false)

  // ---- The base: five painted arms from a painted hub, each on a pair of wheels
  const reach = 0.335
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2
    put(baseArm(paint, reach), [Math.cos(a) * (reach / 2 + 0.03), 0.112, Math.sin(a) * (reach / 2 + 0.03)], [0, -a, 0])
    const end: [number, number] = [Math.cos(a) * (reach + 0.03), Math.sin(a) * (reach + 0.03)]
    add(new THREE.CylinderGeometry(0.011, 0.011, 0.045, 12), chrome, [end[0], 0.068, end[1]])
    for (const side of [-1, 1]) add(new THREE.CylinderGeometry(0.031, 0.031, 0.02, 22), plastic, [end[0] + Math.sin(a) * side * 0.014, 0.031, end[1] - Math.cos(a) * side * 0.014], [Math.PI / 2, 0, -a])
  }
  add(new THREE.CylinderGeometry(0.062, 0.082, 0.085, 32), paint, [0, 0.118, 0])
  // ---- The gas lift, and the works under the seat with their levers
  add(new THREE.CylinderGeometry(0.031, 0.036, 0.15, 24), plastic, [0, 0.225, 0])
  add(new THREE.CylinderGeometry(0.021, 0.021, 0.16, 24), chrome, [0, 0.36, 0])
  add(new RoundedBoxGeometry(0.25, 0.075, 0.3, 4, 0.025), plastic, [0, 0.438, -0.01])
  add(new THREE.CylinderGeometry(0.009, 0.009, 0.17, 10), plastic, [0.2, 0.43, 0.06], [0, 0, Math.PI / 2])
  add(new RoundedBoxGeometry(0.05, 0.016, 0.034, 3, 0.007), plastic, [0.29, 0.43, 0.06])
  // ---- The seat: mesh in its rim, its front edge falling away
  put(sheetOf({ top: 0.5, foot: 0.53, tall: 0.5, round: 0.1, bow: 0.022, droop: 0.045 }, cloth, plastic, 0.016), [0, 0.5, 0.03], [-Math.PI / 2, 0, Math.PI])
  // ---- The arms: a chrome bracket from under the seat, a post, and a pad
  for (const side of [-1, 1] as const) {
    add(tube([[side * 0.1, 0.43, 0], [side * 0.24, 0.415, 0.015], [side * 0.315, 0.44, 0.025], [side * 0.332, 0.53, 0.03]], 0.014), chrome, [0, 0, 0])
    add(new RoundedBoxGeometry(0.046, 0.21, 0.062, 4, 0.016), plastic, [side * 0.333, 0.625, 0.03], [0.06, 0, 0])
    add(new RoundedBoxGeometry(0.096, 0.034, 0.27, 5, 0.016), pad, [side * 0.335, 0.745, 0.055])
  }
  // ---- The painted frame up the back, the band across it, and the badge on the band
  group.add(frame(paint))
  add(tube([[-0.228, 0, -0.275], [-0.14, 0, -0.362], [0, 0, -0.39], [0.14, 0, -0.362], [0.228, 0, -0.275]], 0.015, 10), plastic, [0, 0.9, 0]).scale.set(1, 1.7, 1)
  const oval = add(new THREE.CircleGeometry(0.03, 40), new THREE.MeshStandardMaterial({ map: badge(), roughness: 0.4, metalness: 0.3 }), [0, 0.9, -0.411], [0, Math.PI, 0])
  oval.scale.set(1.95, 1, 1)
  add(new THREE.TorusGeometry(0.03, 0.006, 10, 40), plastic, [0, 0.9, -0.408], [0, Math.PI, 0]).scale.set(1.95, 1, 1)
  // ---- The back, the lumbar pad under it, and the headrest on the frame's neck: mesh, each in its rim, each leaning a little
  put(sheetOf({ top: 0.5, foot: 0.45, tall: 0.5, round: 0.1, bow: 0.055 }, cloth, plastic, 0.017), [0, 0.985, -0.285], [-0.09, 0, 0])
  put(sheetOf({ top: 0.4, foot: 0.38, tall: 0.165, round: 0.055, bow: 0.04 }, cloth, plastic, 0.015), [0, 0.655, -0.245], [0.04, 0, 0])
  put(sheetOf({ top: 0.3, foot: 0.31, tall: 0.135, round: 0.05, bow: 0.03 }, cloth, plastic, 0.014), [0, 1.385, -0.295], [0.1, 0, 0])
  add(new RoundedBoxGeometry(0.07, 0.07, 0.035, 4, 0.012), plastic, [0, 1.35, -0.322])
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
  // (the mapping made for showing a product in its true color: a filmic one washes a strong paint pale)
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1

  const scene = new THREE.Scene()
  // What the gloss and the chrome have to reflect: a plain lit room, made here, so no picture is fetched for it
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
  const drawn3d = chair(material)
  table.add(drawn3d)
  // A file of the real chair, where there is one: it takes the drawn chair's place once it has loaded,
  // stood on the floor at the same height, with the paint on whatever of it is named for paint
  if (CHAIR_MODEL)
    void import('three/examples/jsm/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(CHAIR_MODEL!))
      .then((file) => {
        if (stopped) return
        const model = file.scene
        const box = new THREE.Box3().setFromObject(model)
        const tall = box.max.y - box.min.y
        if (!(tall > 0)) return
        const fit = 1.46 / tall
        model.scale.setScalar(fit)
        model.position.set(-((box.min.x + box.max.x) / 2) * fit, -box.min.y * fit, -((box.min.z + box.max.z) / 2) * fit)
        model.traverse((thing) => {
          if (thing instanceof THREE.Mesh && [thing.material].flat().some((m) => /paint/i.test(m.name))) thing.material = material
        })
        table.remove(drawn3d)
        table.add(model)
        ask()
      })
      .catch(() => {
        // No file, or one that cannot be read: the drawn chair stays
      })
  table.rotation.y = OPEN
  scene.add(table)
  scene.add(shadow())

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
    drawn()
    if (fading || settling) ask()
  }
  // Drawn when something has changed, and not otherwise: a chair standing still costs nothing
  const ask = () => {
    if (!frame && !stopped) frame = requestAnimationFrame(draw)
  }

  let first = true
  return {
    paint(color, moving, matte) {
      const to = hex(color)
      // (a gloss paint has a clear coat over it; Matte Black has none, and scatters what light it gets)
      material.clearcoat = matte ? 0 : 0.8
      material.roughness = matte ? 0.78 : 0.42
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
