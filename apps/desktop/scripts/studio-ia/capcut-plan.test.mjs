import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { buildPlan, fpsToRational, resolveMediaPath, speedToRate, textOf, volumeToGainDb } from "./capcut-plan.mjs";

const DRAFT_DIR = path.join("C:", "drafts", "demo");

const draft = {
  fps: 30,
  duration: 10_000_000,
  canvas_config: { width: 1920, height: 1080 },
  materials: {
    videos: [
      { id: "v1", type: "video", path: "C:/media/cam.mp4" },
      { id: "p1", type: "photo", path: "##_draftpath_placeholder_ABC_##/Resources/foto.png" },
    ],
    audios: [{ id: "a1", path: "C:/media/musica.mp3" }],
    texts: [{ id: "t1", content: JSON.stringify({ text: "Olá", styles: [] }) }],
    speeds: [{ id: "s2", speed: 2 }],
  },
  tracks: [
    {
      type: "video",
      segments: [
        { id: "seg1", material_id: "v1", target_timerange: { start: 0, duration: 4_000_000 }, source_timerange: { start: 1_000_000, duration: 4_000_000 }, volume: 0.5, clip: { scale: { x: 1, y: 1 } } },
        { id: "seg2", material_id: "v1", extra_material_refs: ["s2"], target_timerange: { start: 4_000_000, duration: 2_000_000 }, source_timerange: { start: 0, duration: 4_000_000 } },
        { id: "seg3", material_id: "p1", target_timerange: { start: 6_000_000, duration: 3_000_000 }, clip: { scale: { x: 1.5, y: 1.5 } } },
      ],
    },
    { type: "audio", segments: [{ id: "seg4", material_id: "a1", target_timerange: { start: 0, duration: 9_000_000 }, source_timerange: { start: 0, duration: 9_000_000 } }] },
    { type: "text", segments: [{ id: "seg5", material_id: "t1", target_timerange: { start: 500_000, duration: 1_000_000 } }] },
    { type: "effect", segments: [{ id: "seg6", target_timerange: { start: 0, duration: 1 } }] },
    { type: "audio", segments: [] },
  ],
};

test("resolveMediaPath troca o placeholder pela pasta do projeto", () => {
  assert.equal(
    resolveMediaPath("##_draftpath_placeholder_ABC_##/Resources/x.mp4", DRAFT_DIR),
    path.join(DRAFT_DIR, "Resources/x.mp4"),
  );
  assert.equal(resolveMediaPath("", DRAFT_DIR), null);
});

test("helpers de velocidade, volume e texto", () => {
  assert.deepEqual(speedToRate(2), { num: 2, den: 1 });
  assert.deepEqual(speedToRate(0.5), { num: 1, den: 2 });
  assert.equal(volumeToGainDb(1), null);
  assert.equal(volumeToGainDb(0), -60);
  assert.equal(volumeToGainDb(0.5), -6.02);
  assert.equal(textOf({ content: "simples" }), "simples");
  assert.equal(textOf({ content: '{"text":"A"}' }), "A");
});

test("buildPlan gera as chamadas na ordem certa", () => {
  const plan = buildPlan(draft, DRAFT_DIR);
  const tools = plan.steps.map((s) => s.tool);
  assert.deepEqual(tools, [
    "add_track",
    "import_media",
    "add_video_layer",
    "update_layer_params", // volume 0.5 no áudio pareado
    "add_video_layer",
    "retime_layers",
    "import_media",
    "add_video_layer",
    "update_layer_params", // escala da foto
    "add_track",
    "import_media",
    "add_audio_layer",
    "add_track",
    "add_text_layer",
  ]);
  assert.deepEqual(plan.project, { width: 1920, height: 1080, fps: { num: 30, den: 1 }, duration_us: 10_000_000 });
  assert.equal(plan.warnings.length, 1);
});

test("segmento acelerado é colocado em 1x e depois retimed", () => {
  const plan = buildPlan(draft, DRAFT_DIR);
  const fast = plan.steps.filter((s) => s.tool === "add_video_layer")[1];
  assert.equal(fast.args.t_start_us, 4_000_000);
  assert.equal(fast.args.t_end_us, 8_000_000);
  assert.equal(fast.args.src_out_us, 4_000_000);
  const retime = plan.steps.find((s) => s.tool === "retime_layers");
  assert.deepEqual(retime.args.target, { kind: "Rate", value: { num: 2, den: 1 } });
  assert.deepEqual(retime.args.layer_ids, [{ $layer: fast.bind.layer }]);
});

test("mídia repetida é importada uma vez só e foto usa janela de 0", () => {
  const plan = buildPlan(draft, DRAFT_DIR);
  const imports = plan.steps.filter((s) => s.tool === "import_media").map((s) => s.args.path);
  assert.equal(imports.length, 3);
  const photo = plan.steps.filter((s) => s.tool === "add_video_layer")[2];
  assert.equal(photo.args.src_in_us, 0);
  assert.equal(photo.args.src_out_us, 3_000_000);
  assert.equal(photo.args.t_end_us, 9_000_000);
});

test("fpsToRational mantém NTSC", () => {
  assert.deepEqual(fpsToRational(29.97002997002997), { num: 30000, den: 1001 });
  assert.deepEqual(fpsToRational(30), { num: 30, den: 1 });
  assert.deepEqual(fpsToRational(23.976), { num: 24000, den: 1001 });
  assert.deepEqual(fpsToRational(undefined), { num: 30, den: 1 });
});
