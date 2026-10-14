// Studio-IA color adjustments, CapCut's "Ajustar" set rebuilt as 4×5 color
// matrices (same layout and 0..1 offset units as colorMatrices.ts). Every
// writer takes the slider value and is the identity at 0.

import { REC709_LUMA } from "./colorMatrices";

type M3 = [number, number, number, number, number, number, number, number, number];

const IDENTITY: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function write(out: number[], m: M3, offset: [number, number, number] = [0, 0, 0]): void {
  out[0] = m[0]; out[1] = m[1]; out[2] = m[2]; out[3] = 0; out[4] = offset[0];
  out[5] = m[3]; out[6] = m[4]; out[7] = m[5]; out[8] = 0; out[9] = offset[1];
  out[10] = m[6]; out[11] = m[7]; out[12] = m[8]; out[13] = 0; out[14] = offset[2];
  out[15] = 0; out[16] = 0; out[17] = 0; out[18] = 1; out[19] = 0;
}

function mix(a: M3, b: M3, t: number): M3 {
  return a.map((v, i) => v + (b[i]! - v) * t) as M3;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const [LR, LG, LB] = REC709_LUMA;
const LUMA: M3 = [LR, LG, LB, LR, LG, LB, LR, LG, LB];
const SEPIA: M3 = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131];

/** Preto e branco: 0 = original, 100 = luma Rec.709. */
export function writeBlackWhite(out: number[], amount: number): void {
  write(out, mix(IDENTITY, LUMA, clamp01(amount / 100)));
}

/** Sépia: 0 = original, 100 = sépia clássica. */
export function writeSepia(out: number[], amount: number): void {
  write(out, mix(IDENTITY, SEPIA, clamp01(amount / 100)));
}

/** Temperatura: positivo esquenta (mais vermelho), negativo esfria (mais azul). */
export function writeTemperature(out: number[], amount: number): void {
  const a = amount / 100;
  write(out, [1 + 0.2 * a, 0, 0, 0, 1 + 0.03 * a, 0, 0, 0, 1 - 0.2 * a]);
}

/** Tom: positivo puxa para magenta, negativo para verde. */
export function writeTint(out: number[], amount: number): void {
  const a = amount / 100;
  write(out, [1 + 0.1 * a, 0, 0, 0, 1 - 0.2 * a, 0, 0, 0, 1 + 0.1 * a]);
}

/** Matiz: gira o círculo de cores em graus, preservando a luminância (CSS hue-rotate). */
export function writeHue(out: number[], degrees: number): void {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  write(out, [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ]);
}

/** Esmaecer: levanta os pretos, baixa os brancos e tira um pouco de cor (look de filme). */
export function writeFade(out: number[], amount: number): void {
  const a = clamp01(amount / 100);
  const desat = mix(IDENTITY, LUMA, 0.2 * a);
  const gain = 1 - 0.25 * a;
  const lift = 0.12 * a;
  write(out, desat.map((v) => v * gain) as M3, [lift, lift, lift]);
}
