// Studio-IA: one Filter class per declarative shader spec, so a new effect is
// its uniforms plus an `effect(uv, n)` body in GLSL and WGSL — the same
// program layout SharpenFilter writes out by hand. `uv` is the input texture
// coordinate, `n` the layer-normalized position (0..1 across the layer).
// Bodies receive and must return PREMULTIPLIED color.

import { defaultFilterVert, Filter, GlProgram, GpuProgram, UniformGroup } from "pixi.js";
import { pinUniformBuffer, releaseUniformBuffer } from "./uniformBufferResidency";

export interface ShaderEffectSpec {
  name: string;
  /** Uniform name → default. Order is the WGSL struct order. */
  uniforms: Readonly<Record<string, number>>;
  /** Defines `vec4 effect(vec2 uv, vec2 n)`. */
  glsl: string;
  /** Defines `fn effect(uv: vec2<f32>, n: vec2<f32>) -> vec4<f32>`. */
  wgsl: string;
}

const GL_HEADER = `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uInputClamp;
uniform highp vec4 uOutputFrame;
vec4 tex(vec2 uv) { return textureLod(uTexture, clamp(uv, uInputClamp.xy, uInputClamp.zw), 0.0); }
vec2 toUv(vec2 n) { return n * uOutputFrame.zw * uInputSize.zw; }
bool inside(vec2 n) { return n.x >= 0.0 && n.y >= 0.0 && n.x <= 1.0 && n.y <= 1.0; }
float aspect() { return uOutputFrame.z / max(uOutputFrame.w, 1.0); }
`;

const WGSL_HEADER = `
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>,
  uInputPixel: vec4<f32>,
  uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>,
  uGlobalFrame: vec4<f32>,
  uOutputTexture: vec4<f32>,
};
@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};
fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32> {
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
  return vec4<f32>(position, 0.0, 1.0);
}
fn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32> {
  return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}
@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
  return VSOutput(filterVertexPosition(aPosition), filterTextureCoord(aPosition));
}
fn tex(uv: vec2<f32>) -> vec4<f32> {
  return textureSampleLevel(uTexture, uSampler, clamp(uv, gfu.uInputClamp.xy, gfu.uInputClamp.zw), 0.0);
}
fn toUv(n: vec2<f32>) -> vec2<f32> { return n * gfu.uOutputFrame.zw * gfu.uInputSize.zw; }
fn inside(n: vec2<f32>) -> bool { return n.x >= 0.0 && n.y >= 0.0 && n.x <= 1.0 && n.y <= 1.0; }
fn aspect() -> f32 { return gfu.uOutputFrame.z / max(gfu.uOutputFrame.w, 1.0); }
`;

export function glslSource(spec: ShaderEffectSpec): string {
  const decls = Object.keys(spec.uniforms).map((u) => `uniform float ${u};`).join("\n");
  return `${GL_HEADER}${decls}
${spec.glsl}
void main() {
  vec2 n = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
  finalColor = effect(vTextureCoord, n);
}
`;
}

export function wgslSource(spec: ShaderEffectSpec): string {
  const fields = Object.keys(spec.uniforms).map((u) => `  ${u}: f32,`).join("\n");
  return `${WGSL_HEADER}
struct FxUniforms {
${fields}
};
@group(1) @binding(0) var<uniform> fx: FxUniforms;
${spec.wgsl}
@fragment
fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let n = uv * gfu.uInputSize.xy / gfu.uOutputFrame.zw;
  return effect(uv, n);
}
`;
}

export class ShaderEffectFilter extends Filter {
  private readonly fx: UniformGroup;

  constructor(readonly spec: ShaderEffectSpec) {
    const fx = new UniformGroup(
      Object.fromEntries(Object.entries(spec.uniforms).map(([k, v]) => [k, { value: v, type: "f32" as const }])),
    );
    super({
      gpuProgram: GpuProgram.from({
        vertex: { source: wgslSource(spec), entryPoint: "mainVertex" },
        fragment: { source: wgslSource(spec), entryPoint: "mainFragment" },
      }),
      glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: glslSource(spec), name: `studio-${spec.name}` }),
      resources: { fx },
    });
    this.fx = fx;
  }

  override apply(...args: Parameters<Filter["apply"]>): void {
    super.apply(...args);
    pinUniformBuffer(this.fx);
  }

  override destroy(destroyPrograms = false): void {
    releaseUniformBuffer(this.fx);
    super.destroy(destroyPrograms);
  }

  applyParam(uniform: string, value: number): void {
    (this.fx.uniforms as Record<string, number>)[uniform] = value;
  }
}
