#!/usr/bin/env node
// Studio-IA: imports a CapCut project into the editor that is open right now,
// through its MCP endpoint (docs/mcp.md). Usage:
//
//   node scripts/studio-ia/import-capcut.mjs "<pasta do projeto CapCut>" [--dry] [--novo "<nome>" --em "<pasta>"]
//
// --dry   prints the plan without touching the editor.
// --novo  creates a project with the CapCut canvas first (otherwise the
//         project already open receives the clips).

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { buildPlan } from "./capcut-plan.mjs";

function args(argv) {
  const out = { dir: null, dry: false, novo: null, em: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry") out.dry = true;
    else if (a === "--novo") out.novo = argv[++i];
    else if (a === "--em") out.em = argv[++i];
    else out.dir = a;
  }
  return out;
}

/// The newest mcp_auth.json wins. Besides %APPDATA%\WeftCut, an editor
/// started from an MSIX-packaged host (e.g. the Claude desktop terminal) has
/// its Roaming folder redirected under %LOCALAPPDATA%\Packages\<pkg>\LocalCache.
export function authCandidates(env = process.env) {
  const appData = env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
  const local = env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  const dirs = [env.WEFTCUT_USERDATA, path.join(appData, "WeftCut"), path.join(appData, "@weftcut", "desktop")];
  const pkgs = path.join(local, "Packages");
  if (fs.existsSync(pkgs)) {
    for (const p of fs.readdirSync(pkgs)) dirs.push(path.join(pkgs, p, "LocalCache", "Roaming", "WeftCut"));
  }
  return dirs.filter(Boolean).map((d) => path.join(d, "mcp_auth.json")).filter((f) => fs.existsSync(f));
}

function readAuths() {
  const files = authCandidates().sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (files.length === 0) throw new Error("Editor nunca foi aberto neste PC (mcp_auth.json não encontrado). Abra o editor e tente de novo.");
  return files.map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
}

/// Tries every candidate endpoint, newest first: a stale file from another
/// launch context points at a port nobody listens on.
async function connect() {
  let last;
  for (const auth of readAuths()) {
    const client = new Client({ name: "studio-ia-import-capcut", version: "0.1.0" });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${auth.port}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${auth.token}` } },
      }));
      return client;
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`Não consegui conectar ao editor. Ele está aberto? (${last?.message ?? "sem detalhes"})`);
}

function payload(result) {
  if (result.structuredContent) return result.structuredContent;
  const text = result.content?.find((c) => c.type === "text")?.text;
  try { return text ? JSON.parse(text) : {}; } catch { return { text }; }
}

function layerIds(r) {
  const main = r.video_layer_id ?? r.layer_id ?? r.id ?? r.layer?.id ?? null;
  return { main, audio: r.audio_layer_id ?? null };
}

async function main() {
  const opt = args(process.argv.slice(2));
  if (!opt.dir) {
    console.error('Uso: node scripts/studio-ia/import-capcut.mjs "<pasta do projeto CapCut>" [--dry] [--novo "<nome>" --em "<pasta>"]');
    process.exit(2);
  }
  const draftFile = path.join(opt.dir, "draft_content.json");
  const plan = buildPlan(JSON.parse(fs.readFileSync(draftFile, "utf8")), opt.dir);

  const missing = new Set(plan.steps.filter((s) => s.tool === "import_media" && !fs.existsSync(s.args.path)).map((s) => s.bind.media));
  for (const s of plan.steps) if (s.tool === "import_media" && missing.has(s.bind.media)) plan.warnings.push(`arquivo não encontrado: ${s.args.path}`);

  if (opt.dry) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  const client = await connect();

  const call = async (name, a) => {
    const r = await client.callTool({ name, arguments: a });
    const p = payload(r);
    if (r.isError) throw new Error(`${name}: ${p.message ?? JSON.stringify(p)}`);
    return p;
  };

  if (opt.novo) {
    const { width, height, fps } = plan.project;
    await call("create_project", { name: opt.novo, ...(opt.em ? { parent_folder: opt.em } : {}), width, height, fps });
    console.log(`Projeto criado: ${opt.novo}`);
  }

  const bound = { media: new Map(), info: new Map(), track: new Map(), layer: new Map() };
  let skipped = 0;
  let done = 0;

  const resolve = (v) => {
    if (Array.isArray(v)) return v.map(resolve);
    if (v && typeof v === "object") {
      if ("$media" in v) return need(bound.media, v.$media);
      if ("$track" in v) return need(bound.track, v.$track);
      if ("$layer" in v) {
        const ids = need(bound.layer, v.$layer);
        const id = v.audio ? ids.audio : ids.main;
        if (id == null) throw new Skip();
        return id;
      }
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)]));
    }
    return v;
  };
  class Skip extends Error {}
  const need = (map, key) => {
    if (!map.has(key)) throw new Skip();
    return map.get(key);
  };

  for (const step of plan.steps) {
    if (step.tool === "import_media" && missing.has(step.bind.media)) { skipped++; continue; }
    let a;
    try { a = resolve(step.args); } catch (e) { if (e instanceof Skip) { skipped++; continue; } throw e; }
    // CapCut source windows can overrun the probed media by a few ms; clamp
    // to the real duration and shorten the clip by the same amount.
    const info = step.args.media_id && bound.info.get(step.args.media_id.$media);
    if (info && info.duration_us > 0 && info.kind !== "Image" && a.src_out_us > info.duration_us) {
      const over = a.src_out_us - info.duration_us;
      a.src_out_us = info.duration_us;
      a.t_end_us -= over;
    }
    try {
      const r = await call(step.tool, a);
      if (step.bind?.media) bound.media.set(step.bind.media, r.media_id);
      if (step.bind?.media) bound.info.set(step.bind.media, { duration_us: r.duration_us, kind: r.kind });
      if (step.bind?.track !== undefined) bound.track.set(step.bind.track, r.track_id);
      if (step.bind?.layer !== undefined) bound.layer.set(step.bind.layer, layerIds(r));
      done++;
    } catch (e) {
      if (step.optional) { skipped++; continue; }
      plan.warnings.push(e.message);
      skipped++;
    }
  }

  await client.close();
  console.log(`Importação concluída: ${done} operações, ${skipped} puladas.`);
  for (const w of plan.warnings) console.log(`  aviso: ${w}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
