// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "../i18n";
import type { EffectView, LayerSummary } from "../ipc";

const writes: unknown[] = [];
vi.mock("../ipc", async (orig) => ({
  ...(await orig<typeof import("../ipc")>()),
  updateLayerParamTracks: vi.fn(async (layerId: string, entries: unknown) => { writes.push([layerId, entries]); }),
}));

import { MaskControls } from "./MaskControls";
import { endMaskEdit, useMaskEditingStore } from "../state/maskEditingStore";

afterEach(() => { cleanup(); writes.length = 0; endMaskEdit(); });

const layer = { id: "L1", effects: [] } as unknown as LayerSummary;
const effect: EffectView = { id: "E1", kind: "mask", enabled: true, params: {} } as EffectView;

describe("MaskControls (Studio-IA)", () => {
  it("formas como botões: estrela grava shape = 4", async () => {
    render(<MaskControls layer={layer} effect={effect} onMutated={async () => {}} />);
    expect(screen.getByTestId("mask-shape-circle").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByTestId("mask-shape-star"));
    await Promise.resolve();
    expect(writes).toEqual([["L1", [["effects[E1].params[shape]", { mode: "Static", value: 4 }]]]]);
  });

  it("inverter alterna 0 ↔ 1", async () => {
    render(<MaskControls layer={layer} effect={effect} onMutated={async () => {}} />);
    fireEvent.click(screen.getByTestId("mask-invert"));
    await Promise.resolve();
    expect(writes).toEqual([["L1", [["effects[E1].params[invert]", { mode: "Static", value: 1 }]]]]);
  });

  it("Editar na prévia liga e desliga a edição desta máscara", () => {
    render(<MaskControls layer={layer} effect={effect} onMutated={async () => {}} />);
    fireEvent.click(screen.getByTestId("mask-edit-preview"));
    expect(useMaskEditingStore.getState()).toEqual({ layerId: "L1", effectId: "E1" });
    fireEvent.click(screen.getByTestId("mask-edit-preview"));
    expect(useMaskEditingStore.getState().layerId).toBeNull();
  });
});
