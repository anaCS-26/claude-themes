// Dunes Lite, nocturne: a desert night printed in ordered dither. One still picture, painted once.
// It keeps the way the Dither Dunes scene from Anthropic's theme-examples plugin (Apache-2.0, see LICENSE) prints tone:
// one pattern per threshold of an 8x8 Bayer matrix, and one path per threshold covering the tiles that pass it.
// Everything drawn with it is new: a night sky with the Milky Way, a ringed moon, far mesas, six dunes lit from the moon's side,
// a caravan on the horizon, an oasis and a camp fire.
// Pure string building: no DOM, no imports, no animation, no blur, and the same output on every build.

const WIDTH = 1600
const HEIGHT = 1000
/**
 * How fine the grain is: the dither pixels that stand where one stood on the first grid of 5 units.
 * The picture is laid out in units, so this changes its grain and not its layout: at 2, a 1600 px wide window draws a dither pixel 2.5 px wide,
 * and a 2560 px one 4 px. The figures are drawn in pixels, so they get smaller as the grain gets finer.
 */
const FINE = 2
const CELL = 5 / FINE
const MATRIX = 8
const TILE = CELL * MATRIX
const TILE_COLUMNS = Math.ceil(WIDTH / TILE)
const TILE_ROWS = Math.ceil(HEIGHT / TILE)
const TONES = MATRIX * MATRIX
const COLUMNS = Math.ceil(WIDTH / CELL)
const ROWS = Math.ceil(HEIGHT / CELL)

/** A length or a place in units, as a whole number of dither pixels. */
function cells(units: number): number {
  return Math.round(units / CELL)
}

/** The sky's paper, and the inks. The sky is cool, the land keeps the warm umber and sand of the original stock. */
const PAPER = '#14131c'
const INK_BLUE = '#1d2444'
const INK_DUSK = '#3a2a36'
const INK_EMBER = '#7d4029'
/** Dark enough to sit under the conversation: every dune is shaded in it across the whole window. */
const INK_LEE = '#40362a'
/** Darker than any sand: the slip faces the moon doesn't reach. */
const INK_SHADOW = '#171210'
/** Both edges of the window only. */
const INK_SOFT = '#6b5c47'
/** The right edge only, where no panel covers the picture. */
const INK_STRONG = '#988462'

const SILHOUETTE = '#0d0b0e'
const MESA = '#1b1820'
const FAR_RANGE = '#241f2c'
const MOON = '#eadfc6'
const MOON_SEA = '#b9aa90'
const GLINT = '#d8c6a0'
const STAR_DIM = '#3d3b4c'
const STAR_MID = '#7a768a'
const STAR_BRIGHT = '#e6dfd0'
const FIRE_TIP = '#ffc46b'
const FIRE = '#f08a3c'
const FIRE_BASE = '#c8573a'
const FIRE_LIT = '#8a4630'
const WATER = '#222a4c'
const WATER_LIGHT = '#6f76a0'

const MOON_X = 1390
const MOON_Y = 285
const MOON_R = 62
/** The camp stands on this row of pixels, and its fire starts at this column. */
const CAMP_ROW = cells(890) - 1
const TENT_COLUMN = cells(1384)
const FIRE_COLUMN = TENT_COLUMN - 16
const FIRE_X = (FIRE_COLUMN + 2.5) * CELL
const FIRE_Y = (CAMP_ROW + 0.5) * CELL

/** A tone to be dithered: 0 prints nothing, 0.5 prints every other pixel. */
type Tone = (x: number, y: number) => number

/** Dither pixels by colour, keyed by cell. A later colour on the same cell replaces the earlier one. */
type Canvas = Map<number, string>

/** A small seeded generator, so the stars fall in the same places on every build. */
function mulberry(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function smoothstep(low: number, high: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)))
  return t * t * (3 - 2 * t)
}

/** The ordered-dither threshold matrix, built by the usual doubling. */
function bayerMatrix(size: number): number[][] {
  if (size === 1) return [[0]]
  const half = bayerMatrix(size / 2)
  const matrix: number[][] = []
  for (let y = 0; y < size; y += 1) {
    const row: number[] = []
    for (let x = 0; x < size; x += 1) {
      const top = y < size / 2
      const left = x < size / 2
      const quarter = top ? (left ? 0 : 2) : left ? 3 : 1
      row.push(4 * (half[y % (size / 2)]?.[x % (size / 2)] ?? 0) + quarter)
    }
    matrix.push(row)
  }
  return matrix
}

const BAYER: readonly (readonly number[])[] = bayerMatrix(MATRIX)

/** Where in the tile each threshold's pixel sits. */
const PLACE: (readonly [number, number])[] = []
for (let y = 0; y < MATRIX; y += 1) {
  for (let x = 0; x < MATRIX; x += 1) PLACE[BAYER[y]?.[x] ?? 0] = [x, y]
}

/** The matrix's threshold for a dither pixel: a tone between 0 and 1. */
function thresholdAt(cx: number, cy: number): number {
  return ((BAYER[((cy % MATRIX) + MATRIX) % MATRIX]?.[((cx % MATRIX) + MATRIX) % MATRIX] ?? 0) + 0.5) / TONES
}

/**
 * One pattern per threshold, each a single dither pixel in its place in the tile, in one ink.
 * An inverted ink takes the matrix from the far end, so it prints on the pixels a plain ink reaches last: the two never share a pixel below a half.
 */
function inkPatterns(id: string, colour: string, levels: number, inverted: boolean): string {
  const short = (value: number): string => String(value).replace(/^0\./, '.')
  let out = ''
  for (let level = 0; level < levels; level += 1) {
    const [x, y] = PLACE[inverted ? TONES - 1 - level : level] ?? [0, 0]
    const side = short(1 / MATRIX)
    out += `<pattern id="${id}${level}" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M${short(x / MATRIX)} ${short(y / MATRIX)}h${side}v${side}h-${side}z"/></pattern>`
  }
  /** A pattern's content takes its fill from where the pattern is defined, so one group colours them all. */
  return `<g fill="${colour}">${out}</g>`
}

/** One threshold, in tile units: the outline of every tile whose pixel at that threshold passes the tone. */
function levelPath(level: number, tone: Tone, inverted: boolean): string {
  const [pixelColumn, pixelRow] = PLACE[inverted ? TONES - 1 - level : level] ?? [0, 0]
  const threshold = (level + 0.5) / TONES
  const tiles = new Set<number>()
  for (let row = 0; row < TILE_ROWS; row += 1) {
    for (let column = 0; column < TILE_COLUMNS; column += 1) {
      if (tone(column * TILE + (pixelColumn + 0.5) * CELL, row * TILE + (pixelRow + 0.5) * CELL) > threshold) tiles.add(cellKey(column, row))
    }
  }
  return outlineOf(tiles)
}

/** A tone printed in one ink: a path per threshold. */
function printed(id: string, levels: number, tone: Tone, inverted = false): string {
  let layers = ''
  for (let level = 0; level < levels; level += 1) {
    const path = levelPath(level, tone, inverted)
    if (path !== '') layers += `<path d="${path}" fill="url(#${id}${level})"/>`
  }
  return layers
}

// ---------------------------------------------------------------------------------------------------------------- pixels

function cellKey(cx: number, cy: number): number {
  return (cy + 64) * 1024 + (cx + 64)
}

function put(canvas: Canvas, cx: number, cy: number, colour: string): void {
  if (cx < 0 || cx >= COLUMNS || cy < 0 || cy >= ROWS) return
  canvas.set(cellKey(cx, cy), colour)
}

/** A sprite from rows of characters: `.` is empty, any other character names a colour in the palette. */
function stamp(canvas: Canvas, rows: readonly string[], cx: number, cy: number, palette: Readonly<Record<string, string>>, flipped = false): void {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx += 1) {
      const colour = palette[row[flipped ? row.length - 1 - dx : dx] ?? '.']
      if (colour !== undefined) put(canvas, cx + dx, cy + dy, colour)
    }
  })
}

/**
 * The outline of a set of cells as closed loops, the inside always on the right, so holes wind the other way and stay holes.
 * One outline per shape, not one box per run: touching boxes would show hairlines between them at window sizes off the grid.
 */
function outlineOf(cells: ReadonlySet<number>): string {
  const exits = new Map<number, number[]>()
  const corner = (x: number, y: number): number => y * 1024 + x
  const edge = (fromX: number, fromY: number, toX: number, toY: number): void => {
    const from = corner(fromX, fromY)
    const list = exits.get(from)
    if (list === undefined) exits.set(from, [corner(toX, toY)])
    else list.push(corner(toX, toY))
  }
  for (const key of cells) {
    const x = key % 1024
    const y = (key - x) / 1024
    if (!cells.has(key - 1024)) edge(x, y, x + 1, y)
    if (!cells.has(key + 1)) edge(x + 1, y, x + 1, y + 1)
    if (!cells.has(key + 1024)) edge(x + 1, y + 1, x, y + 1)
    if (!cells.has(key - 1)) edge(x, y + 1, x, y)
  }
  let path = ''
  for (const start of [...exits.keys()]) {
    while ((exits.get(start)?.length ?? 0) > 0) {
      const startX = start % 1024
      path += `M${startX - 64} ${(start - startX) / 1024 - 64}`
      let at = start
      let pending = ''
      let run = 0
      do {
        const next = exits.get(at)?.pop()
        if (next === undefined) break
        const step = next - at
        const direction = step === 1 || step === -1 ? 'h' : 'v'
        const amount = step === 1 || step === 1024 ? 1 : -1
        if (direction === pending && Math.sign(run) === amount) run += amount
        else {
          if (pending !== '') path += `${pending}${run}`
          pending = direction
          run = amount
        }
        at = next
      } while (at !== start)
      path += 'z'
    }
  }
  return path
}

/**
 * Pixels that touch no other of their colour, as one-pixel dashes of a stroke a pixel wide, each placed from the last.
 * A star written this way is about half the length of its outline, and most of the picture's pixels are lone ones.
 */
function dashesOf(keys: readonly number[]): string {
  let path = ''
  let atX = 0
  let atY = 0
  for (const key of [...keys].sort((a, b) => a - b)) {
    const x = (key % 1024) - 64
    const y = (key - (key % 1024)) / 1024 - 64
    path += path === '' ? `M${x} ${y}.5h1` : `m${x - atX} ${y - atY}h1`
    atX = x + 1
    atY = y
  }
  return path
}

/** A canvas as paths per colour: an outline for the pixels that touch, dashes for the lone ones. */
function drawn(canvas: Canvas): string {
  const byColour = new Map<string, Set<number>>()
  for (const [key, colour] of canvas) {
    const cells = byColour.get(colour)
    if (cells === undefined) byColour.set(colour, new Set([key]))
    else cells.add(key)
  }
  let out = ''
  for (const [colour, cells] of byColour) {
    const touching = new Set<number>()
    const lone: number[] = []
    for (const key of cells) {
      if (cells.has(key - 1) || cells.has(key + 1) || cells.has(key - 1024) || cells.has(key + 1024)) touching.add(key)
      else lone.push(key)
    }
    if (touching.size > 0) out += `<path d="${outlineOf(touching)}" fill="${colour}"/>`
    if (lone.length > 0) out += `<path d="${dashesOf(lone)}" stroke="${colour}" fill="none"/>`
  }
  return out
}

// ------------------------------------------------------------------------------------------------------------------ land

/** A point a crest line passes through; a third number of 1 marks a peak. */
type CrestPoint = readonly [number, number, number?]

/**
 * A slip-face ridge: the sharp line that runs down a dune from a peak. The moon is on the right, so sand to the right of the ridge
 * is lit, brightest at the ridge, and the slip face to its left is in shadow.
 * lean: how far the ridge has moved sideways by its foot. sway: its S-curve. shadow: the slip face's width at the foot.
 * lit: the light it adds. spread: how far the light carries.
 */
interface Ridge {
  readonly x: number
  readonly y: number
  readonly lean: number
  readonly length: number
  readonly sway: number
  readonly shadow: number
  readonly lit: number
  readonly spread: number
}

/**
 * Dunes, back to front. fill: the flat sand, a step lighter for each nearer dune; most of a dune is only that.
 * glow: the light under a crest that faces the moon, dissolving over `reach` units.
 */
interface Dune {
  readonly crest: readonly CrestPoint[]
  readonly fill: string
  readonly glow: number
  readonly reach: number
  readonly ridges: readonly Ridge[]
}

const DUNES: readonly Dune[] = [
  {
    crest: [[0, 592], [220, 566, 1], [520, 600], [860, 606], [1080, 598], [1250, 566, 1], [1600, 594]],
    fill: '#221e1d', glow: 0.3, reach: 60,
    ridges: [
      { x: 220, y: 566, lean: -60, length: 70, sway: 8, shadow: 60, lit: 0.3, spread: 150 },
      { x: 1250, y: 566, lean: -80, length: 80, sway: 10, shadow: 70, lit: 0.34, spread: 170 },
    ],
  },
  {
    crest: [[0, 652], [300, 620, 1], [560, 666], [820, 646, 1], [1060, 682], [1290, 640, 1], [1600, 672]],
    fill: '#26201b', glow: 0.34, reach: 80,
    ridges: [
      { x: 300, y: 620, lean: 90, length: 110, sway: -14, shadow: 80, lit: 0.38, spread: 170 },
      { x: 820, y: 646, lean: -100, length: 110, sway: 14, shadow: 90, lit: 0.34, spread: 200 },
      { x: 1290, y: 640, lean: -110, length: 110, sway: 14, shadow: 90, lit: 0.4, spread: 170 },
    ],
  },
  {
    crest: [[0, 742], [120, 722, 1], [470, 768], [800, 778], [1080, 756], [1400, 704, 1], [1600, 738]],
    fill: '#29221c', glow: 0.36, reach: 100,
    ridges: [
      { x: 120, y: 722, lean: 80, length: 90, sway: -10, shadow: 70, lit: 0.36, spread: 190 },
      { x: 1400, y: 704, lean: -130, length: 130, sway: 20, shadow: 120, lit: 0.46, spread: 180 },
    ],
  },
  {
    crest: [[0, 812], [250, 800], [520, 778, 1], [820, 826], [1090, 860], [1270, 812, 1], [1600, 838]],
    fill: '#2d251e', glow: 0.4, reach: 120,
    ridges: [
      { x: 520, y: 778, lean: 230, length: 230, sway: -34, shadow: 150, lit: 0.5, spread: 230 },
      { x: 1270, y: 812, lean: -110, length: 84, sway: 12, shadow: 100, lit: 0.4, spread: 230 },
    ],
  },
  {
    crest: [[0, 930], [300, 905, 1], [620, 962], [900, 976], [1180, 884, 1], [1600, 902]],
    fill: '#312820', glow: 0.42, reach: 120,
    ridges: [
      { x: 300, y: 905, lean: 90, length: 80, sway: -10, shadow: 70, lit: 0.36, spread: 200 },
      { x: 1180, y: 884, lean: -130, length: 110, sway: 16, shadow: 110, lit: 0.42, spread: 200 },
    ],
  },
  {
    crest: [[0, 985], [330, 972, 1], [700, 992], [1000, 996], [1300, 990], [1600, 980]],
    fill: '#352b21', glow: 0.36, reach: 40,
    ridges: [],
  },
]

/** Height of a crest line at x. Between plain points it eases like a cosine; it runs into a peak steeply and concave, the way sand lies. */
function crestAt(points: readonly CrestPoint[], x: number): number {
  let last = 0
  for (let index = 0; index < points.length; index += 1) {
    const to = points[index]
    if (to === undefined) continue
    last = to[1]
    if (x > to[0]) continue
    const from = index === 0 ? undefined : points[index - 1]
    if (from === undefined) return to[1]
    const t = (x - from[0]) / (to[0] - from[0])
    let eased = (1 - Math.cos(Math.PI * t)) / 2
    if (to[2] === 1 && from[2] !== 1) eased = Math.pow(t, 1.7)
    if (from[2] === 1 && to[2] !== 1) eased = 1 - Math.pow(1 - t, 1.7)
    return from[1] + (to[1] - from[1]) * eased
  }
  return last
}

/** Each crest on the dither grid: the first row of cells a dune fills, per column. */
const CREST_ROWS: readonly (readonly number[])[] = DUNES.map(dune => {
  const rows: number[] = []
  for (let cx = 0; cx < COLUMNS; cx += 1) rows.push(Math.round(crestAt(dune.crest, cx * CELL + CELL / 2) / CELL))
  return rows
})

function crestRow(index: number, cx: number): number {
  return CREST_ROWS[index]?.[Math.min(COLUMNS - 1, Math.max(0, cx))] ?? ROWS
}

/** The dune in front at a cell, or -1 for the sky. */
function duneAt(cx: number, cy: number): number {
  for (let index = DUNES.length - 1; index >= 0; index -= 1) {
    if (cy >= crestRow(index, cx)) return index
  }
  return -1
}

/** How much a place takes the brighter inks: 0 under the conversation, 1 at the window's edges. */
function leftEdge(x: number): number {
  return 1 - smoothstep(0.06, 0.24, x / WIDTH)
}

function rightEdge(x: number): number {
  return smoothstep(0.76, 0.93, x / WIDTH)
}

/** Moonlight on a dune at a point, 0 to about 1, and how deep in a slip face's shadow the point is, 0 to 1. */
function lighting(index: number, x: number, y: number): readonly [number, number] {
  const dune = DUNES[index]
  if (dune === undefined) return [0, 0]
  const depth = Math.max(0, y - crestAt(dune.crest, x))
  const fall = (crestAt(dune.crest, x + 14) - crestAt(dune.crest, x - 14)) / 28
  const facing = 0.12 + 0.88 * smoothstep(-0.08, 0.16, fall)
  let light = dune.glow * facing * Math.pow(Math.max(0, 1 - depth / dune.reach), 1.5)
  let shade = 0
  for (const ridge of dune.ridges) {
    const t = (y - ridge.y) / ridge.length
    if (t <= 0 || t >= 1) continue
    const ridgeX = ridge.x + ridge.lean * Math.pow(t, 0.85) + ridge.sway * Math.sin(t * Math.PI * 1.4)
    const strength = 1 - smoothstep(0.6, 1, t)
    const across = x - ridgeX
    if (across >= 0) {
      light += ridge.lit * strength * Math.exp(-across / (ridge.spread * (0.35 + t)))
    } else {
      const width = ridge.shadow * Math.pow(t, 0.6)
      shade = Math.max(shade, strength * (1 - smoothstep(width * 0.55, width, -across)))
    }
  }
  return [light * (1 - shade), shade]
}

/** Light and shadow where a point is land; nothing where it's sky. */
function landLight(x: number, y: number): readonly [number, number] {
  const index = duneAt(Math.floor(x / CELL), Math.floor(y / CELL))
  return index < 0 ? [0, 0] : lighting(index, x, y)
}

const leeTone: Tone = (x, y) => Math.min(0.5, landLight(x, y)[0])
const softTone: Tone = (x, y) => Math.min(0.5, Math.max(0, landLight(x, y)[0] - 0.16) * 1.25) * Math.max(0.6 * leftEdge(x), rightEdge(x))
const strongTone: Tone = (x, y) => Math.min(0.28, Math.max(0, landLight(x, y)[0] - 0.34) * 1.3) * smoothstep(0.8, 0.95, x / WIDTH)

/** The dithered rim of a slip face's shadow; its core is solid, see shadowPixels. Far dunes are hazier, so their shadows are thinner. */
const shadowTone: Tone = (x, y) => {
  const index = duneAt(Math.floor(x / CELL), Math.floor(y / CELL))
  if (index < 0) return 0
  const shade = lighting(index, x, y)[1]
  return shade >= SHADOW_CORE ? 0 : 0.5 * shade * (0.5 + 0.1 * index)
}

/** Above this the shadow is laid flat, so a slip face is one clean dark shape with a crisp ridge. */
const SHADOW_CORE = 0.7

function channel(colour: string, at: number): number {
  return Number.parseInt(colour.slice(at, at + 2), 16)
}

/** A colour part of the way from one to another. */
function mixed(from: string, to: string, amount: number): string {
  let out = '#'
  for (const at of [1, 3, 5]) {
    out += Math.round(channel(from, at) + (channel(to, at) - channel(from, at)) * amount).toString(16).padStart(2, '0')
  }
  return out
}

/** The solid cores of the slip-face shadows, each in its dune's sand taken toward the shadow ink. */
function shadowPixels(canvas: Canvas): void {
  const colours = DUNES.map((dune, index) => mixed(dune.fill, INK_SHADOW, 0.34 + 0.07 * index))
  for (let cy = cells(500); cy < ROWS; cy += 1) {
    for (let cx = 0; cx < COLUMNS; cx += 1) {
      const index = duneAt(cx, cy)
      if (index < 0) continue
      const colour = colours[index]
      if (colour !== undefined && lighting(index, cx * CELL + CELL / 2, cy * CELL + CELL / 2)[1] >= SHADOW_CORE) put(canvas, cx, cy, colour)
    }
  }
}

/**
 * Wind ripples on the three nearest dunes: wavy lines a pixel thick, five apart, cut out of the dots wherever the moon lights the sand,
 * in patches, the way wind leaves them. A cut line is the dune's own flat sand, so it is never brighter than what it crosses.
 */
function ripplePixels(canvas: Canvas): void {
  for (let cy = cells(750); cy < ROWS; cy += 1) {
    for (let cx = 0; cx < COLUMNS; cx += 1) {
      const index = duneAt(cx, cy)
      const dune = DUNES[index]
      if (index < 3 || dune === undefined) continue
      const x = cx * CELL + CELL / 2
      const y = cy * CELL + CELL / 2
      const [light, shade] = lighting(index, x, y)
      if (light < 0.2 || shade > 0) continue
      if (Math.sin(x / 105 + y / 40 + index * 2.1) < -0.25) continue
      const line = Math.round(cy + FINE * (1.5 * Math.sin(x / 32 + index * 1.3) + 0.7 * Math.sin(x / 13.5 + y / 25)))
      if (line % 5 === 0) put(canvas, cx, cy, dune.fill)
    }
  }
}

/** The fire's light on the sand: clean rings of ember dots, a half, a quarter, an eighth, flattened as they lie on the ground. */
const fireTone: Tone = (x, y) => {
  if (duneAt(Math.floor(x / CELL), Math.floor(y / CELL)) !== 3) return 0
  const distance = Math.hypot(x - FIRE_X, (y - FIRE_Y) * 2.1)
  if (distance <= 38) return 0.5
  if (distance <= 72) return 0.25
  if (distance <= 116) return 0.125
  return distance <= 168 ? 0.0625 : 0
}

/** A dune's outline in cells: a staircase on the dither grid, down to the foot of the picture. */
function staircase(topAt: (cx: number) => number): string {
  let path = `M-1 ${ROWS}`
  let previous = Number.NaN
  for (let cx = 0; cx < COLUMNS; cx += 1) {
    const top = topAt(cx)
    if (top !== previous) {
      path += Number.isNaN(previous) ? `V${top}` : `H${cx}V${top}`
      previous = top
    }
  }
  return `${path}H${COLUMNS + 1}V${ROWS}z`
}

/** Far mesas on the horizon: flat tops, steep sides. Each is from, to and height. */
const MESAS: readonly (readonly [number, number, number])[] = [
  [70, 250, 78], [285, 330, 104], [352, 374, 88], [400, 545, 48],
  [870, 1005, 52], [1030, 1070, 76], [1088, 1170, 38],
]

function mesaTop(x: number): number {
  let height = 0
  for (const [from, to, tall] of MESAS) {
    const side = Math.min(1, Math.max(0, (x - from + 14) / 14)) * Math.min(1, Math.max(0, (to + 14 - x) / 14))
    const outside = Math.max(0, from - x, x - to)
    height = Math.max(height, tall * side, 0.36 * tall * Math.max(0, 1 - outside / 50))
  }
  return 606 - height
}

/** A low, hazy range far behind the mesas. */
function farRangeRow(cx: number): number {
  const x = cx * CELL + CELL / 2
  return Math.round((578 - 13 * Math.sin(x / 170 + 1) - 8 * Math.sin(x / 61) - 5 * Math.sin(x / 23 + 2)) / CELL)
}

function mesaRow(cx: number): number {
  return Math.round(mesaTop(cx * CELL + CELL / 2) / CELL)
}

// ------------------------------------------------------------------------------------------------------------------- sky

/** The Milky Way: a band from the left horizon up across the top, clumped, with a dark lane down its middle. 0 to about 0.55. */
function milkyWay(x: number, y: number): number {
  const fromX = x - 40
  const fromY = y - 570
  const along = fromX * 0.879 - fromY * 0.476
  const across = fromX * 0.476 + fromY * 0.879
  const width = 64 + 22 * Math.sin(along / 210)
  const clump = 0.62 + 0.38 * Math.sin(along / 95 + 0.7) * Math.cos(along / 41 + across / 33)
  const lane = 0.25 + 0.75 * smoothstep(6, 28, Math.abs(across - 14 * Math.sin(along / 130 + 1)))
  return 0.56 * Math.exp(-Math.pow(across / width, 2)) * clump * lane * (1 - smoothstep(450, 590, y))
}

/** The night's blue: deepest overhead, gathering toward the horizon, with the Milky Way laid over it. */
const blueTone: Tone = (x, y) => Math.min(0.5, 0.5 * smoothstep(70, 540, y + 34 * Math.sin(x / 230)) + milkyWay(x, y))

/** The last of the dusk, low in the sky. Printed inverted, so it fills the pixels the blue leaves. */
const duskTone: Tone = (x, y) => 0.5 * Math.pow(smoothstep(300, 600, y - 26 * Math.sin(x / 300 + 2)), 1.25)

/** An ember line on the horizon, strongest at the window's edges, and stronger on the moon's side. */
const emberTone: Tone = (x, y) => 0.5 * Math.pow(smoothstep(455, 602, y), 1.7) * (0.34 + 0.66 * Math.max(0.35 * leftEdge(x), rightEdge(x)))

function moonDistance(x: number, y: number): number {
  return Math.hypot(x - MOON_X, y - MOON_Y) / MOON_R
}

/** The moon's rings: clean bands of its own dots, a half, a quarter, an eighth, a sixteenth. */
const haloTone: Tone = (x, y) => {
  const distance = moonDistance(x, y)
  if (distance <= 1.45) return 0.5
  if (distance <= 1.95) return 0.25
  if (distance <= 2.55) return 0.125
  return distance <= 3.3 ? 0.0625 : 0
}

/** The innermost ring is brighter. */
const haloCoreTone: Tone = (x, y) => (moonDistance(x, y) <= 1.45 ? 0.25 : 0)

/** The moon: a solid disc, then its seas over it, solid at each sea's middle and dithered at its shore, and a shaded limb on the side away from the sun. */
function moonPixels(disc: Canvas, seas: Canvas): void {
  const blobs: readonly (readonly [number, number, number])[] = [
    [-0.36, -0.3, 0.34], [0.1, -0.44, 0.24], [-0.14, 0.14, 0.3], [0.4, 0.04, 0.2], [0.2, 0.52, 0.17], [-0.52, 0.36, 0.15],
  ]
  const reach = Math.ceil(MOON_R / CELL) + 1
  const centreX = Math.floor(MOON_X / CELL)
  const centreY = Math.floor(MOON_Y / CELL)
  for (let cy = centreY - reach; cy <= centreY + reach; cy += 1) {
    for (let cx = centreX - reach; cx <= centreX + reach; cx += 1) {
      const u = (cx * CELL + CELL / 2 - MOON_X) / MOON_R
      const v = (cy * CELL + CELL / 2 - MOON_Y) / MOON_R
      const distance = Math.hypot(u, v)
      if (distance > 1) continue
      put(disc, cx, cy, MOON)
      let sea = 0
      for (const [seaX, seaY, size] of blobs) sea = Math.max(sea, 1 - smoothstep(size * 0.45, size, Math.hypot(u - seaX, v - seaY)))
      const limb = 0.5 * smoothstep(0.62, 1, Math.hypot(u - 0.22, v + 0.2))
      if (Math.max(Math.min(1, 1.7 * sea), limb) > thresholdAt(cx, cy)) put(seas, cx, cy, MOON_SEA)
    }
  }
}

/** The first row of cells that isn't open sky, per column. */
function skylineRow(cx: number): number {
  return Math.min(crestRow(0, cx), mesaRow(cx), farRangeRow(cx))
}

/** Stars: single dither pixels. The faint ones are everywhere; the brighter ones keep to the window's edges and away from the moon. */
function starPixels(canvas: Canvas): void {
  const random = mulberry(20261114)
  for (let count = 0; count < 1150; count += 1) {
    const cx = Math.floor(random() * COLUMNS)
    const cy = Math.floor(Math.pow(random(), 1.45) * cells(600))
    const roll = random()
    const keep = random()
    if (cy >= skylineRow(cx) - 1) continue
    const x = cx * CELL + CELL / 2
    const moon = moonDistance(x, cy * CELL + CELL / 2)
    if (moon < 1.6) continue
    const centre = x > 0.2 * WIDTH && x < 0.78 * WIDTH
    if (roll > 0.94 && !centre && moon > 3.5) {
      put(canvas, cx, cy, STAR_BRIGHT)
      if (keep < 0.7) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (!canvas.has(cellKey(cx + dx, cy + dy))) put(canvas, cx + dx, cy + dy, STAR_MID)
        }
      }
    } else if (roll > 0.62 && moon > 2.7 && (!centre || keep < 0.05)) {
      put(canvas, cx, cy, STAR_MID)
    } else if (!canvas.has(cellKey(cx, cy))) {
      put(canvas, cx, cy, STAR_DIM)
    }
  }
  /** Star dust along the Milky Way, thickest where the band is. */
  for (let count = 0; count < 2200; count += 1) {
    const cx = Math.floor(random() * COLUMNS)
    const cy = Math.floor(random() * cells(580))
    const chance = random()
    if (cy >= skylineRow(cx) - 1 || canvas.has(cellKey(cx, cy))) continue
    const x = cx * CELL + CELL / 2
    const y = cy * CELL + CELL / 2
    if (chance < milkyWay(x, y) * 0.75 && moonDistance(x, y) > 3.4) put(canvas, cx, cy, STAR_DIM)
  }
}

/** Orion, standing over the mesas on the left: the belt, the sword, the four corners, with Betelgeuse in ember. */
function orionPixels(canvas: Canvas): void {
  const left = cells(250)
  const top = cells(80)
  const stars: readonly (readonly [number, number, string, boolean])[] = [
    [13, 1, STAR_MID, false], [4, 6, '#d98a5c', true], [22, 8, STAR_BRIGHT, false],
    [10, 23, STAR_BRIGHT, false], [13, 22, STAR_BRIGHT, false], [16, 21, STAR_BRIGHT, false],
    [12, 27, STAR_MID, false], [12, 29, STAR_MID, false], [7, 38, STAR_BRIGHT, false], [24, 36, STAR_BRIGHT, true],
  ]
  for (const [dx, dy, colour, flared] of stars) {
    const cx = left + Math.round(dx * FINE)
    const cy = top + Math.round(dy * FINE)
    if (flared || colour === STAR_BRIGHT) {
      for (const [armX, armY] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(canvas, cx + armX, cy + armY, flared ? colour : STAR_MID)
    }
    put(canvas, cx, cy, colour)
  }
}

/** A shooting star: a staircase of pixels, bright at the head and fading up its tail. */
function meteorPixels(canvas: Canvas): void {
  const steps = Math.round(12 * FINE)
  for (let step = 0; step < steps; step += 1) {
    const colour = step < steps / 6 ? STAR_BRIGHT : step < steps / 2 ? STAR_MID : STAR_DIM
    put(canvas, cells(1180) + step * 2, cells(135) - step, colour)
    put(canvas, cells(1180) + step * 2 + 1, cells(135) - step, colour)
  }
}

// ---------------------------------------------------------------------------------------------------------------- figures

/** A dromedary, walking right, 24 pixels long. */
const CAMEL: readonly string[] = [
  '..................##....',
  '.................#####..',
  '.................######.',
  '.................####...',
  '.................###....',
  '........###......###....',
  '.......#####....####....',
  '......#######...###.....',
  '.##################.....',
  '.#.################.....',
  '##.###############......',
  '#..###############......',
  '#...#############.......',
  '....##.##...##.##.......',
  '....##.##...##.##.......',
  '....#..##...##..#.......',
  '....#..#....#...#.......',
  '....#..#....#...#.......',
  '...##.##...##..##.......',
]

/** The same camel's first rows with someone riding it, and with a load on its back. */
const RIDER: readonly string[] = [
  '..................##....',
  '.........##......#####..',
  '.........##......######.',
  '........####.....####...',
  '........####.....###....',
  '.......#####.....###....',
]

const LOAD: readonly string[] = [
  '..................##....',
  '.................#####..',
  '.................######.',
  '......#######....####...',
  '.....#########...###....',
  '.....#########...###....',
  '.....#########..####....',
]

const CAMEL_RIDER: readonly string[] = [...RIDER, ...CAMEL.slice(RIDER.length)]
const CAMEL_PACK: readonly string[] = [...LOAD, ...CAMEL.slice(LOAD.length)]

/** The caravan's leader, on foot, with a staff. */
const WALKER: readonly string[] = [
  '...##..',
  '...##..',
  '#..##..',
  '#.####.',
  '#######',
  '#.####.',
  '#.####.',
  '#.####.',
  '#..##..',
  '#..##..',
  '#..#.#.',
  '#..#.#.',
]

/**
 * A low black tent on two poles, 36 pixels wide: `e` is its fire-lit edge, `d` and `l` the lamp-lit doorway.
 * Drawn from its outline: two peaks, a dip between them, and skirts running out to the ground.
 */
const TENT: readonly string[] = (() => {
  const width = 36
  const height = 15
  const rows: string[] = []
  for (let row = 0; row < height; row += 1) {
    let line = ''
    let edged = false
    for (let column = 0; column < width; column += 1) {
      const peak = Math.max(1 - Math.abs(column - 10) / 11, 1 - Math.abs(column - 25) / 11)
      const skirt = Math.min(column + 1, width - column) / 4
      const top = height - Math.round(height * Math.max(0, Math.min(1, Math.max(peak, 0.42 * Math.min(1, skirt)))))
      const door = column >= 16 && column <= 19 && row >= height - 6
      if (row < top) line += '.'
      else if (door) line += column === 16 || column === 19 ? 'd' : 'l'
      else if (!edged) line += 'e'
      else line += '#'
      if (row >= top) edged = true
    }
    rows.push(line)
  }
  return rows
})()

const RESTING_CAMEL: readonly string[] = [
  '..##...............',
  '.####..............',
  '#####..............',
  '..###.....###......',
  '..###....#####.....',
  '..####..########...',
  '..################.',
  '.##################',
  '.#################.',
]

/** Someone sitting by the fire; `e` is the side the fire lights. */
const SITTER: readonly string[] = ['.##..', '.##..', '####e', '####e', '####e', '#####']

const FLAMES: readonly string[] = ['..t..', '.tft.', '.fff.', 'ffbff', 'fbbbf', 'lllll']

const TUFT: readonly string[] = ['#..#.#', '.#.##.', '..##..']

/** The caravan crosses the far crest under the moon, heading for the oasis: a leader on foot, then camels roped together, as many as the crest has room for. */
function caravanPixels(canvas: Canvas): void {
  const dark = { '#': SILHOUETTE }
  const long = CAMEL[0]?.length ?? 24
  const first = cells(1276)
  const apart = long + 9
  const count = Math.min(5, Math.floor((COLUMNS - long - 2 - first) / apart) + 1)
  stamp(canvas, WALKER, first - 12, crestRow(0, first - 9) - WALKER.length + 1, dark)
  for (let camel = 0; camel < count; camel += 1) {
    const cx = first + camel * apart
    const top = crestRow(0, cx + long / 2) - CAMEL.length + 1
    stamp(canvas, camel % 2 === 0 ? CAMEL_RIDER : CAMEL_PACK, cx, top, dark, true)
    /** The rope sags from this camel's nose back to the tail of the one ahead. */
    for (let rope = 1; rope < apart - long + 2; rope += 1) {
      put(canvas, cx - rope, top + 3 + Math.round(rope * 0.5 + 2 * Math.sin((rope / (apart - long + 2)) * Math.PI)), SILHOUETTE)
    }
  }
}

/** A date palm: a leaning trunk and a crown of drooping fronds, each with its fringe of leaflets. Its size is in units, so the grain only sharpens it. */
function palmPixels(canvas: Canvas, baseUnitsX: number, baseUnitsY: number, tall: number, leanUnits: number, random: () => number): void {
  const baseX = cells(baseUnitsX)
  const baseY = cells(baseUnitsY)
  const height = cells(tall)
  const lean = cells(leanUnits)
  const thick = Math.max(1, Math.round(FINE))
  let topX = baseX
  let topY = baseY
  for (let step = 0; step <= height; step += 1) {
    const t = step / height
    topX = Math.round(baseX + lean * t * t)
    topY = baseY - step
    for (let wide = 0; wide < (t < 0.75 ? thick + 1 : thick); wide += 1) put(canvas, topX + wide, topY, SILHOUETTE)
  }
  for (const degrees of [-12, 26, 60, 94, 128, 160, 194]) {
    const angle = ((degrees + (random() - 0.5) * 14) * Math.PI) / 180
    const length = (8 + random() * 5) * FINE
    const droop = (5 + random() * 4) * FINE
    const steps = Math.round(30 * FINE)
    for (let step = 0; step <= steps; step += 1) {
      const s = step / steps
      const fx = Math.round(topX + length * s * Math.cos(angle))
      const fy = Math.round(topY - length * s * Math.sin(angle) * (1 - 0.3 * s) + droop * s * s)
      /** Thick at the stem, a single pixel at the tip, with leaflets hanging from every other pixel. */
      const body = s < 0.15 ? 1 : Math.max(1, Math.round(thick * (1.2 - 0.9 * s)))
      for (let deep = 0; deep < body; deep += 1) put(canvas, fx, fy + deep, SILHOUETTE)
      if (s > 0.2 && fx % 2 === 0) {
        for (let deep = 0; deep < thick + 1; deep += 1) put(canvas, fx, fy + body + deep, SILHOUETTE)
      }
    }
  }
  for (let wide = -thick; wide <= thick; wide += 1) put(canvas, topX + wide, topY + thick, SILHOUETTE)
  put(canvas, topX, topY + thick + 1, SILHOUETTE)
}

/** The oasis, in the hollow behind the third dune on the left: a sliver of water that holds the sky, and four palms. */
function oasisPixels(canvas: Canvas): void {
  const random = mulberry(7)
  for (let cy = cells(700); cy <= cells(722); cy += 1) {
    for (let cx = cells(150); cx <= cells(334); cx += 1) {
      const u = (cx * CELL + CELL / 2 - 242) / 88
      const v = (cy * CELL + CELL / 2 - 711) / 7.5
      if (u * u + v * v <= 1) put(canvas, cx, cy, 0.3 > thresholdAt(cx, cy) ? WATER_LIGHT : WATER)
    }
  }
  palmPixels(canvas, 112, 722, 150, -20, random)
  palmPixels(canvas, 172, 717, 190, 25, random)
  palmPixels(canvas, 252, 722, 165, -15, random)
  palmPixels(canvas, 346, 727, 125, 30, random)
  /** The near dune hides their feet. */
  for (const key of [...canvas.keys()]) {
    const cx = (key % 1024) - 64
    const cy = (key - (key % 1024)) / 1024 - 64
    if (cy >= crestRow(2, cx)) canvas.delete(key)
  }
}

/** The camp on the fourth dune, in the lee of its crest: a tent, a camel at rest, two people by a fire, and its smoke going up. */
function campPixels(canvas: Canvas): void {
  const dark = { '#': SILHOUETTE }
  const lit = { '#': SILHOUETTE, e: FIRE_LIT }
  stamp(canvas, TENT, TENT_COLUMN, CAMP_ROW - TENT.length + 1, { '#': SILHOUETTE, e: FIRE_LIT, d: '#5c2f22', l: '#d9743f' })
  stamp(canvas, RESTING_CAMEL, TENT_COLUMN + 41, CAMP_ROW - RESTING_CAMEL.length + 1, dark)
  stamp(canvas, SITTER, FIRE_COLUMN - 8, CAMP_ROW - SITTER.length + 1, lit)
  stamp(canvas, SITTER, FIRE_COLUMN + 8, CAMP_ROW - SITTER.length + 1, lit, true)
  stamp(canvas, FLAMES, FIRE_COLUMN, CAMP_ROW - FLAMES.length + 1, { t: FIRE_TIP, f: FIRE, b: FIRE_BASE, l: '#1c100c' })
  const steps = Math.round(30 * Math.sqrt(FINE))
  for (let step = 1; step <= steps; step += 1) {
    if (step > steps / 3 && step % 2 === 0) continue
    const cx = FIRE_COLUMN + 2 + Math.round(step * 0.3 + 1.8 * Math.sin(step / 3.6))
    put(canvas, cx, CAMP_ROW - FLAMES.length - step, step < steps / 4 ? '#6a5a52' : step < steps / 2 ? '#4b4248' : STAR_DIM)
  }
}

/** Dry grass on the nearest crests. */
function tuftPixels(canvas: Canvas): void {
  const tufts: readonly (readonly [number, number])[] = [
    [5, 150], [5, 560], [5, 1180], [5, 870], [4, 220], [4, 750], [4, 1570], [4, 1010], [3, 120], [3, 910], [3, 660],
  ]
  for (const [index, x] of tufts) stamp(canvas, TUFT, cells(x), crestRow(index, cells(x) + 3) - 3, { '#': SILHOUETTE }, x % 20 === 0)
}

/** Crests that face the moon catch its light: nearly solid for a pixel, thinning out over the few below. Sand-bright on the right, soft on the left. */
function glintPixels(canvas: Canvas): void {
  for (let index = 0; index < DUNES.length - 1; index += 1) {
    const dune = DUNES[index]
    if (dune === undefined) continue
    for (let cx = 0; cx < COLUMNS; cx += 1) {
      const x = cx * CELL + CELL / 2
      const fall = (crestAt(dune.crest, x + 14) - crestAt(dune.crest, x - 14)) / 28
      const facing = smoothstep(-0.02, 0.1, fall)
      const right = smoothstep(1216, 1320, x)
      const left = 0.7 * (1 - smoothstep(150, 380, x))
      const edge = Math.max(right, left)
      if (edge * facing <= 0) continue
      const depth = Math.round(3 * FINE) + 2
      for (let deep = 0; deep < depth; deep += 1) {
        const cy = crestRow(index, cx) + deep
        if (duneAt(cx, cy) !== index) break
        const tone = deep === 0 ? 0.95 : deep === 1 ? 0.6 : 0.42 * Math.pow(1 - (deep - 2) / (depth - 2), 1.5)
        if (tone * edge * facing > thresholdAt(cx, cy)) put(canvas, cx, cy, right > left && deep < 2 ? GLINT : right > left ? INK_STRONG : INK_SOFT)
      }
    }
  }
}

// ----------------------------------------------------------------------------------------------------------------- scene

/** Dunes Lite, nocturne: a still desert night, for a dark window. */
export function nocturneSvg(): string {
  const half = TONES / 2
  const strongLevels = Math.ceil(0.28 * TONES)
  const patterns =
    inkPatterns('a', INK_BLUE, half, false) +
    inkPatterns('b', INK_DUSK, half, true) +
    inkPatterns('e', INK_EMBER, half, false) +
    inkPatterns('d', INK_LEE, half, false) +
    inkPatterns('k', INK_SHADOW, half, true) +
    inkPatterns('s', INK_SOFT, half, false) +
    inkPatterns('t', INK_STRONG, strongLevels, false)

  const sky =
    printed('a', half, blueTone) +
    printed('b', half, duskTone, true) +
    printed('e', half, emberTone) +
    printed('s', half, haloTone) +
    printed('t', strongLevels, haloCoreTone)

  const stars: Canvas = new Map()
  starPixels(stars)
  orionPixels(stars)
  meteorPixels(stars)
  const disc: Canvas = new Map()
  const seas: Canvas = new Map()
  moonPixels(disc, seas)

  const fills = DUNES.map((dune, index) => `<path d="${staircase(cx => crestRow(index, cx))}" fill="${dune.fill}"/>`).join('')
  const land = printed('k', half, shadowTone, true) + printed('d', half, leeTone) + printed('s', half, softTone) + printed('t', strongLevels, strongTone) + printed('e', half, fireTone)

  const shadows: Canvas = new Map()
  shadowPixels(shadows)
  const glints: Canvas = new Map()
  ripplePixels(glints)
  glintPixels(glints)
  const figures: Canvas = new Map()
  caravanPixels(figures)
  oasisPixels(figures)
  campPixels(figures)
  tuftPixels(figures)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"><defs>${patterns}</defs>
<rect width="${WIDTH}" height="${HEIGHT}" fill="${PAPER}"/>
<g transform="scale(${TILE})">${sky}</g>
<g transform="scale(${CELL})">${drawn(stars)}${drawn(disc)}${drawn(seas)}<path d="${staircase(farRangeRow)}" fill="${FAR_RANGE}"/><path d="${staircase(mesaRow)}" fill="${MESA}"/>${fills}${drawn(shadows)}</g>
<g transform="scale(${TILE})">${land}</g>
<g transform="scale(${CELL})">${drawn(glints)}${drawn(figures)}</g>
</svg>`
}
