// Studio-IA effect descriptors, merged into the realtime REGISTRY
// (effectRegistry.ts). Parameter ranges live in shared/effects/studioParams.ts.

import { ColorMatrixFilter, type Filter } from "pixi.js";
import { STUDIO_EFFECT_PARAMS } from "../../../shared/effects/studioParams";
import type { EffectCategory, EffectDescriptor } from "./effectRegistry";
import { ShaderEffectFilter, type ShaderEffectSpec } from "./filters/shaderEffect";
import {
  FILM_CURVE, GLOW, GRAIN, MASK, MIRROR, PIXELATE, RGB_SPLIT, ROTATE_3D, SPLIT_TONE, TONE, VIGNETTE,
} from "./filters/studioShaders";
import {
  writeBlackWhite,
  writeFade,
  writeHue,
  writeSepia,
  writeTemperature,
  writeTint,
} from "./filters/studioColorMatrices";

function matrixEffect(kind: string, write: (out: number[], amount: number) => void): EffectDescriptor {
  return {
    kind,
    nameI18nKey: `effects.${kind}.name`,
    category: "color",
    create: () => {
      const f = new ColorMatrixFilter();
      write(f.matrix, STUDIO_EFFECT_PARAMS[kind]!.amount!.default);
      return f;
    },
    params: {
      amount: {
        ...STUDIO_EFFECT_PARAMS[kind]!.amount!,
        apply: (f, v) => write((f as ColorMatrixFilter).matrix, v),
      },
    },
    fidelity: "f16-verified",
    colorspace: "display-gamma",
  };
}

/** `paramToUniform` maps a stored param key to the shader uniform it drives. */
function shaderEffect(
  kind: string,
  category: EffectCategory,
  spec: ShaderEffectSpec,
  paramToUniform: Record<string, string>,
): EffectDescriptor {
  const ranges = STUDIO_EFFECT_PARAMS[kind]!;
  return {
    kind,
    nameI18nKey: `effects.${kind}.name`,
    category,
    create: () => {
      const f = new ShaderEffectFilter(spec);
      for (const [param, uniform] of Object.entries(paramToUniform)) f.applyParam(uniform, ranges[param]!.default);
      return f;
    },
    params: Object.fromEntries(
      Object.entries(paramToUniform).map(([param, uniform]) => [param, {
        ...ranges[param]!,
        apply: (f: Filter, v: number) => (f as ShaderEffectFilter).applyParam(uniform, v),
      }]),
    ),
    fidelity: "f16-verified",
    colorspace: "display-gamma",
  };
}

export const STUDIO_EFFECTS: Record<string, EffectDescriptor> = {
  blackwhite: matrixEffect("blackwhite", writeBlackWhite),
  sepia: matrixEffect("sepia", writeSepia),
  temperature: matrixEffect("temperature", writeTemperature),
  tint: matrixEffect("tint", writeTint),
  hue: matrixEffect("hue", writeHue),
  fade: matrixEffect("fade", writeFade),
  tone: shaderEffect("tone", "color", TONE, { highlights: "uHighlights", shadows: "uShadows" }),
  vignette: shaderEffect("vignette", "stylize", VIGNETTE, { amount: "uAmount", softness: "uSoftness" }),
  pixelate: shaderEffect("pixelate", "stylize", PIXELATE, { size: "uSize" }),
  rgbsplit: shaderEffect("rgbsplit", "stylize", RGB_SPLIT, { amount: "uAmount", angle: "uAngle" }),
  mirror: shaderEffect("mirror", "stylize", MIRROR, { mode: "uMode" }),
  mask: shaderEffect("mask", "mask", MASK, {
    shape: "uShape", x: "uX", y: "uY", width: "uWidth", height: "uHeight",
    rotation: "uRotation", feather: "uFeather", invert: "uInvert", round: "uRound",
  }),
  glow: shaderEffect("glow", "stylize", GLOW, { amount: "uAmount", radius: "uRadius", threshold: "uThreshold" }),
  grain: {
    ...shaderEffect("grain", "stylize", GRAIN, { amount: "uAmount", size: "uSize" }),
    // O granulado muda com o tempo do clipe (24 renovações por segundo).
    tick: (f, tInLayerUs) => (f as ShaderEffectFilter).applyParam("uTime", tInLayerUs / 1_000_000),
  },
  splittone: shaderEffect("splittone", "color", SPLIT_TONE, {
    shadow_hue: "uShadowHue", highlight_hue: "uHighlightHue", amount: "uAmount", balance: "uBalance",
  }),
  filmcurve: shaderEffect("filmcurve", "color", FILM_CURVE, { amount: "uAmount" }),
  rotate3d: shaderEffect("rotate3d", "3d", ROTATE_3D, { rot_x: "uRotX", rot_y: "uRotY", distance: "uDistance" }),
};
