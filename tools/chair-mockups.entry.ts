import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Finish } from '../store/shared/colors'
import { OPEN, chairFile, finishPaint, paintOf, standChair } from '../src/apps/workspace/stage'

// The page tools/chair-mockups.cjs drives: the studio's own chair (its file, its paint, its lights), stood
// in a photographer's white studio and taken as a still. What it gives back is the chair and the shadow it
// casts, with nothing behind them, as numbers: the tool lays them over the backdrop and writes the files.
//
// A still can afford what a turning chair cannot: each picture is many pictures laid over one another, the
// lamp moved a little for each (so the shadow has the soft edge a large lamp gives) and the camera moved by
// less than a pixel (so no edge is jagged). Before them, the floor alone is taken under lamps all round the
// sky: where the chair keeps the sky off the floor is dark (the dark under a thing that stands on a floor).

const hex = (color: string) => new THREE.Color(color)

/** A chance number that is the same every run: the pictures are the same files every time they are made. */
function chance(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Shot {
  color: string
  shift?: string[]
  finish: Finish
  /** How far round the chair is turned from how the studio opens it (from behind, at a slight three-quarter). */
  turn: number
  w: number
  h: number
  /** How many pictures are laid over one another. */
  samples: number
  /** How much of the picture's height the chair stands in, and how far down the picture its middle is. */
  fills: number
  middle: number
  /** How far above level the camera looks down from. */
  down: number
  /** How dark the shadow its lamp throws on the floor is, of 1. */
  shadow: number
}

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NeutralToneMapping
renderer.toneMappingExposure = 1
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setClearColor(0x000000, 0)

const scene = new THREE.Scene()
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.35
// The studio's own lights (src/apps/workspace/stage.ts): lit from above and in front, the same for every color
scene.add(new THREE.HemisphereLight('#ffffff', '#b9b9c2', 0.9))
const key = new THREE.DirectionalLight('#ffffff', 2)
const KEY = new THREE.Vector3(1.4, 3.2, 2.6)
key.position.copy(KEY)
key.castShadow = true
key.shadow.mapSize.set(2048, 2048)
key.shadow.camera.left = key.shadow.camera.bottom = -1.5
key.shadow.camera.right = key.shadow.camera.top = 1.5
key.shadow.camera.near = 0.5
key.shadow.camera.far = 9
key.shadow.bias = -0.0006
key.shadow.normalBias = 0.012
key.shadow.radius = 2
scene.add(key)
const fill = new THREE.DirectionalLight('#ffffff', 0.5)
fill.position.set(-2.2, 1.6, -1.8)
scene.add(fill)

/** The floor: nothing but the shadow that falls on it. */
const ground = new THREE.ShadowMaterial({ opacity: 1, color: 0x000000 })
const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), ground)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

const { material, shift } = paintOf()
const table = new THREE.Group()
scene.add(table)
const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 30)

let chair: THREE.Object3D | null = null
const ready = chairFile().then((file) => {
  chair = standChair(file, material)
  chair.traverse((thing) => {
    if (!(thing instanceof THREE.Mesh)) return
    thing.castShadow = true
    // (the chair is not shaded by its own shadow map: the frame's thin tubes would be striped by it. What
    // shades it is what shades it in the studio)
    thing.receiveShadow = false
  })
  table.add(chair)
})

/** Where the chair's own points are, turned as it is: how tall and how wide it stands. */
function boundsOf() {
  table.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(table)
}

function frame(shot: Shot) {
  const box = boundsOf()
  const tall = box.max.y - box.min.y
  const fov = (camera.fov * Math.PI) / 180
  // So far off that the chair stands in its share of the picture's height
  const far = tall / shot.fills / (2 * Math.tan(fov / 2)) / Math.cos(shot.down)
  const mid = (box.max.y + box.min.y) / 2
  camera.aspect = shot.w / shot.h
  camera.position.set(0, mid + Math.sin(shot.down) * far, Math.cos(shot.down) * far)
  camera.lookAt(0, mid, 0)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  // And its middle is put where the picture wants it: the lens is slid, not tilted, so that uprights stay upright
  camera.setViewOffset(shot.w, shot.h, 0, Math.round((0.5 - shot.middle) * shot.h), shot.w, shot.h)
}

/** One picture, the camera moved by part of a pixel: what is in the canvas afterwards. */
function take(shot: Shot, dx: number, dy: number, into: Float32Array, pixels: Uint8Array, channel: 'all' | 'alpha') {
  const offsetY = Math.round((0.5 - shot.middle) * shot.h)
  camera.setViewOffset(shot.w, shot.h, dx, offsetY + dy, shot.w, shot.h)
  renderer.render(scene, camera)
  const gl = renderer.getContext()
  gl.readPixels(0, 0, shot.w, shot.h, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  if (channel === 'alpha') for (let i = 0, n = shot.w * shot.h; i < n; i++) into[i] += pixels[i * 4 + 3]!
  else for (let i = 0, n = pixels.length; i < n; i++) into[i] += pixels[i]!
}

const b64 = (bytes: Uint8Array) => {
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(out)
}

/** The dark under the chair, for a turn: the floor alone, under lamps all round the sky. The same for every color. */
async function under(shot: Shot, lamps: number): Promise<string> {
  await ready
  renderer.setSize(shot.w, shot.h, false)
  table.rotation.y = OPEN + shot.turn
  frame(shot)
  const hidden: THREE.Material[] = []
  chair!.traverse((thing) => {
    if (!(thing instanceof THREE.Mesh)) return
    for (const m of [thing.material].flat() as THREE.Material[]) if (m.colorWrite) (m.colorWrite = false), hidden.push(m)
  })
  ground.opacity = 1
  const sum = new Float32Array(shot.w * shot.h)
  const pixels = new Uint8Array(shot.w * shot.h * 4)
  const rand = chance(7)
  key.shadow.radius = 3
  for (let i = 0; i < lamps; i++) {
    // (over the part of the sky that is nearly overhead: the light that a thing standing on a floor keeps
    // off the floor under it. Lower lamps than these throw the chair's back across the floor as long shapes)
    const u = ((i + rand()) / lamps) * 0.2
    const up = Math.sqrt(1 - u)
    const round = 2 * Math.PI * rand()
    const out = Math.sqrt(u)
    key.position.set(Math.cos(round) * out * 5, up * 5, Math.sin(round) * out * 5)
    take(shot, rand() - 0.5, rand() - 0.5, sum, pixels, 'alpha')
    if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0))
  }
  for (const m of hidden) m.colorWrite = true
  key.position.copy(KEY)
  key.shadow.radius = 2
  const out = new Uint8Array(shot.w * shot.h)
  for (let i = 0; i < out.length; i++) out[i] = Math.round(sum[i]! / lamps)
  return b64(out)
}

/** The chair in a color, and the shadow its lamp throws: red, green, blue and how much is there, the color
 * already multiplied by how much (as the canvas keeps it), top row last (as the canvas is read). */
async function still(shot: Shot): Promise<string> {
  await ready
  renderer.setSize(shot.w, shot.h, false)
  table.rotation.y = OPEN + shot.turn
  finishPaint(material, shift, shot.color, shot.shift, shot.finish)
  material.color.copy(hex(shot.color))
  shift.uShift.value = shot.shift ? 1 : 0
  ground.opacity = shot.shadow
  frame(shot)
  const sum = new Float32Array(shot.w * shot.h * 4)
  const pixels = new Uint8Array(shot.w * shot.h * 4)
  const rand = chance(11)
  // The lamp is a large one: it is moved about its own face for each picture
  const across = new THREE.Vector3().crossVectors(KEY, new THREE.Vector3(0, 1, 0)).normalize()
  const along = new THREE.Vector3().crossVectors(KEY, across).normalize()
  for (let i = 0; i < shot.samples; i++) {
    const r = 0.55 * Math.sqrt((i + rand()) / shot.samples)
    const a = 2 * Math.PI * rand()
    key.position.copy(KEY).addScaledVector(across, Math.cos(a) * r).addScaledVector(along, Math.sin(a) * r)
    take(shot, rand() - 0.5, rand() - 0.5, sum, pixels, 'all')
    if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0))
  }
  key.position.copy(KEY)
  const out = new Uint8Array(sum.length)
  for (let i = 0; i < out.length; i++) out[i] = Math.round(sum[i]! / shot.samples)
  return b64(out)
}

Object.assign(window, { mockup: { ready, under, still } })
