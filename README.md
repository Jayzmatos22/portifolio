# Portfólio · Jailton Santos

Portfólio full-stack com tema de terminal: retrato em ASCII com lente que revela a foto, shell interativo (`jsh`), visuais ao vivo dos projetos e animações guiadas pelo scroll.

**Stack:** TypeScript (strict) · Vite · GSAP (ScrollTrigger + SplitText) · Lenis · Vitest

## Rodar localmente

```powershell
npm install
npm run dev
```

| Script | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento com hot reload |
| `npm run build` | checa os tipos (`tsc`) e gera o site em `dist/` |
| `npm run preview` | serve o build de produção |
| `npm test` | testes unitários (Vitest) |
| `npm run coverage` | testes com relatório de cobertura |

## Onde editar

| O quê | Arquivo |
|---|---|
| Nome, e-mail, links, LinkedIn | `src/data/content.ts` → `profile` |
| Projetos (MyWorld, Brasil Panel) | `src/data/content.ts` → `projects` |
| Stack | `src/data/content.ts` → `stack` |
| Rótulos que orbitam o retrato | `src/data/content.ts` → `arcs` |
| Foto | `src/assets/jailton.jpg` (720×819) |
| Cores / tokens | `src/styles/base.css` → `:root` |

O terminal (`help`, `neofetch`, `projetos`, `abrir`, `theme`, `matrix`…) lê os mesmos dados, então tudo fica sincronizado.

## Estrutura

```
src/
  main.ts               ponto de entrada
  types.ts              tipos do conteúdo (Profile, Project, StackGroup…)
  data/content.ts       todo o conteúdo do site
  anim/motion.ts        Lenis + GSAP: entrada, reveals, parallax, texto por scroll
  ui/                   render dos dados, efeitos (cursor, magnetic, tilt), boot
  portrait/             retrato ASCII (ascii.ts é a matemática pura, testada)
  visuals/visuals.ts    buraco negro (MyWorld) e gráfico ao vivo (Brasil Panel)
  terminal/             o shell jsh (shell-utils.ts tem a lógica pura, testada)
  lib/                  helpers (math, text, dom, ticker, theme)
  styles/               base.css e sections.css
```

## Deploy

Cada push na `main` roda `.github/workflows/deploy.yml`: instala, testa, builda e publica `dist/` no GitHub Pages.
Para ativar, em **Settings → Pages → Build and deployment**, escolha **GitHub Actions** como source.

O site respeita `prefers-reduced-motion`: sem boot, sem smooth scroll e sem animações pesadas.
