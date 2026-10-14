# Importar projeto do CapCut

Com o editor aberto (`npm run dev`), em `apps/desktop`:

```bash
node scripts/studio-ia/import-capcut.mjs "%LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft\<projeto>" --novo "<nome>" --em "<pasta>"
```

- Sem `--novo`, os clipes entram no projeto já aberto.
- `--dry` mostra o plano (JSON) sem tocar no editor.
- Conversor puro: `scripts/studio-ia/capcut-plan.mjs` (testes: `node --test scripts/studio-ia/capcut-plan.test.mjs`).

## O que passa

| CapCut | Editor |
|---|---|
| Trilhas de vídeo, áudio e texto | Uma trilha por trilha, na mesma ordem |
| Segmento (tempo na timeline e na origem, µs) | `add_video_layer` / `add_audio_layer` / `add_text_layer` |
| Foto | Clipe de imagem |
| Velocidade | `retime_layers` com taxa racional |
| Volume | `gain_db` (linear → dB, piso −60) |
| Escala | `scale_x` / `scale_y` |
| Tela e fps | `create_project` com a taxa suportada mais próxima (29,97 → 30000/1001) |

## Ainda não passa

Posição (transform), rotação, keyframes, efeitos, filtros, transições, animações de texto,
estilo de texto, máscaras, trilhas de efeito/sticker. Mídia ausente no disco é pulada com aviso.

Validado em 2026-10-14 com "Musical Área 03 oficial": 141 operações, 135 textos, 29,97 fps mantido.
