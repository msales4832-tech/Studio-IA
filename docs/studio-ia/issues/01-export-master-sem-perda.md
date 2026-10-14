# 01 — Export master sem segunda geração de perda

Status: resolvido (opção 1), aguardando teste com HEVC 10-bit real
Fase: 2 (R4)

## Problema

`docs/export.md` → "Proxies": para fontes que o WebCodecs não decodifica, o import gera uma
**export master** (`native/.../jobs/proxy.rs`): H.264 `-preset fast -crf 18 -profile:v high`, `yuv420p`.
A exportação decodifica essa master, não o original. Resultado:

- duas codificações com perda (master + entrega);
- fonte 10-bit (HEVC de celular, ProRes 422 10-bit) é reduzida para 8-bit 4:2:0 antes do export;
- HDR (PQ/HLG) passa por um H.264 8-bit.

Fontes que o WebCodecs decodifica (ex.: H.264 8-bit MP4 — o caso atual do usuário) usam DirectExport e leem o original: sem problema.

## Opções

1. Exportar dessas fontes pelo decodificador nativo (`@weftcut/native-decode`, ffmpeg) direto do original, sem master. Preferida.
2. Master intermediária sem perda/quase sem perda que preserve bit depth e croma (FFV1, ou ProRes 422 HQ / DNxHR HQX), decodificada pelo caminho nativo.
3. Paliativo: master com CRF ≤ 10 e `-preset slow`. Reduz, não elimina, a perda; continua 8-bit.

## Aceite

- Teste com fonte HEVC Main10: o export Master preserva 10-bit quando o codec de saída suporta.
- Relatório SSIM/PSNR original × export ≥ limiar definido em `SPEC.md` (R4).
- Nenhuma rota de export lê o quick proxy 720p (já garantido; manter teste).

## Comments

- 2026-10-14 — Opção 1 aplicada em `apps/desktop/src/renderer/render/exportDecodeRouting.ts`: no modo
  `auto`, rotas `proxied` exportam pelo decodificador nativo lendo o original (como `native-sw`).
  Sem o componente FFmpeg nativo, o comportamento antigo (master) continua como reserva.
  A master ainda é gerada no import; desligar essa geração quando o nativo está disponível
  economiza CPU e disco — próximo passo.
