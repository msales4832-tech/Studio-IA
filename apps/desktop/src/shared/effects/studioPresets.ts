// Studio-IA "efeitos prontos": receitas que empilham efeitos do catálogo com
// valores escolhidos à mão. GPU-free (o main aplica, o MCP anuncia, o
// renderer desenha as miniaturas). Aplicar um preset é UM passo de desfazer
// (op `add_effect_preset`) e cada efeito continua editável depois.
//
// Regra de qualidade: preferir ajustes que não cortam (curva S, split toning,
// brilho em luz linear) aos lineares que estouram (contraste, brilho).

export type PresetCategory = 'cinema' | 'retro' | 'mood' | 'style'

export interface PresetEffect {
  kind: string
  params: Readonly<Record<string, number>>
}

export interface EffectPreset {
  id: string
  category: PresetCategory
  effects: readonly PresetEffect[]
}

export const PRESET_CATEGORY_ORDER: readonly PresetCategory[] = ['cinema', 'retro', 'mood', 'style']

export const EFFECT_PRESETS: readonly EffectPreset[] = [
  { id: 'cine_teal_orange', category: 'cinema', effects: [
    { kind: 'splittone', params: { shadow_hue: 190, highlight_hue: 30, amount: 55, balance: 0 } },
    { kind: 'filmcurve', params: { amount: 35 } },
    { kind: 'saturation', params: { amount: -8 } },
  ] },
  { id: 'cine_noir', category: 'cinema', effects: [
    { kind: 'blackwhite', params: { amount: 100 } },
    { kind: 'filmcurve', params: { amount: 70 } },
    { kind: 'grain', params: { amount: 35, size: 1.4 } },
    { kind: 'vignette', params: { amount: 45, softness: 60 } },
  ] },
  { id: 'cine_golden', category: 'cinema', effects: [
    { kind: 'temperature', params: { amount: 30 } },
    { kind: 'splittone', params: { shadow_hue: 220, highlight_hue: 40, amount: 30, balance: 0 } },
    { kind: 'glow', params: { amount: 35, radius: 35, threshold: 75 } },
    { kind: 'filmcurve', params: { amount: 20 } },
  ] },
  { id: 'cine_bleach', category: 'cinema', effects: [
    { kind: 'saturation', params: { amount: -45 } },
    { kind: 'filmcurve', params: { amount: 65 } },
    { kind: 'fade', params: { amount: 10 } },
  ] },
  { id: 'retro_film', category: 'retro', effects: [
    { kind: 'sepia', params: { amount: 35 } },
    { kind: 'fade', params: { amount: 30 } },
    { kind: 'grain', params: { amount: 45, size: 2 } },
    { kind: 'vignette', params: { amount: 50, softness: 70 } },
  ] },
  { id: 'retro_70s', category: 'retro', effects: [
    { kind: 'fade', params: { amount: 35 } },
    { kind: 'splittone', params: { shadow_hue: 160, highlight_hue: 45, amount: 45, balance: 10 } },
    { kind: 'saturation', params: { amount: -10 } },
    { kind: 'grain', params: { amount: 25, size: 1.6 } },
  ] },
  { id: 'retro_vhs', category: 'retro', effects: [
    { kind: 'rgbsplit', params: { amount: 3, angle: 0 } },
    { kind: 'saturation', params: { amount: 15 } },
    { kind: 'fade', params: { amount: 15 } },
    { kind: 'grain', params: { amount: 40, size: 2.5 } },
  ] },
  { id: 'mood_dream', category: 'mood', effects: [
    { kind: 'glow', params: { amount: 55, radius: 45, threshold: 70 } },
    { kind: 'fade', params: { amount: 20 } },
    { kind: 'temperature', params: { amount: 10 } },
  ] },
  { id: 'mood_summer', category: 'mood', effects: [
    { kind: 'temperature', params: { amount: 28 } },
    { kind: 'saturation', params: { amount: 20 } },
    { kind: 'glow', params: { amount: 30, radius: 30, threshold: 78 } },
  ] },
  { id: 'mood_cold', category: 'mood', effects: [
    { kind: 'temperature', params: { amount: -35 } },
    { kind: 'saturation', params: { amount: -15 } },
    { kind: 'fade', params: { amount: 15 } },
    { kind: 'filmcurve', params: { amount: 20 } },
  ] },
  { id: 'style_neon', category: 'style', effects: [
    { kind: 'glow', params: { amount: 80, radius: 35, threshold: 62 } },
    { kind: 'saturation', params: { amount: 35 } },
    { kind: 'filmcurve', params: { amount: 30 } },
  ] },
  { id: 'style_vignette', category: 'style', effects: [
    { kind: 'vignette', params: { amount: 60, softness: 55 } },
    { kind: 'filmcurve', params: { amount: 25 } },
  ] },
  { id: 'style_mosaic', category: 'style', effects: [
    { kind: 'pixelate', params: { size: 18 } },
  ] },
  { id: 'style_mirror', category: 'style', effects: [
    { kind: 'mirror', params: { mode: 0 } },
  ] },
]

export const EFFECT_PRESET_IDS: readonly string[] = EFFECT_PRESETS.map((p) => p.id)

export function getEffectPreset(id: string): EffectPreset | null {
  return EFFECT_PRESETS.find((p) => p.id === id) ?? null
}
