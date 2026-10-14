# 04 — Paridade com o catálogo do CapCut

Status: em andamento
Fase: 3–5

Levantado do CapCut 9.5 instalado (`Resources\DefaultAdjustBundle`, `MixMode`, `lut`, `Curves`,
`rule_adjust_mask`, `matting*`) e dos efeitos baixados pelo usuário (`User Data\Cache\effect`).
Tudo é recriado do zero — nenhum shader ou asset do CapCut é copiado.

## Feito (2026-10-14, commit 4d8ca6dc)

Preto e branco, sépia, temperatura, tom, matiz, esmaecer, realces/sombras, vinheta, pixelizar,
separação RGB, espelho, máscara (linear/faixa/círculo/retângulo), giro 3D.

## Próximos, por impacto

1. **Remover fundo (IA)** — modelo de matting ONNX (RobustVideoMatting/MODNet) rodando na CPU como
   job de fundo, gerando máscara alpha em cache; aplicado como efeito "Remover fundo". Lento no
   notebook (sem GPU dedicada): processa uma vez, depois reproduz do cache.
2. **Animações de entrada/saída/loop** (CapCut "Animação") — presets de keyframes: surgir, zoom,
   deslizar, girar, quicar, balançar.
3. **Efeitos com tempo** — precisam de um uniform de tempo no ShaderEffectFilter: tremor, glitch,
   flash, brilho nas bordas, raios de luz, brilhos/estrelas, granulado animado.
4. **Filtros prontos (looks)** — presets que combinam vários ajustes num clique, com intensidade.
5. **Modos de mesclagem** (MixMode) — multiplicar, tela, sobrepor, adicionar, escurecer, clarear.
6. **LUT `.cube`**, **curvas**, **HSL** e **rodas de cor**.
7. **Transições** — zoom, girar, desfoque, glitch, flash branco, cortina circular.
8. **Texto** — modelos de título animados (Motifs), estilos prontos, efeitos de texto.
9. **Máscaras** com estrela/coração e edição arrastando na prévia; formas e parâmetros com ícones
   em vez de números (UX do CapCut).
