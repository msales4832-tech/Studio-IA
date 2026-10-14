import { create } from 'zustand';

// Studio-IA: qual máscara está sendo editada na prévia. Só sessão — o que vai
// para o projeto são os parâmetros do efeito, gravados ao soltar o arrasto.
export const useMaskEditingStore = create<{ layerId: string | null; effectId: string | null }>(
  () => ({ layerId: null, effectId: null }),
);

export function beginMaskEdit(layerId: string, effectId: string): void {
  useMaskEditingStore.setState({ layerId, effectId });
}
export function endMaskEdit(): void {
  useMaskEditingStore.setState({ layerId: null, effectId: null });
}
