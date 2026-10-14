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

// uShape: 0 linear, 1 faixa (espelho), 2 círculo, 3 retângulo, 4 estrela,
// 5 coração. Posição e tamanho em % da camada; o cálculo corrige a proporção,
// então o círculo é redondo numa camada 16:9. Cada forma vira uma DISTÂNCIA
// com sinal até a borda (negativa dentro), e a borda suave é uma rampa sobre
// essa distância — a mesma largura de suavização em qualquer forma.
// uRound arredonda os cantos do retângulo (% do menor lado).
export const MASK: ShaderEffectSpec = {
  name: "mask",
  uniforms: { uShape: 2, uX: 50, uY: 50, uWidth: 50, uHeight: 50, uRotation: 0, uFeather: 10, uInvert: 0, uRound: 0 },
  glsl: `
float starDist(vec2 ps) {
  float sector = 1.2566371;
  float ang = atan(ps.x, -ps.y);
  float a = ang + sector * 0.5;
  a = a - sector * floor(a / sector) - sector * 0.5;
  vec2 q = length(ps) * vec2(cos(a), abs(sin(a)));
  vec2 v1 = vec2(1.0, 0.0);
  vec2 v2 = 0.45 * vec2(cos(0.6283185), sin(0.6283185));
  vec2 e = v2 - v1;
  vec2 w = q - v1;
  float t = clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
  float dd = length(w - e * t);
  return (e.x * w.y - e.y * w.x) > 0.0 ? -dd : dd;
}
float heartDist(vec2 ps) {
  float x = ps.x * 1.15;
  float y = -ps.y * 1.15 + 0.1;
  float r = x * x + y * y - 1.0;
  float F = r * r * r - x * x * y * y * y;
  vec2 g = vec2(6.0 * x * r * r - 2.0 * x * y * y * y, 6.0 * y * r * r - 3.0 * x * x * y * y);
  return F / max(length(g), 0.001) / 1.15;
}
vec4 effect(vec2 uv, vec2 n) {
  vec4 c = tex(uv);
  vec2 asp = vec2(aspect(), 1.0);
  vec2 p = (n - vec2(uX, uY) * 0.01) * asp;
  float r = radians(-uRotation);
  p = vec2(cos(r) * p.x - sin(r) * p.y, sin(r) * p.x + cos(r) * p.y);
  vec2 half_ = max(vec2(uWidth * aspect(), uHeight) * 0.005, vec2(0.0005));
  float sz = min(half_.x, half_.y);
  float f = max(uFeather * 0.003, 0.0005);
  int shape = int(uShape + 0.5);
  float d;
  if (shape == 0) d = p.y;
  else if (shape == 1) d = abs(p.y) - half_.y;
  else if (shape == 2) d = (length(p / half_) - 1.0) * sz;
  else if (shape == 3) {
    float rr = clamp(uRound * 0.01, 0.0, 1.0) * sz;
    vec2 q = abs(p) - half_ + rr;
    d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rr;
  }
  else if (shape == 4) d = starDist(p / half_) * sz;
  else d = heartDist(p / half_) * sz;
  float m = 1.0 - smoothstep(-f, f, d);
  if (uInvert > 0.5) m = 1.0 - m;
  return c * m;
}`,
  wgsl: `
fn starDist(ps: vec2<f32>) -> f32 {
  let sector = 1.2566371;
  let ang = atan2(ps.x, -ps.y);
  var a = ang + sector * 0.5;
  a = a - sector * floor(a / sector) - sector * 0.5;
  let q = length(ps) * vec2<f32>(cos(a), abs(sin(a)));
  let v1 = vec2<f32>(1.0, 0.0);
  let v2 = 0.45 * vec2<f32>(cos(0.6283185), sin(0.6283185));
  let e = v2 - v1;
  let w = q - v1;
  let t = clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
  let dd = length(w - e * t);
  return select(dd, -dd, (e.x * w.y - e.y * w.x) > 0.0);
}
fn heartDist(ps: vec2<f32>) -> f32 {
  let x = ps.x * 1.15;
  let y = -ps.y * 1.15 + 0.1;
  let r = x * x + y * y - 1.0;
  let F = r * r * r - x * x * y * y * y;
  let g = vec2<f32>(6.0 * x * r * r - 2.0 * x * y * y * y, 6.0 * y * r * r - 3.0 * x * x * y * y);
  return F / max(length(g), 0.001) / 1.15;
}
fn effect(uv: vec2<f32>, n: vec2<f32>) -> vec4<f32> {
  let c = tex(uv);
  let asp = vec2<f32>(aspect(), 1.0);
  var p = (n - vec2<f32>(fx.uX, fx.uY) * 0.01) * asp;
  let r = radians(-fx.uRotation);
  p = vec2<f32>(cos(r) * p.x - sin(r) * p.y, sin(r) * p.x + cos(r) * p.y);
  let half_ = max(vec2<f32>(fx.uWidth * aspect(), fx.uHeight) * 0.005, vec2<f32>(0.0005));
  let sz = min(half_.x, half_.y);
  let f = max(fx.uFeather * 0.003, 0.0005);
  let shape = i32(fx.uShape + 0.5);
  var d: f32;
  if (shape == 0) {
    d = p.y;
  } else if (shape == 1) {
    d = abs(p.y) - half_.y;
  } else if (shape == 2) {
    d = (length(p / half_) - 1.0) * sz;
  } else if (shape == 3) {
    let rr = clamp(fx.uRound * 0.01, 0.0, 1.0) * sz;
    let q = abs(p) - half_ + vec2<f32>(rr);
    d = length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0) - rr;
  } else if (shape == 4) {
    d = starDist(p / half_) * sz;
  } else {
    d = heartDist(p / half_) * sz;
  }
  var m = 1.0 - smoothstep(-f, f, d);
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



// ── Qualidade de "efeitos prontos" ────────────────────────────────────────
// Raio e granulado são medidos em fração da ALTURA da camada (não em pixels),
// então a prévia em resolução reduzida e o export em resolução cheia mostram o
// mesmo desenho. Brilho é somado em luz linear (gama 2,2) com ombro suave, para
// não estourar em branco chapado como um "add" em gama de tela.

// Brilho suave (bloom): realces acima do limiar espalham luz ao redor.
// 48 amostras em disco de Vogel com peso gaussiano e giro aleatório por pixel
// (ruído fino em vez de anéis/bandas).
export const GLOW: ShaderEffectSpec = {
  name: "glow",
  uniforms: { uAmount: 0, uRadius: 30, uThreshold: 60 },
  glsl: `
float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec3 toLin(vec4 c) { return c.a > 0.0001 ? pow(clamp(c.rgb / c.a, 0.0, 1.0), vec3(2.2)) : vec3(0.0); }
vec4 effect(vec2 uv, vec2 n) {
  vec4 c = tex(uv);
  float rad = max(uRadius, 1.0) * 0.0015;
  float thr = clamp(uThreshold * 0.01, 0.0, 1.0);
  float spin = h12(n * uOutputFrame.zw) * 6.2831853;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 48; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / 48.0);
    float a = fi * 2.39996323 + spin;
    vec2 o = vec2(cos(a) / aspect(), sin(a)) * r * rad;
    vec4 s = tex(toUv(n + o));
    vec3 l = toLin(s);
    float y = dot(l, vec3(0.2126, 0.7152, 0.0722));
    float k = smoothstep(thr * 0.8, thr * 0.8 + 0.2, y);
    float w = exp(-r * r * 3.0);
    acc += l * k * w * s.a;
    wsum += w;
  }
  vec3 bloom = acc / max(wsum, 0.0001);
  vec3 o = toLin(c) + bloom * (uAmount * 0.012);
  vec3 knee = 0.8 + 0.2 * (1.0 - exp(-(o - 0.8) * 5.0));
  o = mix(o, knee, step(0.8, o));
  return vec4(pow(clamp(o, 0.0, 1.0), vec3(1.0 / 2.2)) * c.a, c.a);
}`,
  wgsl: `
fn h12(p: vec2<f32>) -> f32 {
  var q = fract(vec3<f32>(p.x, p.y, p.x) * 0.1031);
  q = q + dot(q, q.yzx + vec3<f32>(33.33));
  return fract((q.x + q.y) * q.z);
}
fn toLin(c: vec4<f32>) -> vec3<f32> {
  if (c.a <= 0.0001) { return vec3<f32>(0.0); }
  return pow(clamp(c.rgb / c.a, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(2.2));
}
fn effect(uv: vec2<f32>, n: vec2<f32>) -> vec4<f32> {
  let c = tex(uv);
  let rad = max(fx.uRadius, 1.0) * 0.0015;
  let thr = clamp(fx.uThreshold * 0.01, 0.0, 1.0);
  let spin = h12(n * gfu.uOutputFrame.zw) * 6.2831853;
  var acc = vec3<f32>(0.0);
  var wsum = 0.0;
  for (var i: i32 = 0; i < 48; i = i + 1) {
    let fi = f32(i) + 0.5;
    let r = sqrt(fi / 48.0);
    let a = fi * 2.39996323 + spin;
    let o = vec2<f32>(cos(a) / aspect(), sin(a)) * r * rad;
    let s = tex(toUv(n + o));
    let l = toLin(s);
    let y = dot(l, vec3<f32>(0.2126, 0.7152, 0.0722));
    let k = smoothstep(thr * 0.8, thr * 0.8 + 0.2, y);
    let w = exp(-r * r * 3.0);
    acc = acc + l * k * w * s.a;
    wsum = wsum + w;
  }
  let bloom = acc / max(wsum, 0.0001);
  var o = toLin(c) + bloom * (fx.uAmount * 0.012);
  let knee = vec3<f32>(0.8) + 0.2 * (vec3<f32>(1.0) - exp(-(o - vec3<f32>(0.8)) * 5.0));
  o = mix(o, knee, step(vec3<f32>(0.8), o));
  return vec4<f32>(pow(clamp(o, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(1.0 / 2.2)) * c.a, c.a);
}`,
};

// Granulado de filme: ruído de valor suavizado (não pixel a pixel), mais forte
// nos meios-tons como no filme real, renovado 24 vezes por segundo pelo tempo
// do clipe (uTime, escrito pelo tick do descritor) — determinístico no export.
export const GRAIN: ShaderEffectSpec = {
  name: "grain",
  uniforms: { uAmount: 0, uSize: 1.5, uTime: 0 },
  glsl: `
float h13(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
vec4 effect(vec2 uv, vec2 n) {
  vec4 c = tex(uv);
  if (c.a < 0.0001) return c;
  vec3 s = c.rgb / c.a;
  // Célula do grão em pixels desta saída. Abaixo de 1 px (prévia/miniatura
  // em resolução reduzida) a grade vira a de pixels e a amplitude cai na
  // proporção — o mesmo "peso" visual da resolução cheia, sem chiado digital.
  float cellPx = max(uSize, 0.5) * uOutputFrame.w / 1080.0;
  float amp = min(cellPx, 1.0);
  vec2 g = n * uOutputFrame.zw / max(cellPx, 1.0);
  float fr = floor(uTime * 24.0);
  vec2 i = floor(g);
  vec2 f = fract(g);
  f = f * f * (3.0 - 2.0 * f);
  float a = h13(vec3(i, fr));
  float b = h13(vec3(i + vec2(1.0, 0.0), fr));
  float d = h13(vec3(i + vec2(0.0, 1.0), fr));
  float e = h13(vec3(i + vec2(1.0, 1.0), fr));
  float nz = (mix(mix(a, b, f.x), mix(d, e, f.x), f.y) - 0.5) * 2.0;
  float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
  float resp = mix(0.35, 1.0, 4.0 * l * (1.0 - l));
  s += nz * uAmount * 0.0018 * resp * amp;
  return vec4(clamp(s, 0.0, 1.0) * c.a, c.a);
}`,
  wgsl: `
fn h13(pin: vec3<f32>) -> f32 {
  var p = fract(pin * vec3<f32>(0.1031, 0.1030, 0.0973));
  p = p + dot(p, p.yxz + vec3<f32>(33.33));
  return fract((p.x + p.y) * p.z);
}
fn effect(uv: vec2<f32>, n: vec2<f32>) -> vec4<f32> {
  let c = tex(uv);
  if (c.a < 0.0001) { return c; }
  var s = c.rgb / c.a;
  let cellPx = max(fx.uSize, 0.5) * gfu.uOutputFrame.w / 1080.0;
  let amp = min(cellPx, 1.0);
  let g = n * gfu.uOutputFrame.zw / max(cellPx, 1.0);
  let fr = floor(fx.uTime * 24.0);
  let i = floor(g);
  var f = fract(g);
  f = f * f * (vec2<f32>(3.0) - 2.0 * f);
  let a = h13(vec3<f32>(i, fr));
  let b = h13(vec3<f32>(i + vec2<f32>(1.0, 0.0), fr));
  let d = h13(vec3<f32>(i + vec2<f32>(0.0, 1.0), fr));
  let e = h13(vec3<f32>(i + vec2<f32>(1.0, 1.0), fr));
  let nz = (mix(mix(a, b, f.x), mix(d, e, f.x), f.y) - 0.5) * 2.0;
  let l = dot(s, vec3<f32>(0.2126, 0.7152, 0.0722));
  let resp = mix(0.35, 1.0, 4.0 * l * (1.0 - l));
  s = s + vec3<f32>(nz * fx.uAmount * 0.0018 * resp * amp);
  return vec4<f32>(clamp(s, vec3<f32>(0.0), vec3<f32>(1.0)) * c.a, c.a);
}`,
};

// Tonalização dividida (split toning): uma cor nas sombras, outra nos realces.
// Soma só a crominância da cor escolhida (luminância zero), então a exposição
// não muda — o "teal & orange" sem lavar a pele.
export const SPLIT_TONE: ShaderEffectSpec = {
  name: "splittone",
  uniforms: { uShadowHue: 190, uHighlightHue: 35, uAmount: 0, uBalance: 0 },
  glsl: `
vec3 chroma(float hue) {
  vec3 k = clamp(abs(fract(hue / 360.0 + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  return k - vec3(dot(k, vec3(0.2126, 0.7152, 0.0722)));
}
vec4 effect(vec2 uv, vec2 n) {
  vec4 c = tex(uv);
  if (c.a < 0.0001) return c;
  vec3 s = c.rgb / c.a;
  float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
  float bal = uBalance * 0.003;
  float ws = 1.0 - smoothstep(0.0, 0.55 + bal, l);
  float wh = smoothstep(0.45 + bal, 1.0, l);
  s += (chroma(uShadowHue) * ws + chroma(uHighlightHue) * wh) * uAmount * 0.004;
  return vec4(clamp(s, 0.0, 1.0) * c.a, c.a);
}`,
  wgsl: `
fn chroma(hue: f32) -> vec3<f32> {
  let k = clamp(abs(fract(vec3<f32>(hue / 360.0) + vec3<f32>(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - vec3<f32>(3.0)) - vec3<f32>(1.0), vec3<f32>(0.0), vec3<f32>(1.0));
  return k - vec3<f32>(dot(k, vec3<f32>(0.2126, 0.7152, 0.0722)));
}
fn effect(uv: vec2<f32>, n: vec2<f32>) -> vec4<f32> {
  let c = tex(uv);
  if (c.a < 0.0001) { return c; }
  var s = c.rgb / c.a;
  let l = dot(s, vec3<f32>(0.2126, 0.7152, 0.0722));
  let bal = fx.uBalance * 0.003;
  let ws = 1.0 - smoothstep(0.0, 0.55 + bal, l);
  let wh = smoothstep(0.45 + bal, 1.0, l);
  s = s + (chroma(fx.uShadowHue) * ws + chroma(fx.uHighlightHue) * wh) * fx.uAmount * 0.004;
  return vec4<f32>(clamp(s, vec3<f32>(0.0), vec3<f32>(1.0)) * c.a, c.a);
}`,
};

// Curva S de cinema: contraste suave que não corta pretos nem brancos (o
// contraste linear corta). Metade preserva a matiz (escala pela luminância),
// metade por canal (o leve ganho de saturação nos meios-tons do filme).
export const FILM_CURVE: ShaderEffectSpec = {
  name: "filmcurve",
  uniforms: { uAmount: 0 },
  glsl: `
float sc(float x, float p) { x = clamp(x, 0.0, 1.0); return x < 0.5 ? 0.5 * pow(2.0 * x, p) : 1.0 - 0.5 * pow(2.0 * (1.0 - x), p); }
vec4 effect(vec2 uv, vec2 n) {
  vec4 c = tex(uv);
  if (c.a < 0.0001) return c;
  vec3 s = clamp(c.rgb / c.a, 0.0, 1.0);
  float p = 1.0 + clamp(uAmount, 0.0, 100.0) * 0.012;
  float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
  vec3 byLum = s * (sc(l, p) / max(l, 0.0001));
  vec3 byCh = vec3(sc(s.r, p), sc(s.g, p), sc(s.b, p));
  return vec4(clamp(mix(byLum, byCh, 0.5), 0.0, 1.0) * c.a, c.a);
}`,
  wgsl: `
fn sc(xin: f32, p: f32) -> f32 {
  let x = clamp(xin, 0.0, 1.0);
  return select(1.0 - 0.5 * pow(2.0 * (1.0 - x), p), 0.5 * pow(2.0 * x, p), x < 0.5);
}
fn effect(uv: vec2<f32>, n: vec2<f32>) -> vec4<f32> {
  let c = tex(uv);
  if (c.a < 0.0001) { return c; }
  let s = clamp(c.rgb / c.a, vec3<f32>(0.0), vec3<f32>(1.0));
  let p = 1.0 + clamp(fx.uAmount, 0.0, 100.0) * 0.012;
  let l = dot(s, vec3<f32>(0.2126, 0.7152, 0.0722));
  let byLum = s * (sc(l, p) / max(l, 0.0001));
  let byCh = vec3<f32>(sc(s.r, p), sc(s.g, p), sc(s.b, p));
  return vec4<f32>(clamp(mix(byLum, byCh, vec3<f32>(0.5)), vec3<f32>(0.0), vec3<f32>(1.0)) * c.a, c.a);
}`,
};
export const STUDIO_SHADERS = { VIGNETTE, PIXELATE, RGB_SPLIT, MIRROR, TONE, MASK, ROTATE_3D, GLOW, GRAIN, SPLIT_TONE, FILM_CURVE };
