import { describe, expect, it } from 'vitest'
import { EFFECT_PRESETS, PRESET_CATEGORY_ORDER, getEffectPreset } from './studioPresets'
import { VISUAL_EFFECT_PARAMS } from './params'

describe('efeitos prontos', () => {
  it('só usam efeitos e parâmetros do catálogo, dentro da faixa', () => {
    for (const preset of EFFECT_PRESETS) {
      expect(preset.effects.length).toBeGreaterThan(0)
      expect(PRESET_CATEGORY_ORDER).toContain(preset.category)
      for (const e of preset.effects) {
        const specs = VISUAL_EFFECT_PARAMS[e.kind]
        expect(specs, `${preset.id}: ${e.kind}`).toBeDefined()
        for (const [k, v] of Object.entries(e.params)) {
          const spec = specs![k]
          expect(spec, `${preset.id}: ${e.kind}.${k}`).toBeDefined()
          expect(v).toBeGreaterThanOrEqual(spec!.range[0])
          expect(v).toBeLessThanOrEqual(spec!.range[1])
        }
      }
    }
  })

  it('ids são únicos e encontráveis', () => {
    const ids = EFFECT_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(getEffectPreset('cine_noir')?.category).toBe('cinema')
    expect(getEffectPreset('nao_existe')).toBeNull()
  })
})
