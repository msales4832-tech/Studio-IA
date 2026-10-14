// Contextual per-Layer effect-chain Panel. This boundary owns the chain and
// nothing else; kind-specific Layer fields remain in AttributePanel.
//
// Which catalog a layer edits is decided HERE, once: an Audio layer's effects
// are offline bakes (`src/shared/audioEffects`, ADR 0063) and a visual layer's
// are realtime Pixi filters. Two lifecycles, one card surface.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { type TrackSummary } from "../ipc";
import {
  audioCatalogForUi,
  EffectsSection,
} from "../properties/EffectsSection";
import { listEffects } from "../render/effects/effectRegistry";
import { EffectPresetGallery } from "../properties/EffectPresetGallery";
import { findPanelLayer } from "./panelLayer";
import { LayerReadOnly } from "../properties/LayerEditing";
import { layerIsReadOnly } from "../state/layerEditability";

export interface EffectPanelProps {
  tracks: TrackSummary[];
  selectedLayerId: string | null;
  currentTimeUs: number;
  onMutated: () => Promise<void>;
}

export function EffectPanel({
  tracks,
  selectedLayerId,
  currentTimeUs,
  onMutated,
}: EffectPanelProps) {
  const { t } = useTranslation();
  // Studio-IA: aba "Prontos" (galeria) ou "Ajustes" (a cadeia). null = a
  // escolha automática: galeria quando a cadeia está vazia.
  const [tab, setTab] = useState<"presets" | "chain" | null>(null);
  // A scan of every track's layers, so it is memoised rather than re-run on
  // each unrelated re-render — the same shape `AttributePanel` uses.
  const layer = useMemo(
    () => findPanelLayer(tracks, selectedLayerId),
    [tracks, selectedLayerId],
  );

  // An empty selection gets an explicit Panel body, so the chain is never an
  // unexplained blank area.
  if (!layer) {
    return (
      <aside
        className="property-panel effect-panel"
        aria-label={t("effects.heading")}
      >
        <p className="placeholder">{t("effects.empty")}</p>
      </aside>
    );
  }

  const tInLayerUs = currentTimeUs - layer.t_start_us;
  const activeTab =
    layer.params.kind === "Audio" ? "chain" : (tab ?? (layer.effects.length === 0 ? "presets" : "chain"));
  const playheadInSpan =
    currentTimeUs >= layer.t_start_us && currentTimeUs < layer.t_end_us;

  return (
    <aside
      className="property-panel effect-panel"
      aria-label={t("effects.heading")}
    >
      <LayerReadOnly value={layerIsReadOnly(tracks, layer.id)}>
      {layer.params.kind !== "Audio" && (
        <div className="studio-effect-tabs" role="tablist">
          {(["presets", "chain"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={activeTab === k}
              data-testid={`effect-tab-${k}`}
              className={activeTab === k ? "studio-effect-tab is-active" : "studio-effect-tab"}
              onClick={() => setTab(k)}
            >
              {k === "presets"
                ? t("effects.presets.tab")
                : t("effects.presets.chain_tab", { count: layer.effects.length })}
            </button>
          ))}
        </div>
      )}
      {activeTab === "presets" ? (
        <EffectPresetGallery layer={layer} onMutated={onMutated} onApplied={() => setTab("chain")} />
      ) : (
        <EffectsSection
          layer={layer}
          catalog={layer.params.kind === "Audio" ? audioCatalogForUi : listEffects()}
          tInLayerUs={tInLayerUs}
          playheadInSpan={playheadInSpan}
          onMutated={onMutated}
        />
      )}
      </LayerReadOnly>
    </aside>
  );
}
