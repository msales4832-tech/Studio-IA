// Studio-IA: os controles da máscara no estilo do CapCut — formas como ícones
// (em vez de "Forma 0–5"), inverter num botão e "Editar na prévia", que liga
// as alças em cima do vídeo (preview/MaskOverlay.tsx). Os demais parâmetros
// (posição, tamanho, giro, suavizar, cantos) seguem nos campos numéricos, que
// aceitam keyframes.

import { useTranslation } from "react-i18next";
import { Circle, Contrast, Heart, Minus, MousePointer2, RectangleHorizontal, Rows3, Star, type LucideIcon } from "lucide-react";
import { updateLayerParamTracks, trackStatic, type EffectView, type LayerSummary } from "../ipc";
import { refusalText } from "../errors/tryMutate";
import { beginMaskEdit, endMaskEdit, useMaskEditingStore } from "../state/maskEditingStore";
import { AppIcon } from "@/components/AppIcon";
import { useState } from "react";
import { useLayerReadOnly } from "./LayerEditing";

export const MASK_CONTROL_KEYS: readonly string[] = ["shape", "invert"];

const SHAPES: Array<{ value: number; icon: LucideIcon; key: string }> = [
  { value: 0, icon: Minus, key: "linear" },
  { value: 1, icon: Rows3, key: "band" },
  { value: 2, icon: Circle, key: "circle" },
  { value: 3, icon: RectangleHorizontal, key: "rectangle" },
  { value: 4, icon: Star, key: "star" },
  { value: 5, icon: Heart, key: "heart" },
];

export function MaskControls({
  layer,
  effect,
  onMutated,
}: {
  layer: LayerSummary;
  effect: EffectView;
  onMutated: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const readOnly = useLayerReadOnly();
  const [err, setErr] = useState<string | null>(null);
  const editing = useMaskEditingStore((s) => s.effectId === effect.id && s.layerId === layer.id);
  const shape = Math.round(effect.params.shape ? trackStatic(effect.params.shape, 2) : 2);
  const inverted = (effect.params.invert ? trackStatic(effect.params.invert, 0) : 0) > 0.5;

  const write = (key: string, value: number) => {
    setErr(null);
    updateLayerParamTracks(layer.id, [[`effects[${effect.id}].params[${key}]`, { mode: "Static", value }]])
      .then(onMutated)
      .catch((e) => setErr(refusalText(e)));
  };

  return (
    <div className="studio-mask-controls">
      <div className="studio-mask-shapes" role="radiogroup" aria-label={t("effects.mask_edit.shape")}>
        {SHAPES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={shape === s.value}
            disabled={readOnly}
            data-testid={`mask-shape-${s.key}`}
            className={shape === s.value ? "studio-mask-shape is-active" : "studio-mask-shape"}
            title={t(`effects.mask_edit.shapes.${s.key}`)}
            aria-label={t(`effects.mask_edit.shapes.${s.key}`)}
            onClick={() => write("shape", s.value)}
          >
            <AppIcon icon={s.icon} size="body" />
          </button>
        ))}
      </div>
      <div className="studio-mask-actions">
        <button
          type="button"
          disabled={readOnly}
          aria-pressed={inverted}
          data-testid="mask-invert"
          className={inverted ? "studio-mask-action is-active" : "studio-mask-action"}
          onClick={() => write("invert", inverted ? 0 : 1)}
        >
          <AppIcon icon={Contrast} size="label" />
          {t("effects.mask_edit.invert")}
        </button>
        <button
          type="button"
          disabled={readOnly}
          aria-pressed={editing}
          data-testid="mask-edit-preview"
          className={editing ? "studio-mask-action is-active" : "studio-mask-action"}
          onClick={() => {
            if (editing) endMaskEdit();
            // O painel Efeito mostra a camada principal da seleção, então
            // ela já é a que a prévia desenha.
            else beginMaskEdit(layer.id, effect.id);
          }}
        >
          <AppIcon icon={MousePointer2} size="label" />
          {editing ? t("effects.mask_edit.done") : t("effects.mask_edit.start")}
        </button>
      </div>
      {err && <p className="settings-error">{err}</p>}
    </div>
  );
}
