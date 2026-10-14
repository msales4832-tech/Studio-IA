# 03 — J/K/L completo (shuttle e reprodução reversa)

Status: parcial — K (pausar) e L (reproduzir) feitos em 2026-10-14
Fase: 1 (R2)

## Falta

- L repetido: 2×, 4×, 8×; J repetido: ré 1×, 2×, 4×; K+J / K+L: um quadro por vez.
- O transporte (`transportPlay`/`transportPause`, `usePlaybackStore`) não tem taxa de reprodução
  nem direção. Precisa de taxa no relógio de áudio (Web Audio `playbackRate` ou reamostragem) e
  decodificação reversa por GOP (proxy de GOP curto ajuda).

## Aceite

- J/K/L se comportam como no Premiere, com áudio acompanhando em 1× e mudo acima de 2×.
