# Studio-IA — especificação

Fork pessoal do [WeftCut](https://github.com/WeftCut/WeftCut) (MIT). Objetivo: a leveza e a facilidade do
CapCut com a timeline e o profissionalismo do Adobe Premiere, operável por pessoa, Claude e Codex.

- Upstream: remote `upstream` (WeftCut). Nosso trabalho fica na branch `studio-ia`.
- Puxar melhorias do upstream com frequência; manter mudanças nossas isoladas para o merge ser fácil.

## Requisitos

### R1 — Operável por humano e por IA
- Toda ação da interface é um comando (já existe no WeftCut: catálogo MCP em localhost).
- Claude Code e Codex usam o mesmo MCP. `CLAUDE.md` e `AGENTS.md` apontam para esta SPEC.
- O projeto é dados versionáveis; toda edição tem undo/redo.

### R2 — Timeline igual à do Premiere
- Trilhas V (em cima) e A (embaixo) com divisória arrastável.
- Altura ajustável por trilha e global (Ctrl+rolagem, presets compacta/média/expandida).
- Cabeçalho: nome, cadeado, olho, M, S, sync lock, patch de trilha de destino (V1/A1).
- Áudio: forma de onda grande, linha de volume com keyframes, medidores VU, espectrograma opcional por clipe.
- Ferramentas e atalhos do Premiere (V, C, A, B ripple, N roll, Y slip, U slide, S snap, J/K/L, I/O, `,` insert, `.` overwrite, M marcador, `\` encaixar).
- Importar atalhos `.kys` do Premiere.
- Referência de UX: [FilmCraft](https://github.com/storytold/filmcraft) (Apache-2.0, clean-room do Premiere).

### R3 — Leveza do CapCut
- Painel de propriedades contextual à direita (só o que importa ao clipe selecionado).
- Ações de um clique: legendar, cortar silêncios, separar voz, aplicar template.
- Ferramentas avançadas disponíveis sem poluir a tela.
- Hardware alvo: 7,8 GB RAM, GPU integrada, Windows 11.

### R4 — Qualidade do original (inegociável)
- Originais nunca alterados; referência por caminho + hash.
- Proxy (540p) só para edição; **export nunca usa proxy** (bloqueio em código + teste).
- Composição herda resolução, fps exato, espaço de cor, bit depth e sample rate do original; avisar em mistura.
- Exportação: (a) sem perda / smart cut, (b) master em uma única codificação a partir dos originais, (c) presets de entrega gerados do master.
- Relatório de qualidade por export (SSIM/PSNR, VMAF quando disponível).

### R5 — Qualquer mídia
- Tudo que o FFmpeg decodifica: MP4, MOV, MKV, AVI, WebM, MTS, HEVC 10-bit/HDR, ProRes, DNxHD, VFR de celular; MP3, WAV, FLAC, AAC, M4A, OGG, Opus.
- Fora de escopo: BRAW, R3D, ProRes RAW.

### R6 — Interoperabilidade
- Importar/exportar: FCP7 XML (Premiere), EDL, OTIO, AAF (export de áudio), SRT/VTT, LUT `.cube`.
- Importar projeto do CapCut (`draft_content.json`: tracks/segments/materials, tempos em µs).
- `.prproj`: leitura experimental. `.mogrt`/`.aep`: não suportado (motor Adobe).

### R7 — Biblioteca de elementos (estilo Envato Elements)
- Banco local SQLite com busca por texto/tags (depois semântica) e licença por item.
- Fontes: Pexels, Pixabay, Freesound, Google Fonts, gl-transitions, arquivos do usuário e downloads do Envato (mídia, não templates Adobe).
- Templates próprios editáveis via Motifs do WeftCut (HTML/CSS/SVG).

### R8 — IA geradora por plugins
- Interfaces `gerar_imagem`, `gerar_video`, `gerar_voz`, `gerar_musica`; adaptadores por fornecedor (agregador fal.ai/Replicate primeiro).
- Registro de modelos em arquivo de configuração, atualizável sem mudar código.
- Prompt e parâmetros salvos no material gerado (regerar/variar).
- Chaves só em `.env` local, nunca no projeto nem no git. Limite de gasto por fornecedor.

### R9 — Voz e offline
- Edição 100% offline; IA geradora é online.
- Comandos de voz: push-to-talk, whisper.cpp, comandos fixos offline; pedidos livres via Claude.

## Fases

| Fase | Entrega |
|---|---|
| 0 | Fork compilando no Windows; SPEC; regras de agente |
| 1 | Layout e atalhos Premiere (R2) + painel contextual (R3) |
| 2 | Pipeline de qualidade: proxy, herança de formato, smart cut, relatório (R4) |
| 3 | Importadores: CapCut, FCP7 XML/OTIO, SRT, `.cube`, `.kys` (R6) |
| 4 | Biblioteca de elementos (R7) |
| 5 | Plugins de IA geradora (R8) |
| 6 | Voz (R9) e instalador |

## Doadores de código (licença permissiva — pode copiar com aviso)
FilmCraft (Apache-2.0), OpenTimelineIO + adaptadores FCP/AAF (Apache-2.0), Clypra (MIT), freecut (MIT),
capcut-cli (MIT), faster-whisper/whisper.cpp (MIT), auto-editor (Unlicense), PySceneDetect (BSD), demucs (MIT),
wavesurfer.js (BSD), mediabunny (MPL-2.0, por arquivo), gl-transitions (maioria MIT).

**Só estudo (GPL/AGPL — não copiar código):** LosslessCut, Shotcut, Kdenlive, MLT (LGPL: só como biblioteca), Olive, Concat, OpenChatCut.
Todo código copiado registra origem e licença em `THIRD-PARTY-NOTICES.md`.
