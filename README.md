# Portfólio · Jailton Santos

Portfólio com tema de terminal, feito em HTML, CSS e JavaScript puro (ES modules, sem build e sem dependências).

## Rodar localmente

ES modules não funcionam abrindo o `index.html` direto (file://). Sirva a pasta:

```powershell
python -m http.server 5179
```

e abra http://localhost:5179.

## Onde editar

| O quê | Arquivo |
|---|---|
| Nome, links, **e-mail e LinkedIn** (estão vazios) | `js/data.js` → `profile` |
| Projetos (MyWorld, Brasil Panel) | `js/data.js` → `projects` |
| Stack | `js/data.js` → `stack` |
| Rótulos que orbitam o retrato | `js/data.js` → `arcs` |
| Foto | `assets/jailton.jpg` (720×819) |
| Cores / tokens | `css/base.css` → `:root` |

O terminal (`help`, `neofetch`, `projetos`, `abrir`, `theme`, `matrix`…) lê os mesmos dados, então tudo fica sincronizado.

## Estrutura

```
index.html
css/base.css        tokens, botões, nav, cursor, boot, statusline
css/sections.css    hero, retrato, projetos, terminal, stack, contato
js/main.js          ponto de entrada
js/portrait.js      retrato em ASCII + lente que revela a foto
js/visuals.js       buraco negro (MyWorld) e gráfico ao vivo (Brasil Panel)
js/terminal.js      o shell "jsh"
js/effects.js       cursor, parallax, botões magnéticos, reveals
js/render.js        renderiza projetos/stack/contato a partir de data.js
```

## Deploy

É um site estático: funciona no GitHub Pages, Vercel, Netlify ou S3 + CloudFront sem configuração.
Respeita `prefers-reduced-motion` (desliga boot, glitch e animações pesadas).
