# 05 — Remover fundo (IA) com qualidade de After Effects

Status: viabilidade avaliada, arquitetura definida, não implementado
Fase: 4–5 (R3 + R4)

## Objetivo

Recortar a pessoa ou o objeto do fundo com borda fina (cabelo, desfoque de
movimento, semitransparência) e controles de refino como os do After Effects
(Roto Brush + Refine Edge): encolher/expandir, suavizar, contraste da borda,
deslocar a borda e descontaminar a cor. O CapCut faz isso em um clique, mas
com borda dura e tremida. Queremos o clique do CapCut com a borda do AE.

## Conclusão da viabilidade

**Viável, mas como processamento em segundo plano com cache, e não em tempo
real.** No hardware alvo (7,8 GB de RAM e GPU integrada), nenhum modelo de
qualidade alta roda a 30 quadros por segundo. O fluxo é: processar uma vez
(minutos), guardar a máscara e depois reproduzir e exportar a partir do cache.
O CapCut faz igual ("processando…").

## Modelos (só licença permissiva, regra do SPEC)

| Modelo | Licença | Para quê | Observação |
|---|---|---|---|
| **BiRefNet** (general / matting / HR-matting / lite) | MIT | Recorte automático com matte suave (cabelo) | ONNX disponível. HR-matting trabalha a 2048², com FP16 de 450 MB. A 1024² em FP16 usa cerca de 3,45 GB de VRAM. |
| **SAM 2.1** | Apache-2.0 | Clicar no objeto e propagar pelo vídeo (equivale ao Roto Brush) | Máscara binária: precisa de refino de borda depois |
| **ViTMatte** (S/B) | MIT | Refinar a borda a partir de um trimap (a parte "Refine Edge") | Usa o trimap gerado pela máscara do SAM/BiRefNet |
| RobustVideoMatting | **GPL-3.0** | Matting de vídeo em tempo real | **Proibido copiar** (só estudo) |
| MatAnyone | não confirmada (indício de não comercial) | Matting de vídeo estável | Só estudo até confirmar |
| BRIA RMBG-2.0 | CC BY-NC | Recorte | Não comercial: fora |

Fontes:
- BiRefNet HR-matting ONNX (licença MIT, tamanhos e saída alpha): https://huggingface.co/PinkPixel/birefnet-hr-matting-onnx
- Consumo de 3,45 GB a 1024² em FP16: https://www.sourcepulse.org/projects/1187396
- SAM 2 ONNX (Apache-2.0): https://huggingface.co/vietanhdev/segment-anything-2-onnx-models
- ViTMatte (MIT): https://github.com/hustvl/ViTMatte
- RVM (GPL-3.0): https://github.com/PeterL1n/RobustVideoMatting

## Arquitetura proposta

1. **Job "Remover fundo"** no main, numa worker thread. Lê o arquivo ORIGINAL
   pelo ffmpeg que o app já usa (R4: nunca o proxy) e roda o modelo pelo
   `onnxruntime-node` (MIT): DirectML na GPU integrada do Windows, ou CPU como
   reserva. O processamento é em 1024 px no lado maior.
   - Modo automático: BiRefNet-matting em todo quadro.
   - Modo "clicar no objeto": SAM 2 propaga a máscara, BiRefNet ou ViTMatte
     refinam a borda (trimap = faixa em volta da borda do SAM).
2. **Estabilidade temporal:** média móvel do matte guiada pelo movimento
   (diferença entre quadros). Tira o "tremido" da borda, que é o principal
   defeito do CapCut.
3. **Cache:** o matte é guardado em cinza 8-bit, a 1024 px, sem perda (PNG
   por quadro ou FFV1 gray), com hash do original e dos parâmetros. O
   original nunca é alterado.
4. **Efeito `bgremove`** (categoria Recorte), com estes parâmetros:
   - encolher/expandir;
   - suavizar;
   - contraste da borda;
   - deslocar a borda;
   - descontaminar a cor (reaproveita o despill do `chromakey`);
   - ver o matte.

   O shader faz o **upsample guiado** (joint bilateral / guided filter) do
   matte de 1024 para a resolução cheia, usando o quadro original como guia.
   É isso que devolve a borda fina na resolução de export sem processar o
   modelo em 4K.
5. **Integração no render:** o EffectChain precisa de uma segunda textura (o
   matte do quadro atual). A prévia carrega o quadro do cache de forma
   assíncrona; o export **espera** o matte do quadro antes de compor. Isso é
   obrigatório para o export ser determinístico. É o maior risco técnico (ver
   abaixo).

## Estimativas (ESTIMATIVA, ainda não medidas nesta máquina)

- BiRefNet-lite a 1024 na GPU integrada (DirectML): cerca de 0,3 a 1 s por
  quadro. Um clipe de 30 s a 30 fps leva de 5 a 15 min.
- BiRefNet-matting completo: de 3 a 5 vezes mais lento.
- Medir antes de prometer: o primeiro passo é um benchmark com 30 quadros
  reais do usuário.

## Etapas

1. Benchmark: script que roda BiRefNet-lite e BiRefNet-matting em 30 quadros
   de um clipe do usuário e mede tempo, RAM e qualidade da borda.
2. Job + cache + efeito `bgremove` com upsample guiado (modo automático).
3. Estabilidade temporal e controles de refino.
4. Modo "clicar no objeto" (SAM 2) para objetos que não são pessoas.
5. Download opcional do modelo pelo catálogo de conteúdo (`content-catalog.ts`,
   o mesmo caminho da fala). O instalador continua sem pesos de modelo.

## Aceite

- Cabelo solto sobre fundo complexo, em 1080p: a borda não "anda" entre
  quadros e a comparação visual com o Roto Brush do AE é aceitável para o
  usuário.
- O export usa o original e o matte em cache, e repetir o export dá
  resultado idêntico, bit a bit.
- Funciona offline depois de baixar o modelo; processa em segundo plano e
  pode ser cancelado.

## Riscos

- Segunda textura por quadro no EffectChain: hoje um filtro só recebe a
  própria camada. Precisa de um "input" extra sincronizado com o tempo da
  camada, tanto na prévia quanto no export.
- Memória: o modelo completo, o app e o ffmpeg juntos podem passar de
  7,8 GB. Começar pelo lite.
- O hardware pode ser lento demais para o modelo completo. Nesse caso, ficar
  no lite com upsample guiado.
