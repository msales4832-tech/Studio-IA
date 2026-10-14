// Studio-IA: edição da máscara direto na prévia, como no CapCut — arrastar o
// centro move, as alças mudam largura/altura, a de cima gira (Shift = 15°) e
// a seta de baixo suaviza a borda. Durante o arrasto o shader recebe os
// valores por override transitório (não vai para o histórico); ao soltar, UM
// commit grava os parâmetros mudados (com chave de animação se o parâmetro já
// estiver animado). Esc ou Enter encerra a edição.

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { updateLayerParamTracks, type AnimTrack, type CompositionSummary, type EffectView, type LayerSummary } from "../ipc";
import { logMutationFailure } from "../errors/tryMutate";
import { autoKeyTrack } from "../keyframe/autoKey";
import { resolveAnimated } from "../render/animated";
import { clearTransientOverrides, setTransientOverrides } from "../render/effects/effectOverrides";
import { usePrimaryLayerId } from "../state/selectionStore";
import { useOpenComposition } from "../state/projectStore";
import { usePreviewRenderTargetId } from "../state/compositionAnchorStore";
import { useFocusedPlayheadReader } from "../state/playheadProjection";
import { endMaskEdit, useMaskEditingStore } from "../state/maskEditingStore";
import { isInTransientWidget } from "../shortcuts/match";
import { getGizmoProbe } from "./gizmoProbeRegistry";
import { layerFrameAt } from "./centerInFrame";
import { compToClient, containFit, layerQuad, type Pt } from "./gizmoGeometry";
import { observeClientRect } from "./layoutRectCache";
import {
  clientToN, dragMask, layerAffine, localToN, MASK_DEFAULTS, maskHandlesLocal, maskOutlineLocal, nToClient,
  type LayerAffine, type MaskHandle, type MaskParams,
} from "./maskGeometry";

const HANDLE_IDS: MaskHandle[] = ["move", "width", "height", "size", "rotate", "feather"];
const PARAM_KEYS = Object.keys(MASK_DEFAULTS) as (keyof MaskParams)[];
const GAP_PX = 26;

export function MaskOverlayHost() {
  const { layerId, effectId } = useMaskEditingStore();
  const selected = usePrimaryLayerId();
  const composition = useOpenComposition();
  const target = usePreviewRenderTargetId();
  let layer: LayerSummary | null = null;
  for (const track of composition?.tracks ?? []) {
    for (const l of track.layers) if (l.id === layerId) layer = l;
  }
  const effect = layer?.effects.find((e) => e.id === effectId && e.kind === "mask") ?? null;
  const valid = layerId !== null && layerId === selected && !!composition && target === composition.id
    && !!layer && !!effect && layer.enabled && !layer.locked;
  useEffect(() => {
    if (layerId !== null && !valid) endMaskEdit();
  }, [layerId, valid]);
  return valid && layer && effect && composition
    ? <MaskOverlay key={`${layer.id}:${effect.id}`} layer={layer} effect={effect} composition={composition} />
    : null;
}

function paramsAt(effect: EffectView, tInLayerUs: number): MaskParams {
  const out = { ...MASK_DEFAULTS };
  for (const k of PARAM_KEYS) {
    const track = effect.params[k];
    if (track) out[k] = resolveAnimated(track, tInLayerUs, MASK_DEFAULTS[k]);
  }
  return out;
}

interface Drag {
  pointer: number;
  handle: MaskHandle;
  start: MaskParams;
  grabN: Pt;
  tInLayerUs: number;
  affine: LayerAffine;
  aspect: number;
  gap: number;
  draft: Partial<MaskParams>;
}

function MaskOverlay({ layer, effect, composition }: { layer: LayerSummary; effect: EffectView; composition: CompositionSummary }) {
  const { t } = useTranslation();
  const svg = useRef<SVGSVGElement>(null);
  const live = useRef({ layer, effect });
  live.current = { layer, effect };
  const readTime = useFocusedPlayheadReader();
  const reader = useRef(readTime);
  reader.current = readTime;
  const geometry = useRef<{ affine: LayerAffine; aspect: number; gap: number; params: MaskParams; tInLayerUs: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const busy = useRef(false);
  const clipId = `mask-clip-${effect.id}`;

  const cancel = () => {
    drag.current = null;
    clearTransientOverrides(live.current.effect.id);
  };

  useEffect(() => {
    const el = svg.current!;
    const bounds = observeClientRect(el);
    let raf = 0;
    let drawn = "";
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const probe = getGizmoProbe();
      const canvas = probe?.canvasRect();
      const { layer: cur, effect: fx } = live.current;
      const size = probe?.naturalSizeOf(cur.id);
      const now = reader.current();
      const fit = canvas && containFit(canvas, composition.width, composition.height);
      if (!fit || !size || size.h <= 0 || now < cur.t_start_us || now >= cur.t_end_us) {
        el.style.visibility = "hidden";
        geometry.current = null;
        drawn = "";
        return;
      }
      const frame = layerFrameAt(cur, now, size);
      const q = layerQuad({ ...frame, visibleRect: null }).map((p) => compToClient(p, fit));
      const affine = layerAffine(q);
      const aspect = size.w / size.h;
      const heightPx = Math.hypot(affine.ey.x, affine.ey.y) || 1;
      const gap = GAP_PX / heightPx;
      const tInLayerUs = now - cur.t_start_us;
      const base = paramsAt(fx, tInLayerUs);
      const d = drag.current;
      const params = d ? { ...d.start, ...d.draft } : base;
      geometry.current = { affine, aspect, gap, params: base, tInLayerUs };
      const own = bounds.rect();
      const signature = JSON.stringify([q, params, own.left, own.top]);
      if (signature === drawn) return;
      drawn = signature;
      el.style.visibility = "visible";
      const toScreen = (l: Pt) => {
        const c = nToClient(localToN(l, params, aspect), affine);
        return { x: c.x - own.left, y: c.y - own.top };
      };
      const closed = params.shape >= 2;
      const pathD = maskOutlineLocal(params, aspect)
        .map((poly) => poly.map(toScreen).map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + (closed ? " Z" : ""))
        .join(" ");
      for (const sel of ["[data-mask-outline-shadow]", "[data-mask-outline]"]) el.querySelector(sel)?.setAttribute("d", pathD);
      // Linhas da máscara linear/faixa são "infinitas": recortadas à camada.
      el.querySelector("[data-mask-clip]")?.setAttribute("points", q.map((p) => `${p.x - own.left},${p.y - own.top}`).join(" "));
      const handles = new Map(maskHandlesLocal(params, aspect, gap).map((h) => [h.id, h.at]));
      const center = toScreen({ x: 0, y: 0 });
      for (const id of HANDLE_IDS) {
        const g = el.querySelector<SVGGElement>(`[data-mask-handle="${id}"]`)!;
        const at = handles.get(id);
        if (!at) { g.style.display = "none"; continue; }
        g.style.display = "";
        const p = toScreen(at);
        g.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${params.rotation})`);
      }
      const rot = handles.get("rotate");
      const stem = el.querySelector("[data-mask-stem]")!;
      if (rot && params.shape !== 0) {
        const top = toScreen({ x: 0, y: rot.y + gap * 0.6 });
        const p = toScreen(rot);
        stem.setAttribute("x1", String(top.x)); stem.setAttribute("y1", String(top.y));
        stem.setAttribute("x2", String(p.x)); stem.setAttribute("y2", String(p.y));
      } else {
        stem.setAttribute("x1", String(center.x)); stem.setAttribute("y1", String(center.y));
        stem.setAttribute("x2", String(center.x)); stem.setAttribute("y2", String(center.y));
      }
    };
    draw();
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Enter") return;
      if (isInTransientWidget(e.target)) return;
      if (e.target instanceof HTMLElement && e.target.closest("input,textarea,[contenteditable='true']")) return;
      e.preventDefault();
      e.stopPropagation();
      if (drag.current) cancel();
      else if (!busy.current) endMaskEdit();
    };
    window.addEventListener("keydown", key, true);
    return () => {
      cancelAnimationFrame(raf);
      bounds.dispose();
      window.removeEventListener("keydown", key, true);
      cancel();
    };
  }, [composition.width, composition.height]);

  const down = (e: React.PointerEvent<SVGElement>, handle: MaskHandle) => {
    const g = geometry.current;
    if (e.button !== 0 || !g || busy.current) return;
    const grabN = clientToN({ x: e.clientX, y: e.clientY }, g.affine);
    if (!grabN) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = {
      pointer: e.pointerId, handle, start: g.params, grabN, tInLayerUs: g.tInLayerUs,
      affine: g.affine, aspect: g.aspect, gap: g.gap, draft: {},
    };
    svg.current!.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const n = clientToN({ x: e.clientX, y: e.clientY }, d.affine);
    if (!n) return;
    d.draft = dragMask(d.handle, d.start, d.grabN, n, d.aspect, d.gap, e.shiftKey);
    setTransientOverrides(live.current.effect.id, d.draft as Record<string, number>);
  };

  const up = async (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    move(e);
    svg.current?.releasePointerCapture(e.pointerId);
    const changed = (Object.entries(d.draft) as [keyof MaskParams, number][])
      .filter(([k, v]) => Math.abs(v - d.start[k]) > 1e-6);
    if (changed.length === 0) { cancel(); return; }
    const { layer: cur, effect: fx } = live.current;
    const entries: [string, AnimTrack<number>][] = changed.map(([k, v]) => [
      `effects[${fx.id}].params[${k}]`,
      autoKeyTrack(fx.params[k] ?? { mode: "Static", value: MASK_DEFAULTS[k] }, d.tInLayerUs, v),
    ]);
    busy.current = true;
    drag.current = null;
    // Mantém o override até o commit publicar, para a prévia não "piscar"
    // de volta ao valor antigo entre o soltar e o novo projeto chegar.
    try { await updateLayerParamTracks(cur.id, entries); }
    catch (err) { logMutationFailure(err, "Mask"); }
    finally { busy.current = false; clearTransientOverrides(fx.id); }
  };

  const handleProps = (id: MaskHandle) => ({
    "data-mask-handle": id,
    style: { pointerEvents: "all" as const, cursor: id === "move" ? "move" : id === "rotate" ? "grab" : id === "feather" ? "ns-resize" : "pointer" },
    onPointerDown: (e: React.PointerEvent<SVGGElement>) => down(e, id),
  });

  return (
    <svg
      ref={svg}
      data-testid="mask-overlay"
      aria-label={t("effects.mask_edit.title")}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", visibility: "hidden", touchAction: "none" }}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      onLostPointerCapture={() => { if (drag.current) cancel(); }}
    >
      <defs>
        <clipPath id={clipId}>
          <polygon data-mask-clip />
        </clipPath>
      </defs>
      <path data-mask-outline-shadow fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={3} clipPath={`url(#${clipId})`} />
      <path data-mask-outline fill="none" stroke="#fff" strokeWidth={1.5} strokeDasharray="6 4" clipPath={`url(#${clipId})`} />
      <line data-mask-stem stroke="#fff" strokeOpacity={0.7} strokeWidth={1} />
      <g {...handleProps("move")}>
        <circle r={14} fill="transparent" />
        <circle r={7} fill="rgba(0,0,0,0.35)" stroke="#fff" strokeWidth={1.5} />
        <circle r={2} fill="#fff" />
        <title>{t("effects.mask_edit.move")}</title>
      </g>
      {(["width", "height", "size"] as const).map((id) => (
        <g key={id} {...handleProps(id)}>
          <rect x={-11} y={-11} width={22} height={22} fill="transparent" />
          <rect x={-4.5} y={-4.5} width={9} height={9} rx={1.5} fill="#fff" stroke="#222" />
          <title>{t(`effects.mask_edit.${id}`)}</title>
        </g>
      ))}
      <g {...handleProps("rotate")}>
        <circle r={13} fill="transparent" />
        <circle r={6} fill="#fff" stroke="#222" />
        <path d="M-3 -1 A3.2 3.2 0 1 1 -1 3" fill="none" stroke="#222" strokeWidth={1.2} />
        <title>{t("effects.mask_edit.rotate")}</title>
      </g>
      <g {...handleProps("feather")}>
        <rect x={-12} y={-12} width={24} height={24} fill="transparent" />
        <path d="M0 -7 L4 -2 L1.4 -2 L1.4 2 L4 2 L0 7 L-4 2 L-1.4 2 L-1.4 -2 L-4 -2 Z" fill="#fff" stroke="#222" strokeWidth={0.8} />
        <title>{t("effects.mask_edit.feather")}</title>
      </g>
    </svg>
  );
}
