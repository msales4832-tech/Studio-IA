import { describe, expect, it } from 'vitest';
import {
  clientToN, dragMask, layerAffine, localToN, MASK_DEFAULTS, maskHalf, maskHandlesLocal,
  maskOutlineLocal, nToClient, nToLocal, type MaskParams,
} from './maskGeometry';

const A = 16 / 9;
const p = (o: Partial<MaskParams> = {}): MaskParams => ({ ...MASK_DEFAULTS, ...o });

describe('maskGeometry', () => {
  it('local ↔ n ida e volta, com rotação', () => {
    const m = p({ x: 30, y: 60, rotation: 37 });
    const l = { x: 0.12, y: -0.08 };
    const back = nToLocal(localToN(l, m, A), m, A);
    expect(back.x).toBeCloseTo(l.x, 9);
    expect(back.y).toBeCloseTo(l.y, 9);
  });

  it('client ↔ n pelo quadrilátero da camada (rotacionado)', () => {
    const q = [{ x: 100, y: 50 }, { x: 260, y: 140 }, { x: 215, y: 220 }, { x: 55, y: 130 }];
    const m = layerAffine(q);
    const n = { x: 0.3, y: 0.7 };
    const c = nToClient(n, m);
    const r = clientToN(c, m)!;
    expect(r.x).toBeCloseTo(0.3, 9);
    expect(r.y).toBeCloseTo(0.7, 9);
  });

  it('círculo: o contorno fica na meia-largura do shader', () => {
    const m = p({ shape: 2, width: 40, height: 40 });
    const [ring] = maskOutlineLocal(m, A, 4);
    const h = maskHalf(m, A);
    expect(ring![0]!.x).toBeCloseTo(h.x, 9); // largura em % da LARGURA da camada
    expect(h.x).toBeCloseTo(40 * A * 0.005, 9);
  });

  it('estrela: 10 vértices, ponta para cima', () => {
    const [star] = maskOutlineLocal(p({ shape: 4 }), A);
    expect(star).toHaveLength(10);
    expect(star![0]!.x).toBeCloseTo(0, 9);
    expect(star![0]!.y).toBeLessThan(0);
  });

  it('coração: contorno fechado em volta do centro', () => {
    const [heart] = maskOutlineLocal(p({ shape: 5 }), A, 64);
    expect(heart).toHaveLength(64);
    for (const pt of heart!) expect(Math.hypot(pt.x, pt.y)).toBeGreaterThan(0.01);
  });

  it('arrastar a alça de largura leva a borda até o ponteiro', () => {
    const m = p({ shape: 3, x: 50, y: 50, width: 50 });
    const target = localToN({ x: 0.3, y: 0.02 }, m, A);
    const out = dragMask('width', m, target, target, A, 0.05);
    expect(out.width).toBeCloseTo(0.3 / (A * 0.005), 0);
  });

  it('mover é relativo ao ponto onde pegou', () => {
    const m = p({ x: 40, y: 40 });
    const out = dragMask('move', m, { x: 0.5, y: 0.5 }, { x: 0.6, y: 0.45 }, A, 0.05);
    expect(out.x).toBeCloseTo(50, 6);
    expect(out.y).toBeCloseTo(35, 6);
  });

  it('girar com Shift trava em 15°', () => {
    const m = p({ x: 50, y: 50 });
    const n = { x: 0.5 + 0.1 / A, y: 0.5 - 0.1 }; // 45° em espaço aspect
    expect(dragMask('rotate', m, n, n, A, 0.05, true).rotation).toBe(45);
  });

  it('alça de suavizar devolve o mesmo valor de onde está', () => {
    const m = p({ shape: 2, feather: 20 });
    const gap = 0.05;
    const f = maskHandlesLocal(m, A, gap).find((h) => h.id === 'feather')!;
    const n = localToN(f.at, m, A);
    expect(dragMask('feather', m, n, n, A, gap).feather).toBeCloseTo(20, 0);
  });

  it('faixa não tem alça de largura', () => {
    const ids = maskHandlesLocal(p({ shape: 1 }), A, 0.05).map((h) => h.id);
    expect(ids).not.toContain('width');
    expect(ids).toContain('height');
  });
});
