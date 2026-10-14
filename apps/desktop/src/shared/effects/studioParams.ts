// Studio-IA effect parameters (GPU-free half of the Studio-IA effects; the
// renderer half is `renderer/render/effects/studioEffects.ts`). Merged into
// VISUAL_EFFECT_PARAMS so the inspector, keyframes and the MCP catalog see them.

import type { EffectParamRange } from './params'

const pct = (d = 0): EffectParamRange => ({ default: d, range: [0, 100], step: 1 })
const bipolar = (): EffectParamRange => ({ default: 0, range: [-100, 100], step: 1 })

export const STUDIO_EFFECT_PARAMS: Readonly<Record<string, Readonly<Record<string, EffectParamRange>>>> = {
  blackwhite: { amount: pct(100) },
  sepia: { amount: pct(100) },
  temperature: { amount: bipolar() },
  tint: { amount: bipolar() },
  hue: { amount: { default: 0, range: [-180, 180], step: 1 } },
  fade: { amount: pct(40) },
  tone: { highlights: bipolar(), shadows: bipolar() },
  vignette: { amount: pct(50), softness: pct(50) },
  pixelate: { size: { default: 12, range: [1, 100], step: 1 } },
  rgbsplit: { amount: { default: 6, range: [0, 50], step: 0.5 }, angle: { default: 0, range: [0, 360], step: 1 } },
  mirror: { mode: { default: 0, range: [0, 3], step: 1 } },
  mask: {
    shape: { default: 2, range: [0, 5], step: 1 },
    x: pct(50),
    y: pct(50),
    width: { default: 50, range: [1, 200], step: 1 },
    height: { default: 50, range: [1, 200], step: 1 },
    rotation: { default: 0, range: [-180, 180], step: 1 },
    feather: pct(10),
    invert: { default: 0, range: [0, 1], step: 1 },
    round: pct(0),
  },
  glow: { amount: pct(40), radius: pct(30), threshold: pct(60) },
  grain: { amount: pct(30), size: { default: 1.5, range: [0.5, 5], step: 0.1 } },
  splittone: {
    shadow_hue: { default: 190, range: [0, 360], step: 1 },
    highlight_hue: { default: 35, range: [0, 360], step: 1 },
    amount: pct(40),
    balance: bipolar(),
  },
  filmcurve: { amount: pct(40) },
  rotate3d: {
    rot_x: { default: 0, range: [-80, 80], step: 1 },
    rot_y: { default: 25, range: [-80, 80], step: 1 },
    distance: { default: 200, range: [50, 500], step: 5 },
  },
}
