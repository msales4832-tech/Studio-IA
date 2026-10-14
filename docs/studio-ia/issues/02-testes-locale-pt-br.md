# 02 — Testes falham com o Windows em pt-BR (vírgula decimal)

Status: aberto
Fase: 0

## Problema

Com o sistema em pt-BR, 9 testes do upstream falham (também sem nenhuma mudança do Studio-IA):
`quantize.test.ts` (2), `KeyframeField.test.tsx` (2), `KeyframeValueField.test.tsx`, `MotifPicker.test.tsx`,
`MotifFields.test.tsx`, `ExportSettingsDialog.test.tsx`, `PausesSection.test.tsx`.

Causa: `toLocaleString(undefined, …)` / `Intl.NumberFormat(undefined, …)` formatam pelo locale do
sistema (`0,5`), e os testes comparam com `0.5` ou fazem `Number(texto)`.

## Opções

1. Fixar o locale dos testes (ex.: `process.env` + polyfill do locale padrão do `Intl` no `testSetup.ts`).
2. Formatar números pelo idioma da interface (i18n), não pelo do sistema, e parsear com o mesmo locale.

## Aceite

- `npm test` passa num Windows em pt-BR.
- Campos numéricos aceitam `0,5` e `0.5` quando a interface está em pt-BR.
