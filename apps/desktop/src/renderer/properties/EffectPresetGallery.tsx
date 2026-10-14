// Studio-IA: a grade de "efeitos prontos" do painel Efeito — o equivalente da
// aba Efeitos do CapCut. Cada cartão mostra a miniatura renderizada pelos
// filtros reais e aplica o look inteiro num clique (um passo de desfazer).
// Os efeitos aplicados entram na cadeia normal e continuam ajustáveis.

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addEffectPreset, type LayerSummary } from "../ipc";
import { refusalText } from "../errors/tryMutate";
import {
  EFFECT_PRESETS,
  PRESET_CATEGORY_ORDER,
  type PresetCategory,
} from "../../shared/effects/studioPresets";
import { renderPresetThumbnails, THUMB_H, THUMB_W } from "../render/effects/presetThumbnails";
import { useLayerReadOnly } from "./LayerEditing";

export function EffectPresetGallery({
  layer,
  onMutated,
  onApplied,
}: {
  layer: LayerSummary;
  onMutated: () => Promise<void>;
  /// Chamado depois de aplicar, para o painel mostrar a cadeia resultante.
  onApplied?: () => void;
}) {
  const { t } = useTranslation();
  const readOnly = useLayerReadOnly();
  const [category, setCategory] = useState<PresetCategory | "all">("all");
  const [thumbs, setThumbs] = useState<Map<string, string> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void renderPresetThumbnails(EFFECT_PRESETS.map((p) => p.id)).then((m) => {
      if (alive) setThumbs(new Map(m));
    });
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(
    () => EFFECT_PRESETS.filter((p) => category === "all" || p.category === category),
    [category],
  );

  const apply = async (id: string) => {
    if (readOnly || busy) return;
    setErr(null);
    setBusy(id);
    try {
      await addEffectPreset(layer.id, id);
      await onMutated();
      onApplied?.();
    } catch (e) {
      setErr(refusalText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="studio-presets" data-testid="effect-presets">
      <div className="studio-presets-tabs" role="tablist" aria-label={t("effects.presets.categories")}>
        {(["all", ...PRESET_CATEGORY_ORDER] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            className={category === c ? "studio-presets-tab is-active" : "studio-presets-tab"}
            onClick={() => setCategory(c)}
          >
            {t(`effects.presets.category.${c}`)}
          </button>
        ))}
      </div>
      <div className="studio-presets-grid">
        {shown.map((p) => {
          const name = t(`effects.presets.items.${p.id}`, { defaultValue: p.id });
          const src = thumbs?.get(p.id);
          return (
            <button
              key={p.id}
              type="button"
              className="studio-preset-card"
              data-testid={`effect-preset-${p.id}`}
              disabled={readOnly || busy !== null}
              aria-busy={busy === p.id}
              title={t("effects.presets.apply", { name })}
              onClick={() => void apply(p.id)}
            >
              {src ? (
                <img src={src} width={THUMB_W} height={THUMB_H} alt="" draggable={false} />
              ) : (
                <span className="studio-preset-placeholder" aria-hidden="true" />
              )}
              <span className="studio-preset-name">{name}</span>
            </button>
          );
        })}
      </div>
      <p className="studio-presets-hint">{t("effects.presets.hint")}</p>
      {err && <p className="settings-error">{err}</p>}
    </section>
  );
}
