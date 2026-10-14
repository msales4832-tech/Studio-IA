// Studio-IA: converts a CapCut `draft_content.json` into an ordered list of
// WeftCut MCP calls (docs/mcp.md). Pure — no I/O — so it is testable without
// the app. `import-capcut.mjs` executes the plan against the running editor.
//
// CapCut times are microseconds, the same unit as WeftCut's `*_us` fields.

import path from "node:path";

const PLACEHOLDER = /^##_draftpath_placeholder_[^#]*_##[\\/]?/;

/// CapCut stores media under the draft folder behind a placeholder token.
export function resolveMediaPath(raw, draftDir) {
  if (!raw) return null;
  const rel = raw.replace(PLACEHOLDER, "");
  if (rel !== raw) return path.join(draftDir, rel);
  return path.normalize(raw);
}

/// Speed as a reduced rational, which is what `retime_layers` takes.
export function speedToRate(speed) {
  const den = 1000;
  let num = Math.round(speed * den);
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

const PROJECT_RATES = [
  { num: 24000, den: 1001 }, { num: 24, den: 1 }, { num: 25, den: 1 },
  { num: 30000, den: 1001 }, { num: 30, den: 1 }, { num: 50, den: 1 },
  { num: 60000, den: 1001 }, { num: 60, den: 1 },
];

/// The nearest project rate `create_project` accepts — NTSC stays NTSC, so a
/// 29.97 draft is not silently re-timed to 30.
export function fpsToRational(fps) {
  if (typeof fps !== "number" || !(fps > 0)) return { num: 30, den: 1 };
  let best = PROJECT_RATES[0];
  for (const r of PROJECT_RATES) if (Math.abs(r.num / r.den - fps) < Math.abs(best.num / best.den - fps)) best = r;
  return best;
}

/// CapCut volume is a linear factor (1 = unchanged). 0 maps to the floor.
export function volumeToGainDb(volume) {
  if (volume === undefined || volume === null || volume === 1) return null;
  if (volume <= 0) return -60;
  return Math.max(-60, Math.round(20 * Math.log10(volume) * 100) / 100);
}

/// Text material `content` is a JSON string `{ text, styles }` in current
/// CapCut builds and plain text in older ones.
export function textOf(material) {
  const c = material?.content;
  if (typeof c !== "string") return material?.text ?? "";
  try {
    const parsed = JSON.parse(c);
    if (parsed && typeof parsed.text === "string") return parsed.text;
  } catch {
    // plain text
  }
  return c;
}

function byId(list) {
  const m = new Map();
  for (const item of list ?? []) m.set(item.id, item);
  return m;
}

/// Builds the plan. Placeholders `{ $media: key }`, `{ $track: n }` and
/// `{ $layer: n }` are resolved by the executor from earlier results.
export function buildPlan(draft, draftDir) {
  const m = draft.materials ?? {};
  const videos = byId(m.videos);
  const audios = byId(m.audios);
  const texts = byId(m.texts);
  const speeds = byId(m.speeds);

  const media = new Map(); // path -> key
  const steps = [];
  const warnings = [];
  let trackN = 0;
  let layerN = 0;

  const mediaKey = (p) => {
    if (!media.has(p)) {
      const key = `m${media.size}`;
      media.set(p, key);
      steps.push({ tool: "import_media", args: { path: p }, bind: { media: key } });
    }
    return media.get(p);
  };

  const segmentSpeed = (seg) => {
    for (const ref of seg.extra_material_refs ?? []) {
      const s = speeds.get(ref);
      if (s && typeof s.speed === "number") return s.speed;
    }
    return typeof seg.speed === "number" ? seg.speed : 1;
  };

  for (const track of draft.tracks ?? []) {
    const segs = (track.segments ?? []).filter((s) => s.target_timerange);
    if (segs.length === 0) continue;
    if (!["video", "audio", "text"].includes(track.type)) {
      warnings.push(`trilha "${track.type}" ignorada (${segs.length} segmento(s))`);
      continue;
    }
    const tn = trackN++;
    steps.push({ tool: "add_track", args: { label: `CapCut ${track.type} ${tn + 1}` }, bind: { track: tn } });

    for (const seg of segs) {
      const t0 = seg.target_timerange.start;
      const tDur = seg.target_timerange.duration;
      const src = seg.source_timerange ?? { start: 0, duration: tDur };
      const speed = segmentSpeed(seg);

      if (track.type === "text") {
        const mat = texts.get(seg.material_id);
        if (!mat) { warnings.push(`texto ${seg.material_id} sem material`); continue; }
        const ln = layerN++;
        steps.push({
          tool: "add_text_layer",
          args: { track_id: { $track: tn }, t_start_us: t0, t_end_us: t0 + tDur, content: textOf(mat) },
          bind: { layer: ln },
        });
        continue;
      }

      const mat = track.type === "video" ? videos.get(seg.material_id) : audios.get(seg.material_id);
      if (!mat) { warnings.push(`segmento ${seg.id ?? "?"} sem material`); continue; }
      const p = resolveMediaPath(mat.path, draftDir);
      if (!p) { warnings.push(`material ${mat.id} sem caminho`); continue; }
      const key = mediaKey(p);
      const isPhoto = mat.type === "photo";
      // Placed at 1x first (source span = timeline span); `retime_layers`
      // then keeps the start and source window and moves the end.
      const placeDur = speed !== 1 && !isPhoto ? src.duration : tDur;
      const ln = layerN++;
      steps.push({
        tool: track.type === "video" ? "add_video_layer" : "add_audio_layer",
        args: {
          track_id: { $track: tn },
          media_id: { $media: key },
          t_start_us: t0,
          t_end_us: t0 + placeDur,
          src_in_us: isPhoto ? 0 : src.start,
          src_out_us: isPhoto ? tDur : src.start + src.duration,
        },
        bind: { layer: ln },
      });
      if (speed !== 1 && !isPhoto) {
        steps.push({
          tool: "retime_layers",
          args: { layer_ids: [{ $layer: ln }], target: { kind: "Rate", value: speedToRate(speed) } },
        });
      }
      const gain = volumeToGainDb(seg.volume);
      if (gain !== null) {
        steps.push({
          tool: "update_layer_params",
          args: { layer_id: { $layer: ln, audio: track.type === "video" }, patch: { kind: "Audio", gain_db: gain } },
          optional: track.type === "video",
        });
      }
      const sc = seg.clip?.scale;
      if (track.type === "video" && sc && (sc.x !== 1 || sc.y !== 1)) {
        steps.push({
          tool: "update_layer_params",
          args: { layer_id: { $layer: ln }, patch: { kind: isPhoto ? "ImageOverlay" : "VideoClip", scale_x: sc.x, scale_y: sc.y } },
        });
      }
    }
  }

  const canvas = draft.canvas_config ?? {};
  return {
    project: {
      width: canvas.width,
      height: canvas.height,
      fps: fpsToRational(draft.fps),
      duration_us: draft.duration,
    },
    steps,
    warnings,
  };
}
