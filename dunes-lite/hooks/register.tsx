import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { dunesDaySvg, dunesNightSvg } from './dunes'
import { makeColors } from './make-colors.js'
import { nocturneSvg } from './nocturne'

const PLUGIN = 'dunes-lite'
const COMMAND = 'dunes-lite'

/** night: the desert nocturne. classic: the first still night, umber paper and an ember sun. day: the same on sand paper. */
type Variant = 'night' | 'classic' | 'day'
type Choice = Variant | 'off'

/**
 * The app's own colors for the nocturne, tinted toward it: warm near-black surfaces, moonlit sand for words, the night's blue for the accent.
 * Code takes its colors from the roles: keywords the sky, strings the oasis, literals the dusk, names the fire, variables the sand.
 */
const { theme: NOCTURNE_COLORS, problems: COLOR_PROBLEMS } = makeColors({
  label: 'Desert Nocturne',
  only: 'dark',
  roles: { accent: '#8f9cf0', danger: '#e2604f', success: '#8fb573', warning: '#e0b064', pro: '#c08fd6' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#17151a',
        'surface-1': '#1e1b20',
        'surface-2': '#252127',
        'surface-3': '#272329',
        'text-primary': '#efe7d8',
        'text-secondary': '#cdc3b4',
        'text-muted': '#a69d92',
      },
    },
  },
})

const SCENES: Record<Variant, string> = {
  night: 'dunes-lite-nocturne',
  classic: 'dunes-lite-night',
  day: 'dunes-lite-day',
}

/**
 * No blur: the frosted glass is what made the original costly, since every panel re-blurs whatever moves behind it.
 * A flat tint at a little more opacity keeps the panels readable instead.
 */
const LOOKS: Record<Variant, ThemeSetArgs> = {
  night: {
    backdrop: { scene: SCENES.night, glass: { blur: 0, tint: '#17151a', opacity: 0.55 } },
    overrideColorScheme: 'dark',
    colors: NOCTURNE_COLORS,
  },
  classic: {
    backdrop: { scene: SCENES.classic, glass: { blur: 0, tint: '#1c1712', opacity: 0.55 } },
    overrideColorScheme: 'dark',
  },
  day: {
    backdrop: { scene: SCENES.day, glass: { blur: 0, tint: '#f1e8d6', opacity: 0.55 } },
    overrideColorScheme: 'light',
  },
}

const DRAWINGS: Record<string, { readonly alt: string; readonly draw: () => string }> = {
  [SCENES.night]: {
    alt: 'A still dithered desert night: a ringed moon over a caravan on the far dune, the Milky Way, an oasis and a camp fire',
    draw: nocturneSvg,
  },
  [SCENES.classic]: { alt: 'Still dithered dunes on umber paper under an ember sun', draw: dunesNightSvg },
  [SCENES.day]: { alt: 'Still dithered dunes on sand paper under a terracotta sun', draw: dunesDaySvg },
}

const USAGE = 'Use /dunes-lite night, /dunes-lite classic, /dunes-lite day or /dunes-lite off.'

// Built once per scene: the picture never changes, so there is nothing to redo.
const built = new Map<string, string>()
function sceneSource(scene: string): string | undefined {
  let source = built.get(scene)
  if (source === undefined) {
    source = DRAWINGS[scene]?.draw()
    if (source !== undefined) built.set(scene, source)
  }
  return source
}

function isChoice(word: unknown): word is Choice {
  return word === 'night' || word === 'classic' || word === 'day' || word === 'off'
}

async function choiceOf($: EngineInterface): Promise<Choice> {
  const saved = await $.store.get('choice')
  return isChoice(saved) ? saved : 'night'
}

/** Sets or clears the look; says whether a window draws it. */
async function apply($: EngineInterface, choice: Choice): Promise<boolean> {
  if (choice === 'off') {
    await $.theme.clear()
    return true
  }
  const set = await $.theme.set(LOOKS[choice])
  return set.isDrawn
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // The look goes first, so it lands the moment the session is up; the command can follow.
    const choice = await choiceOf($)
    if (choice !== 'off') await apply($, choice)
    // Warm the picture now, so the first Backdrop render has nothing to build.
    if (choice !== 'off') sceneSource(SCENES[choice])
    await $.command.register({
      name: COMMAND,
      description: 'Still dither dunes backdrop: /dunes-lite night, classic, day or off',
    })

    // The one line that would stop the app painting the nocturne's colors, should a later build move its bar.
    const unpainted = COLOR_PROBLEMS.find(line => line.startsWith("Desktop won't paint"))
    if (choice === 'night' && unpainted !== undefined) $.ui.toast(unpainted)

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const word = e.args.trim().toLowerCase()
    if (word !== '' && !isChoice(word)) return { text: USAGE }
    const choice: Choice = word === '' ? 'night' : word
    await $.store.set('choice', choice)
    const isDrawn = await apply($, choice)
    if (choice === 'off') return { text: 'Dunes Lite is off. /dunes-lite brings it back.' }

    return {
      text: isDrawn
        ? `Dunes Lite (${choice}) is on: a still picture, no blur.`
        : `Dunes Lite (${choice}) is set, but this window may not draw backdrops.`,
    }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.props.plugin !== PLUGIN || (e.surface !== 'desktop' && e.surface !== 'mobile')) return next(e)
    const drawing = DRAWINGS[e.props.scene]
    const source = sceneSource(e.props.scene)
    if (drawing === undefined || source === undefined) return next(e)

    const { Svg } = $.ui.resolve(e)

    // Not interactive: drawn as a plain image, the cheapest way for the app to paint it.
    return <Svg source={source} alt={drawing.alt} />
  })
}
