// Studio-IA: a geometria da máscara (efeito `mask`) vista da prévia. Espelha o
// shader MASK de `render/effects/filters/studioShaders.ts`: os mesmos espaços
// e as mesmas fórmulas, para que o contorno desenhado em cima da prévia caia
// exatamente onde o shader corta.
//
// Espaços:
//   n      — posição normalizada na camada (0..1), y para baixo.
//   aspect — (n − centro) · (a, 1), com a = largura/altura da camada; unidades
//            de ALTURA da camada, então um círculo é redondo.
//   local  — aspect girado por −rotação: o eixo próprio da forma.
//   client — pixels CSS da tela, via o quadrilátero da camada.

import type { Pt } from "./gizmoGeometry";

export interface MaskParams {
  shape: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  feather: number;
  invert: number;
  round: number;
}

export const MASK_DEFAULTS: MaskParams = {
  shape: 2, x: 50, y: 50, width: 50, height: 50, rotation: 0, feather: 10, invert: 0, round: 0,
};

export type MaskShape = 0 | 1 | 2 | 3 | 4 | 5;
export function maskShape(v: number): MaskShape {
  return Math.min(5, Math.max(0, Math.round(v))) as MaskShape;
}

/** Meia-largura/meia-altura da forma em unidades de altura (o `half_` do shader). */
export function maskHalf(p: MaskParams, aspect: number): Pt {
  return { x: Math.max(p.width * aspect * 0.005, 0.0005), y: Math.max(p.height * 0.005, 0.0005) };
}

/** Largura da rampa da borda suave em unidades de altura (o `f` do shader). */
export function maskFeatherUnits(feather: number): number {
  return Math.max(feather * 0.003, 0.0005);
}

const rad = (deg: number) => (deg * Math.PI) / 180;

export function localToN(l: Pt, p: MaskParams, aspect: number): Pt {
  const r = rad(p.rotation);
  const ax = Math.cos(r) * l.x - Math.sin(r) * l.y;
  const ay = Math.sin(r) * l.x + Math.cos(r) * l.y;
  return { x: p.x * 0.01 + ax / aspect, y: p.y * 0.01 + ay };
}

export function nToLocal(n: Pt, p: MaskParams, aspect: number): Pt {
  const ax = (n.x - p.x * 0.01) * aspect;
  const ay = n.y - p.y * 0.01;
  const r = rad(-p.rotation);
  return { x: Math.cos(r) * ax - Math.sin(r) * ay, y: Math.sin(r) * ax + Math.cos(r) * ay };
}

/** Quadrilátero da camada (tl, tr, br, bl) como mapa afim n → client. */
export interface LayerAffine {
  o: Pt;
  ex: Pt;
  ey: Pt;
}
export function layerAffine(q: readonly Pt[]): LayerAffine {
  const [tl, tr, , bl] = q as [Pt, Pt, Pt, Pt];
  return { o: tl, ex: { x: tr.x - tl.x, y: tr.y - tl.y }, ey: { x: bl.x - tl.x, y: bl.y - tl.y } };
}
export function nToClient(n: Pt, m: LayerAffine): Pt {
  return { x: m.o.x + m.ex.x * n.x + m.ey.x * n.y, y: m.o.y + m.ex.y * n.x + m.ey.y * n.y };
}
export function clientToN(c: Pt, m: LayerAffine): Pt | null {
  const det = m.ex.x * m.ey.y - m.ex.y * m.ey.x;
  if (Math.abs(det) < 1e-9) return null;
  const dx = c.x - m.o.x, dy = c.y - m.o.y;
  return { x: (dx * m.ey.y - dy * m.ey.x) / det, y: (m.ex.x * dy - m.ex.y * dx) / det };
}

// ── contorno ─────────────────────────────────────────────────────────────

/** Coração implícito do shader, nas coordenadas da forma unitária (ps). */
function heartF(psx: number, psy: number): number {
  const x = psx * 1.15;
  const y = -psy * 1.15 + 0.1;
  const r = x * x + y * y - 1;
  return r * r * r - x * x * y * y * y;
}

/** Contorno fechado em espaço LOCAL (antes da rotação), um polígono por
 *  linha desenhada. Linear e faixa são linhas abertas (2 pontos cada). */
export function maskOutlineLocal(p: MaskParams, aspect: number, steps = 96): Pt[][] {
  const h = maskHalf(p, aspect);
  const shape = maskShape(p.shape);
  const LONG = 4; // além da camada em qualquer rotação
  if (shape === 0) return [[{ x: -LONG, y: 0 }, { x: LONG, y: 0 }]];
  if (shape === 1) return [
    [{ x: -LONG, y: -h.y }, { x: LONG, y: -h.y }],
    [{ x: -LONG, y: h.y }, { x: LONG, y: h.y }],
  ];
  const out: Pt[] = [];
  if (shape === 2) {
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      out.push({ x: h.x * Math.cos(t), y: h.y * Math.sin(t) });
    }
  } else if (shape === 3) {
    const rr = Math.min(Math.max(p.round * 0.01, 0), 1) * Math.min(h.x, h.y);
    const corners: Array<[number, number, number]> = [
      [h.x - rr, -(h.y - rr), -Math.PI / 2],
      [h.x - rr, h.y - rr, 0],
      [-(h.x - rr), h.y - rr, Math.PI / 2],
      [-(h.x - rr), -(h.y - rr), Math.PI],
    ];
    const arc = rr > 0 ? 8 : 1;
    for (const [cx, cy, a0] of corners) {
      for (let k = 0; k < arc; k++) {
        const a = a0 + (k / Math.max(arc - 1, 1)) * (Math.PI / 2);
        out.push({ x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) });
      }
    }
  } else if (shape === 4) {
    for (let k = 0; k < 10; k++) {
      const phi = (k * Math.PI) / 5;
      const r = k % 2 === 0 ? 1 : 0.45;
      out.push({ x: h.x * r * Math.sin(phi), y: -h.y * r * Math.cos(phi) });
    }
  } else {
    // Coração: raio da borda por bisseção em cada direção, a partir do centro
    // da forma (o coração implícito é estrelado em torno da origem).
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const dx = Math.cos(t), dy = Math.sin(t);
      let lo = 0, hi = 2;
      for (let it = 0; it < 30; it++) {
        const mid = (lo + hi) / 2;
        if (heartF(dx * mid, dy * mid) < 0) lo = mid; else hi = mid;
      }
      out.push({ x: h.x * dx * lo, y: h.y * dy * lo });
    }
  }
  return [out];
}

// ── alças ────────────────────────────────────────────────────────────────

export type MaskHandle = "move" | "width" | "height" | "size" | "rotate" | "feather";

/** Onde cada alça fica, em espaço local. `gap` é a distância (em unidades de
 *  altura) entre a forma e as alças de girar/suavizar. */
export function maskHandlesLocal(p: MaskParams, aspect: number, gap: number): Array<{ id: MaskHandle; at: Pt }> {
  const h = maskHalf(p, aspect);
  const shape = maskShape(p.shape);
  const fu = maskFeatherUnits(p.feather);
  if (shape === 0) {
    return [
      { id: "move", at: { x: 0, y: 0 } },
      { id: "rotate", at: { x: 0, y: -gap * 1.6 } },
      { id: "feather", at: { x: 0, y: gap + fu } },
    ];
  }
  const out: Array<{ id: MaskHandle; at: Pt }> = [
    { id: "move", at: { x: 0, y: 0 } },
    { id: "height", at: { x: 0, y: h.y } },
    { id: "rotate", at: { x: 0, y: -h.y - gap * 1.6 } },
    { id: "feather", at: { x: 0, y: h.y + gap + fu } },
  ];
  if (shape !== 1) out.push({ id: "width", at: { x: h.x, y: 0 } }, { id: "size", at: { x: h.x, y: h.y } });
  return out;
}

/** O novo valor dos parâmetros para uma alça arrastada até `n` (posição do
 *  ponteiro na camada). `start` são os parâmetros no início do arrasto e
 *  `grabN` onde o ponteiro pegou — só "mover" é relativo; as demais seguem o
 *  ponteiro de forma absoluta, como no CapCut. `snap` trava o giro em 15°. */
export function dragMask(
  handle: MaskHandle,
  start: MaskParams,
  grabN: Pt,
  n: Pt,
  aspect: number,
  gap: number,
  snap = false,
): Partial<MaskParams> {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const round = (v: number, step = 0.1) => Math.round(v / step) * step;
  if (handle === "move") {
    return {
      x: round(clamp(start.x + (n.x - grabN.x) * 100, 0, 100)),
      y: round(clamp(start.y + (n.y - grabN.y) * 100, 0, 100)),
    };
  }
  const l = nToLocal(n, start, aspect);
  if (handle === "width") return { width: round(clamp(Math.abs(l.x) / (aspect * 0.005), 1, 200)) };
  if (handle === "height") return { height: round(clamp(Math.abs(l.y) / 0.005, 1, 200)) };
  if (handle === "size") {
    return {
      width: round(clamp(Math.abs(l.x) / (aspect * 0.005), 1, 200)),
      height: round(clamp(Math.abs(l.y) / 0.005, 1, 200)),
    };
  }
  if (handle === "rotate") {
    // Ângulo em espaço aspect (sem a rotação atual): a alça fica ACIMA (−y).
    const ax = (n.x - start.x * 0.01) * aspect;
    const ay = n.y - start.y * 0.01;
    let deg = (Math.atan2(ax, -ay) * 180) / Math.PI;
    if (snap) deg = Math.round(deg / 15) * 15;
    return { rotation: round(clamp(deg, -180, 180), 1) };
  }
  // feather: distância da borda de baixo até o ponteiro, menos o espaço da alça.
  const edge = maskShape(start.shape) === 0 ? 0 : maskHalf(start, aspect).y;
  const units = l.y - edge - gap;
  return { feather: round(clamp(units / 0.003, 0, 100), 1) };
}
