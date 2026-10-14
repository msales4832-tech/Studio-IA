// Studio-IA: miniaturas dos "efeitos prontos" desenhadas pelos MESMOS filtros
// que a prévia e o export usam — a miniatura é o efeito de verdade, não uma
// aproximação em CSS. Uma cena de exemplo (pôr do sol com realces, sombras e
// pele) é desenhada uma vez num canvas 2D; cada preset roda nela num renderer
// WebGL próprio, pequeno e temporário, e vira um data URL em cache.

import { autoDetectRenderer, Sprite, Texture, type Filter, type Renderer } from "pixi.js";
import { getEffectPreset } from "../../../shared/effects/studioPresets";
import { getDescriptor } from "./effectRegistry";

export const THUMB_W = 192;
export const THUMB_H = 108;

/// Pôr do sol: céu em degradê, sol estourado (alimenta o brilho), montanhas em
/// camadas (sombras), água com reflexo e uma figura em tom de pele (testa se a
/// cor "lava" a pele). Determinístico — mesma imagem em toda máquina.
export function drawSampleScene(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, "#1d3b6e");
  sky.addColorStop(0.55, "#d9775a");
  sky.addColorStop(1, "#ffd59a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const sunX = w * 0.68, sunY = h * 0.5, sunR = h * 0.11;
  const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR * 3.2);
  halo.addColorStop(0, "rgba(255,240,200,0.9)");
  halo.addColorStop(1, "rgba(255,200,150,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  const ridge = (base: number, amp: number, freq: number, phase: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 2) {
      const t = x / w;
      const y = base - amp * (0.6 * Math.sin(t * freq + phase) + 0.4 * Math.sin(t * freq * 2.3 + phase * 1.7));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  };
  ridge(h * 0.6, h * 0.08, 5, 0.4, "#6b4a63");
  ridge(h * 0.66, h * 0.07, 7, 2.1, "#3b2c46");

  const water = ctx.createLinearGradient(0, h * 0.68, 0, h);
  water.addColorStop(0, "#c46f5c");
  water.addColorStop(1, "#1a1f33");
  ctx.fillStyle = water;
  ctx.fillRect(0, h * 0.68, w, h * 0.32);
  ctx.fillStyle = "rgba(255,235,200,0.75)";
  for (let i = 0; i < 7; i++) {
    const y = h * (0.71 + i * 0.035);
    const half = sunR * (1.2 - i * 0.13);
    ctx.fillRect(sunX - half, y, half * 2, Math.max(1, h * 0.008));
  }

  // Figura em primeiro plano: rosto/pele + roupa escura.
  const fx = w * 0.24, fy = h * 0.55;
  ctx.fillStyle = "#2a2230";
  ctx.beginPath();
  ctx.ellipse(fx, fy + h * 0.3, h * 0.13, h * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c98f6f";
  ctx.beginPath();
  ctx.ellipse(fx, fy, h * 0.065, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a2a22";
  ctx.beginPath();
  ctx.ellipse(fx, fy - h * 0.045, h * 0.07, h * 0.05, 0, Math.PI, Math.PI * 2);
  ctx.fill();
}

/// O mesmo caminho do EffectChain: cria o filtro do catálogo, aplica cada
/// parâmetro (o preset sobrescreve o padrão) e o tick de tempo em t = 0.
export function presetFilters(presetId: string): Filter[] {
  const preset = getEffectPreset(presetId);
  if (!preset) return [];
  const out: Filter[] = [];
  for (const e of preset.effects) {
    const d = getDescriptor(e.kind);
    if (!d) continue;
    const f = d.create();
    d.tick?.(f, 0);
    for (const [key, spec] of Object.entries(d.params)) spec.apply(f, e.params[key] ?? spec.default);
    out.push(f);
  }
  return out;
}

const cache = new Map<string, string>();
let pending: Promise<Map<string, string>> | null = null;

/// Renderiza todas as miniaturas pedidas de uma vez e libera o contexto WebGL
/// em seguida (o app já tem o seu; um segundo contexto vivo só custaria
/// memória na GPU integrada). Chamadas repetidas reaproveitam o cache.
export function renderPresetThumbnails(ids: readonly string[]): Promise<Map<string, string>> {
  const missing = ids.filter((id) => !cache.has(id));
  if (missing.length === 0) return Promise.resolve(cache);
  if (pending) return pending.then(() => renderPresetThumbnails(ids));
  pending = (async () => {
    let renderer: Renderer | null = null;
    const scene = document.createElement("canvas");
    scene.width = THUMB_W * 2;
    scene.height = THUMB_H * 2;
    const ctx = scene.getContext("2d");
    if (!ctx) return cache;
    drawSampleScene(ctx, scene.width, scene.height);
    const texture = Texture.from(scene);
    try {
      renderer = await autoDetectRenderer({
        preference: "webgl",
        width: scene.width,
        height: scene.height,
        backgroundAlpha: 0,
        antialias: false,
      });
      for (const id of missing) {
        const sprite = new Sprite(texture);
        const filters = presetFilters(id);
        sprite.filters = filters;
        try {
          const canvas = renderer.extract.canvas(sprite) as HTMLCanvasElement;
          const out = document.createElement("canvas");
          out.width = THUMB_W;
          out.height = THUMB_H;
          out.getContext("2d")?.drawImage(canvas, 0, 0, THUMB_W, THUMB_H);
          cache.set(id, out.toDataURL("image/jpeg", 0.9));
        } finally {
          sprite.filters = [];
          for (const f of filters) f.destroy();
          sprite.destroy();
        }
      }
    } catch (err) {
      // Sem WebGL (ambiente de teste, GPU bloqueada): a galeria mostra o
      // cartão sem miniatura em vez de quebrar.
      console.warn("[studio-ia] miniaturas de efeitos indisponíveis", err);
    } finally {
      texture.destroy(true);
      renderer?.destroy();
      pending = null;
    }
    return cache;
  })();
  return pending;
}

/// Miniatura sem efeito, para o cartão "Nenhum" e como base de comparação.
export function sampleSceneDataUrl(): string | null {
  const c = document.createElement("canvas");
  c.width = THUMB_W;
  c.height = THUMB_H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  drawSampleScene(ctx, THUMB_W, THUMB_H);
  return c.toDataURL("image/jpeg", 0.9);
}
