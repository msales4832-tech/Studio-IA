# WeftCut — agent instructions

Project glossary and domain vocabulary live in [`CONTEXT.md`](CONTEXT.md);
architectural decisions in [`docs/adr/`](docs/adr/).

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Testing

Tests are grouped by runner, not one directory: colocated Vitest unit tests in `src/`, Rust tests in `native/`, Playwright E2E in `apps/desktop/e2e/`. For the full layout map and run commands, see `docs/agents/testing.md`.

## Studio-IA (fork pessoal)

Este repositório é o fork Studio-IA do WeftCut. Antes de qualquer mudança, leia [`docs/studio-ia/SPEC.md`](docs/studio-ia/SPEC.md).

- Trabalho na branch `studio-ia`; `upstream` = WeftCut. Mantenha mudanças isoladas para facilitar merge.
- Requisito inegociável: exportação nunca usa proxy e nunca recodifica mais de uma vez a partir do original.
- Código de terceiros só de licença permissiva (MIT/Apache/BSD), com origem registrada em `THIRD-PARTY-NOTICES.md`.
- Usuário fala português; hardware alvo: 7,8 GB RAM, GPU integrada, Windows 11.
