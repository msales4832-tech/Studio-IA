// Studio-IA shader effects — CapCut's adjust/effect/mask set recreated from
// scratch. Uniform values are the slider values; the bodies do the scaling.

import type { ShaderEffectSpec } from "./shaderEffect";

export const VIGNETTE: ShaderEffectSpec = {
  name: "vignette",
  uniforms: { uAmount: 0, uSoftness: 50 },
  glsl: `
vec4 effect(vec2 uv, vec2 n) {
  vec4 c = tex(uv);
  float a = clamp(uAmount * 0.01, 0.0, 1.0);
  vec2 d = (n - 0.5) * vec2(aspect(), 1.0) / max(aspect(), 1.0);
  float r = length(d) * 1.4142;
  float soft = mix(0.05, 0.9, clamp(uSoftness * 0.01, 0.0, 1.0));
  float v = 1.0 - a * smoothstep(1.0 - soft, 1.0, r);
  return vec4(c.rgb * v, c.a);
}`,
  wgsl: `
fn effect(uv: vec2<f32>, n: vec2<f32>) -> vec4<f32> {
  let c = tex(uv);
  let a = clamp(fx.uAmount * 0.01, 0.0, 1.0);
  let d = (n - vec2<f32>(0.5)) * vec2<f32>(aspect(), 1.0) / max(aspect(), 1.0);
  let r = length(d) * 1.4142;
  let soft = mix(0.05, 0.9, clamp(fx.uSoftness * 0.01, 0.0, 1.0));
  let v = 1.0 - a * smoothstep(1.0 - soft, 1.0, r);
  return vec4<f32>(c.rgb * v, c.a);
}`,
};

export const PIXELATE: ShaderEffectSpec = {
  name: "pixelate",
  uniforms: { uSize: 1 },
  glsl: `
vec4 effect(vec2 uv, vec2 n) {
  float s = max(uSize, 1.0);
  vec2 px = uv / uInputSize.zw;
  vec2 q = (floor(px / s) + 0.5) * s;
  return tex(q * uInputSize.zw);
}`,
  wgsl: `
fn effect(uv: vec2<f32>, n: vec2<f32>) -> vec4<f32> {
  let s = max(fx.uSize, 1.0);
  let px = uv / gfu.uInputSize.zw;
  let q = (floor(px / s) + vec2<f32>(0.5)) * s;
  return tex(q * gfu.uInputSize.zw);
}`,
};

export const RGB_SPLIT: ShaderEffectSpec = {
  name: "rgbsplit",
  uniforms: { uAmount: 0, uAngle: 0 },
  glsl: `
vec4 effect(vec2 uv, vec2 n) {
  float ang = radians(uAngle);
  vec2 off = vec2(cos(ang), sin(ang)) * uAmount * uInputSize.zw;
  vec4 c = tex(uv);
  vec4 r = tex(uv + off);
  vec4 b = tex(uv - off);
  return vec4(r.r, c.g, b.b, max(c.a, max(r.a, b.a)));
}`,
  wgsl: `
fn effect(uv: vec2<f32>, n: vec2<f32>) -> vec4<f32> {
  let ang = radians(fx.uAngle);
  let off = vec2<f32>(cos(ang), sin(ang)) * fx.uAmount * gfu.uInputSize.zw;
  let c = tex(uv);
  let r = tex(uv + off);
  let b = tex(uv - off);
  return vec4<f32>(r.r, c.g, b.b, max(c.a, max(r.a, b.a)));
}`,
};

// uMode: 0 esquerda→direita, 1 direita→esquerda, 2 cima→baixo, 3 baixo→cima.
export const MIRROR: ShaderEffectSpec = {
  name: "mirror",
  uniforms: { uMode: 0 },
  glsl: `
vec4 effect(vec2 uv, vec2 n) {
  int m = int(uMode + 0.5);
  vec2 p = n;
  if (m == 0 && p.x > 0.5) p.x = 1.0 - p.x;
  if (m == 1 && p.x < 0.5) p.x = 1.0 - p.x;
  if (m == 2 && p.y > 0.5) p.y = 1.0 - p.y;
  if (m == 3 && p.y < 0.5) p.y = 1.0 - p.y;
  return tex(toUv(p));
}`,
  wgsl: `
fn effect(uv: vec2<f32>, n: vec2<f32>) -> vec4<f32> {
  let m = i32(fx.uMode + 0.5);
  var p = n;
  if (m == 0 && p.x > 0.5) { p.x = 1.0 - p.x; }
  if (m == 1 && p.x < 0.5) { p.x = 1.0 - p.x; }
  if (m == 2 && p.y > 0.5) { p.y = 1.0 - p.y; }
  if (m == 3 && p.y < 0.5) { p.y = 1.0 - p.y; }
  return tex(toUv(p));
}`,
};

export const TONE: ShaderEffectSpec = {
  name: "tone",
  uniforms: { uHighlights: 0, uShadows: 0 },
  glsl: `
vec4 effect(vec2 uv, vec2 n) {
  vec4 c = tex(uv);
  if (c.a < 0.0001) return c;
  vec3 s = c.rgb / c.a;
  float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
  float sh = 1.0 - smoothstep(0.0, 0.55, l);
  float hi = smoothstep(0.45, 1.0, l);
  s += vec3(uShadows * 0.004 * sh + uHighlights * 0.004 * hi);
  return vec4(clamp(s, 0.0, 1.0) * c.a, c.a);
}`,
  wgsl: `
fn effect(uv: vec2<f32>, n: vec2<f32>) -> vec4<f32> {
  let c = tex(uv);
  if (c.a < 0.0001) { return c; }
  var s = c.rgb / c.a;
  let l = dot(s, vec3<f32>(0.2126, 0.7152, 0.0722));
  let sh = 1.0 - smoothstep(0.0, 0.55, l);
  let hi = smoothstep(0.45, 1.0, l);
  s = s + vec3<f32>(fx.uShadows * 0.004 * sh + fx.uHighlights * 0.004 * hi);
  return vec4<f32>(clamp(s, vec3<f32>(0.0), vec3<f32>(1.0)) * c.a, c.a);
}`,
};

// uShape: 0 linear, 1 faixa (espelho), 2 círculo, 3 retângulo.
// Posição e tamanho em % da camada; o cálculo corrige a proporção, então o
// círculo é redondo numa camada 16:9.
export const MASK: ShaderEffectSpec = {
  name: "mask",
  uniforms: { uShape: 2, uX: 50, uY: 50, uWidth: 50, uHeight: 50, uRotation: 0, uFeather: 10, uInvert: 0 },
  glsl: `
vec4 effect(vec2 uv, vec2 n) {
  vec4 c = tex(uv);
  vec2 asp = vec2(aspect(), 1.0);
  vec2 p = (n - vec2(uX, uY) * 0.01) * asp;
  float r = radians(-uRotation);
  p = vec2(cos(r) * p.x - sin(r) * p.y, sin(r) * p.x + cos(r) * p.y);
  vec2 half_ = vec2(uWidth * aspect(), uHeight) * 0.005;
  float f = max(uFeather * 0.003, 0.0005);
  int shape = int(uShape + 0.5);
  float m;
  if (shape == 0) m = smoothstep(-f, f, -p.y);
  else if (shape == 1) m = 1.0 - smoothstep(-f, f, abs(p.y) - half_.y);
  else if (shape == 2) m = 1.0 - smoothstep(-f, f, (length(p / max(half_, vec2(0.0005))) - 1.0) * min(half_.x, half_.y));
  else { vec2 q = abs(p) - half_; m = 1.0 - smoothstep(-f, f, max(q.x, q.y)); }
  if (uInvert > 0.5) m = 1.0 - m;
  return c * m;
}`,
  wgsl: `
fn effect(uv: vec2<f32>, n: vec2<f32>) -> vec4<f32> {
  let c = tex(uv);
  let asp = vec2<f32>(aspect(), 1.0);
  var p = (n - vec2<f32>(fx.uX, fx.uY) * 0.01) * asp;
  let r = radians(-fx.uRotation);
  p = vec2<f32>(cos(r) * p.x - sin(r) * p.y, sin(r) * p.x + cos(r) * p.y);
  let half_ = vec2<f32>(fx.uWidth * aspect(), fx.uHeight) * 0.005;
  let f = max(fx.uFeather * 0.003, 0.0005);
  let shape = i32(fx.uShape + 0.5);
  var m: f32;
  if (shape == 0) {
    m = smoothstep(-f, f, -p.y);
  } else if (shape == 1) {
    m = 1.0 - smoothstep(-f, f, abs(p.y) - half_.y);
  } else if (shape == 2) {
    m = 1.0 - smoothstep(-f, f, (length(p / max(half_, vec2<f32>(0.0005))) - 1.0) * min(half_.x, half_.y));
  } else {
    let q = abs(p) - half_;
    m = 1.0 - smoothstep(-f, f, max(q.x, q.y));
  }
  if (fx.uInvert > 0.5) { m = 1.0 - m; }
  return c * m;
}`,
};

// Gira a camada como um cartão no espaço 3D (perspectiva), em graus.
export const ROTATE_3D: ShaderEffectSpec = {
  name: "rotate3d",
  uniforms: { uRotX: 0, uRotY: 0, uDistance: 200 },
  glsl: `
vec4 effect(vec2 uv, vec2 n) {
  float a = aspect();
  vec3 s = vec3((n.x - 0.5) * 2.0 * a, (n.y - 0.5) * 2.0, 0.0);
  vec3 cam = vec3(0.0, 0.0, max(uDistance, 20.0) * 0.02 * max(a, 1.0));
  vec3 dir = s - cam;
  float rx = radians(uRotX), ry = radians(uRotY);
  vec3 ax = vec3(cos(ry), 0.0, -sin(ry));
  vec3 ay = vec3(sin(rx) * sin(ry), cos(rx), sin(rx) * cos(ry));
  vec3 nz = cross(ax, ay);
  float den = dot(dir, nz);
  if (abs(den) < 1e-5) return vec4(0.0);
  float t = -dot(cam, nz) / den;
  if (t <= 0.0) return vec4(0.0);
  vec3 hit = cam + t * dir;
  vec2 local = vec2(dot(hit, ax) / (2.0 * a) + 0.5, dot(hit, ay) / 2.0 + 0.5);
  if (!inside(local)) return vec4(0.0);
  return tex(toUv(local));
}`,
  wgsl: `
fn effect(uv: vec2<f32>, n: vec2<f32>) -> vec4<f32> {
  let a = aspect();
  let s = vec3<f32>((n.x - 0.5) * 2.0 * a, (n.y - 0.5) * 2.0, 0.0);
  let cam = vec3<f32>(0.0, 0.0, max(fx.uDistance, 20.0) * 0.02 * max(a, 1.0));
  let dir = s - cam;
  let rx = radians(fx.uRotX);
  let ry = radians(fx.uRotY);
  let ax = vec3<f32>(cos(ry), 0.0, -sin(ry));
  let ay = vec3<f32>(sin(rx) * sin(ry), cos(rx), sin(rx) * cos(ry));
  let nz = cross(ax, ay);
  let den = dot(dir, nz);
  if (abs(den) < 1e-5) { return vec4<f32>(0.0); }
  let t = -dot(cam, nz) / den;
  if (t <= 0.0) { return vec4<f32>(0.0); }
  let hit = cam + t * dir;
  let local = vec2<f32>(dot(hit, ax) / (2.0 * a) + 0.5, dot(hit, ay) / 2.0 + 0.5);
  if (!inside(local)) { return vec4<f32>(0.0); }
  return tex(toUv(local));
}`,
};

export const STUDIO_SHADERS = { VIGNETTE, PIXELATE, RGB_SPLIT, MIRROR, TONE, MASK, ROTATE_3D };
