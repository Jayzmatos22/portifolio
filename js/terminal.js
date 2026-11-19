// "jsh": a small hand-made shell. User input is only ever rendered with textContent;
// command output templates are static and escape every interpolated value.
import { profile, projects, stack, files } from './data.js';
import { asciiLines } from './portrait.js';
import { ACCENTS, setAccent, getAccentName } from './theme.js';
import { runMatrix } from './matrix.js';
import { esc, safeUrl, wait, prefersReducedMotion, watchVisibility } from './core.js';

const FONT = {
  J: ['  ███', '    █', '    █', '█   █', ' ███ '],
  A: [' ███ ', '█   █', '█████', '█   █', '█   █'],
  I: ['███', ' █ ', ' █ ', ' █ ', '███'],
  L: ['█    ', '█    ', '█    ', '█    ', '█████'],
  T: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  O: [' ███ ', '█   █', '█   █', '█   █', ' ███ '],
  N: ['█   █', '██  █', '█ █ █', '█  ██', '█   █'],
  S: [' ████', '█    ', ' ███ ', '    █', '████ '],
  E: ['█████', '█    ', '████ ', '█    ', '█████'],
  D: ['████ ', '█   █', '█   █', '█   █', '████ '],
  V: ['█   █', '█   █', '█   █', ' █ █ ', '  █  '],
  ' ': ['  ', '  ', '  ', '  ', '  '],
};

function banner(text) {
  const rows = ['', '', '', '', ''];
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch];
    if (!glyph) continue;
    glyph.forEach((row, i) => (rows[i] += `${row}  `));
  }
  return rows.join('\n');
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

const commonPrefix = (words) =>
  words.reduce((prefix, w) => {
    let i = 0;
    while (i < prefix.length && prefix[i] === w[i]) i++;
    return prefix.slice(0, i);
  });

const SECTIONS = { sobre: 'sobre', projetos: 'projetos', terminal: 'terminal', stack: 'stack', contato: 'contato', '~': 'inicio', '/': 'inicio' };
const ALIASES = { ajuda: 'help', '?': 'help', cls: 'clear', projects: 'projetos', about: 'sobre', contact: 'contato', open: 'abrir', hire: 'contratar', ll: 'ls' };

export function initTerminal(root, { portraitImg, onModeChange } = {}) {
  const screen = root?.querySelector('.term__screen');
  const out = root?.querySelector('.term__out');
  const form = root?.querySelector('.term__form');
  const input = root?.querySelector('.term__input');
  if (!screen || !out || !form || !input) return { focus() {} };

  const reduceMotion = prefersReducedMotion();
  const history = [];
  const startedAt = Date.now();
  let historyIndex = 0;
  let queue = Promise.resolve();
  let userHasTyped = false;

  /* Output helpers ------------------------------------------------------- */
  const scrollToEnd = () => (screen.scrollTop = screen.scrollHeight);
  const print = (html = '', cls = '') => {
    const line = document.createElement('div');
    line.className = `t-line ${cls}`.trim();
    line.innerHTML = html;
    out.append(line);
    scrollToEnd();
    return line;
  };
  const printText = (text, cls = '') => {
    const line = print('', cls);
    line.textContent = text;
    return line;
  };
  const printAll = async (lines, cls = '', delay = 14) => {
    for (const html of lines) {
      print(html, cls);
      if (!reduceMotion && delay) await wait(delay);
    }
  };
  const echo = (cmd) => {
    const line = print('<span class="t-prompt"><b>visitante@jailton</b>:<i>~</i>$</span> ');
    const span = document.createElement('span');
    span.className = 't-echo';
    span.textContent = cmd;
    line.append(span);
  };
  const link = (url, label) => {
    const href = safeUrl(url);
    return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label);
  };
  const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  const openUrl = (url) => {
    const href = safeUrl(url);
    if (href) window.open(href, '_blank', 'noopener');
    return Boolean(href);
  };
  const uptime = () => {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`;
  };

  /* Commands --------------------------------------------------------------- */
  const commands = {
    help: {
      desc: 'lista os comandos',
      run: () =>
        printAll([
          '<span class="t-muted">comandos disponíveis:</span>',
          ...Object.entries(commands)
            .filter(([, c]) => !c.hidden)
            .map(([name, c]) => `<span class="t-row"><span class="t-acc">${esc(name)}${c.usage ? ` <span class="t-dim">${esc(c.usage)}</span>` : ''}</span><span class="t-muted">${esc(c.desc)}</span></span>`),
          '',
          '<span class="t-dim">Tab completa · ↑ ↓ histórico · Ctrl+L limpa · "/" foca o terminal de qualquer lugar</span>',
        ]),
    },
    whoami: {
      desc: 'quem sou eu',
      run: () =>
        printAll([
          `<span class="t-strong">${esc(profile.name)}</span> <span class="t-dim">(${esc(profile.user)})</span>`,
          `${esc(profile.role)} · java · python · aws`,
          `<span class="t-acc">●</span> ${esc(profile.status)}`,
        ]),
    },
    sobre: { desc: 'um pouco sobre mim', run: () => printAll(files['sobre.md'].map(esc)) },
    projetos: {
      desc: 'lista os projetos',
      run: async () => {
        for (const p of projects) {
          await printAll([
            `<span class="t-acc">${esc(p.index)}</span>  <span class="t-strong">${esc(p.id.padEnd(13))}</span><span class="t-muted">${esc(p.kind)}</span>`,
            `    <span class="t-muted">${esc(p.summary)}</span>`,
            `    <span class="t-dim">stack:</span> ${esc(p.stack.slice(0, 6).join(' · '))}`,
            '',
          ]);
        }
        print('<span class="t-dim">dica: </span><span class="t-acc">abrir myworld</span><span class="t-dim"> ou </span><span class="t-acc">abrir brasilpanel</span>');
      },
    },
    abrir: {
      desc: 'abre um projeto (site ou código)',
      usage: '<projeto> [codigo]',
      args: () => projects.map((p) => p.id),
      run: (args) => {
        const project = projects.find((p) => p.id === (args[0] || '').toLowerCase());
        if (!project) {
          print(`<span class="t-red">uso:</span> abrir &lt;${projects.map((p) => esc(p.id)).join('|')}&gt; [codigo]`);
          return;
        }
        const wantsCode = ['codigo', 'código', 'repo', 'code'].includes((args[1] || '').toLowerCase());
        const url = !wantsCode && project.links.live ? project.links.live : project.links.repo;
        const opened = openUrl(url);
        print(opened ? `<span class="t-acc">→</span> abrindo ${link(url, url)}` : '<span class="t-red">sem link disponível</span>');
      },
    },
    stack: {
      desc: 'ferramentas que uso',
      run: () => {
        const lines = ['<span class="t-cyan">~/stack</span>'];
        stack.forEach((col, ci) => {
          const lastCol = ci === stack.length - 1;
          lines.push(`<span class="t-dim">${lastCol ? '└──' : '├──'}</span> <span class="t-acc">${esc(col.group)}/</span>`);
          col.items.forEach(([name, where], ii) => {
            const branch = `${lastCol ? '    ' : '│   '}${ii === col.items.length - 1 ? '└──' : '├──'}`;
            lines.push(`<span class="t-dim">${branch}</span> ${esc(name.padEnd(24, ' '))}<span class="t-dim">${esc(where)}</span>`);
          });
        });
        return printAll(lines, '', 8);
      },
    },
    contato: {
      desc: 'como falar comigo',
      run: () =>
        printAll(
          [
            profile.email && `<span class="t-row"><span class="t-acc">e-mail</span><span>${link(`mailto:${profile.email}`, profile.email)}</span></span>`,
            `<span class="t-row"><span class="t-acc">github</span><span>${link(profile.github, profile.githubLabel)}</span></span>`,
            profile.linkedin && `<span class="t-row"><span class="t-acc">linkedin</span><span>${link(profile.linkedin, profile.linkedinLabel || profile.linkedin)}</span></span>`,
          ].filter(Boolean),
        ),
    },
    github: { desc: 'abre meu github', run: () => openUrl(profile.github) && print(`<span class="t-acc">→</span> abrindo ${link(profile.github, profile.githubLabel)}`) },
    neofetch: {
      desc: 'informações do sistema',
      run: () => {
        const art = asciiLines(portraitImg, 46);
        const accentName = getAccentName();
        const row = (k, v) => `<span class="k">${esc(k)}</span>: ${esc(v)}`;
        const info = [
          `<span class="t-strong">visitante</span>@<span class="t-acc">jailton</span>`,
          '<span class="t-dim">─────────────────</span>',
          row('OS', 'Portfolio 2026 (HTML · CSS · JS)'),
          row('Host', window.location.host || 'localhost'),
          row('Shell', 'jsh 1.0'),
          row('Função', profile.role),
          row('Linguagens', 'Java, Python, TypeScript'),
          row('Back-end', 'Spring Boot, FastAPI'),
          row('Front-end', 'React, TypeScript, Tailwind'),
          row('Dados', 'PostgreSQL, DynamoDB'),
          row('Cloud', 'AWS Lambda, S3, CloudFront'),
          row('Projetos', `${projects.length} em produção`),
          row('Uptime', uptime()),
          row('Tema', accentName),
          `<span class="swatches">${['#ff5f57', '#ffb547', '#3dff7a', '#42e2ff', '#ff4fd8', '#ecf3ee'].map((c) => `<i style="background:${c}"></i>`).join('')}</span>`,
        ];
        const block = print('', 'neofetch');
        const pre = document.createElement('pre');
        pre.textContent = art.join('\n');
        const right = document.createElement('div');
        right.innerHTML = info.join('<br>');
        block.append(pre, right);
        scrollToEnd();
      },
    },
    theme: {
      desc: 'troca a cor de destaque',
      usage: '[cor]',
      args: () => Object.keys(ACCENTS),
      run: (args) => {
        const name = (args[0] || '').toLowerCase();
        if (!name) {
          print(`cores: ${Object.keys(ACCENTS).map((n) => (n === getAccentName() ? `<span class="t-acc">[${esc(n)}]</span>` : esc(n))).join('  ')}`);
          print('<span class="t-dim">uso: theme amber</span>');
          return;
        }
        if (!setAccent(name)) {
          print(`<span class="t-red">tema desconhecido:</span> ${esc(name)}`);
          return;
        }
        print(`<span class="t-acc">✓</span> tema alterado para <span class="t-acc">${esc(name)}</span>`);
      },
    },
    ls: {
      desc: 'lista arquivos',
      usage: '[-a]',
      run: (args) => {
        if ((args[0] || '').startsWith('projetos')) {
          print(projects.map((p) => `<span class="t-cyan">${esc(p.id)}/</span>`).join('  '));
          return;
        }
        const hidden = args.includes('-a') || args.includes('-la');
        print(
          [...(hidden ? ['<span class="t-dim">.</span>', '<span class="t-dim">..</span>', '<span class="t-amber">.segredo</span>'] : []),
            'sobre.md', '<span class="t-cyan">projetos/</span>', 'stack.txt', 'contato.txt'].join('  '),
        );
      },
    },
    cat: {
      desc: 'mostra um arquivo',
      usage: '<arquivo>',
      args: () => Object.keys(files),
      run: (args) => {
        const name = args[0];
        if (!name) return print('<span class="t-red">uso:</span> cat &lt;arquivo&gt;');
        const project = projects.find((p) => name.replace(/\/.*$/, '') === p.id || name === `projetos/${p.id}`);
        if (project) return printAll([`<span class="t-strong"># ${esc(project.name)}</span>`, esc(project.summary), '', ...project.highlights.map((h) => `- ${esc(h)}`)]);
        if (!files[name]) return printText(`cat: ${name}: arquivo não encontrado`, 't-red');
        return printAll(files[name].map(esc));
      },
    },
    cd: {
      desc: 'navega até uma seção',
      usage: '<seção>',
      args: () => Object.keys(SECTIONS).filter((k) => /^[a-z]/.test(k)),
      run: (args) => {
        const target = SECTIONS[(args[0] || '~').replace(/\/$/, '').replace(/^~\//, '')];
        if (!target) return printText(`cd: ${args[0]}: diretório não encontrado`, 't-red');
        print(`<span class="t-acc">→</span> indo para ~/${esc(target === 'inicio' ? '' : target)}`);
        goTo(target);
      },
    },
    contratar: { desc: 'vamos conversar', run: () => (print('<span class="t-acc">ótima escolha.</span> levando você ao contato…'), goTo('contato')) },
    matrix: {
      desc: 'siga o coelho branco',
      run: async () => {
        print('<span class="t-acc">seguindo o coelho branco…</span> <span class="t-dim">(qualquer tecla para sair)</span>');
        if (reduceMotion) return print('<span class="t-dim">animação desativada (prefers-reduced-motion).</span>');
        await runMatrix();
        input.focus({ preventScroll: true });
      },
    },
    banner: { desc: 'texto em letras grandes', usage: '[texto]', run: (args) => print('', 't-banner').append(banner(args.join(' ') || 'jailton')) },
    clear: { desc: 'limpa a tela', run: () => out.replaceChildren() },
    history: { desc: 'histórico de comandos', run: () => printAll(history.map((h, i) => `<span class="t-dim">${String(i + 1).padStart(3)}</span>  ${esc(h)}`), '', 0) },
    echo: { hidden: true, desc: '', run: (args) => printText(args.join(' ')) },
    date: { hidden: true, desc: '', run: () => printText(new Date().toLocaleString('pt-BR')) },
    pwd: { hidden: true, desc: '', run: () => printText('/home/visitante') },
    sudo: {
      hidden: true,
      desc: '',
      run: async () => {
        print('[sudo] senha para visitante: ');
        await wait(reduceMotion ? 0 : 700);
        print('<span class="t-red">visitante não está no arquivo sudoers. este incidente será reportado.</span> 👀');
      },
    },
    rm: { hidden: true, desc: '', run: () => print('<span class="t-red">permissão negada:</span> este portfólio é imutável. <span class="t-dim">(como todo bom estado deveria ser)</span>') },
    exit: { hidden: true, desc: '', run: () => print('logout… <span class="t-dim">brincadeira. aqui não tem saída, só deploy.</span>') },
    vim: { hidden: true, desc: '', run: () => print('<span class="t-dim">você entrou. boa sorte para sair. (dica: :q!)</span>') },
  };
  const visibleNames = () => Object.keys(commands);

  /* Execution ------------------------------------------------------------ */
  async function execute(raw) {
    const line = raw.trim();
    echo(line);
    if (!line) return;
    history.push(line);
    historyIndex = history.length;
    if (line === ':q' || line === ':q!') return print('<span class="t-acc">saiu do vim.</span> lendário.');
    const [first, ...args] = line.split(/\s+/);
    const name = ALIASES[first.toLowerCase()] || first.toLowerCase();
    const cmd = commands[name];
    if (!cmd) {
      const suggestion = visibleNames()
        .map((n) => [n, levenshtein(n, name)])
        .sort((a, b) => a[1] - b[1])[0];
      printText(`jsh: comando não encontrado: ${first}`, 't-red');
      if (suggestion && suggestion[1] <= 2) print(`<span class="t-dim">você quis dizer</span> <span class="t-acc">${esc(suggestion[0])}</span><span class="t-dim">?</span>`);
      else print('<span class="t-dim">digite</span> <span class="t-acc">help</span> <span class="t-dim">para ver os comandos.</span>');
      return;
    }
    try {
      await cmd.run(args);
    } catch (err) {
      console.error('[terminal]', err);
      printText(`jsh: erro ao executar ${name}`, 't-red');
    }
  }

  const run = (raw) => {
    queue = queue.then(() => execute(raw)).then(() => print(''));
    return queue;
  };

  async function typeAndRun(cmd) {
    if (reduceMotion) return run(cmd);
    input.value = '';
    for (const ch of cmd) {
      input.value += ch;
      await wait(45 + Math.random() * 40);
    }
    await wait(160);
    input.value = '';
    return run(cmd);
  }

  function complete(value) {
    const parts = value.split(/\s+/);
    if (parts.length <= 1) {
      const matches = visibleNames().filter((n) => !commands[n].hidden && n.startsWith(parts[0].toLowerCase()));
      if (matches.length === 1) return `${matches[0]} `;
      if (matches.length > 1) {
        printText(matches.join('  '), 't-muted');
        return commonPrefix(matches);
      }
      return value;
    }
    const name = ALIASES[parts[0]] || parts[0];
    const options = commands[name]?.args?.() || [];
    const last = parts[parts.length - 1].toLowerCase();
    const matches = options.filter((o) => o.startsWith(last));
    if (matches.length === 1) return [...parts.slice(0, -1), matches[0]].join(' ');
    if (matches.length > 1) printText(matches.join('  '), 't-muted');
    return value;
  }

  /* Events --------------------------------------------------------------- */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    userHasTyped = true;
    const value = input.value;
    input.value = '';
    run(value);
  });
  input.addEventListener('keydown', (e) => {
    userHasTyped = true;
    if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex];
    } else if (e.key === 'ArrowDown' && history.length) {
      e.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] ?? '';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      input.value = complete(input.value);
    } else if (e.key.toLowerCase() === 'l' && e.ctrlKey) {
      e.preventDefault();
      out.replaceChildren();
    } else if (e.key.toLowerCase() === 'c' && e.ctrlKey && !window.getSelection()?.toString()) {
      echo(`${input.value}^C`);
      input.value = '';
    }
  });
  input.addEventListener('focus', () => onModeChange?.('INSERT'));
  input.addEventListener('blur', () => onModeChange?.('NORMAL'));
  screen.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('a')) return;
    if (!window.getSelection()?.toString()) input.focus({ preventScroll: true });
  });
  document.querySelectorAll('[data-cmd]').forEach((chip) =>
    chip.addEventListener('click', () => {
      userHasTyped = true;
      typeAndRun(chip.dataset.cmd);
    }),
  );

  /* Welcome -------------------------------------------------------------- */
  let welcomed = false;
  const welcome = async () => {
    if (welcomed) return;
    welcomed = true;
    print('', 't-banner').append(banner('jailton'));
    await printAll([
      '<span class="t-strong">jsh 1.0</span> <span class="t-dim">· terminal do portfólio de jailton santos</span>',
      `<span class="t-dim">último login: ${esc(new Date().toLocaleString('pt-BR'))} de visitante</span>`,
      '',
      'digite <span class="t-acc">help</span> para ver os comandos, ou clique num atalho abaixo.',
      '',
    ], '', 60);
    await wait(reduceMotion ? 0 : 500);
    if (!userHasTyped) await typeAndRun('whoami');
  };
  watchVisibility(root, (isVisible) => isVisible && welcome(), { threshold: 0.35 });

  return {
    focus() {
      goTo('terminal');
      setTimeout(() => input.focus({ preventScroll: true }), reduceMotion ? 0 : 450);
    },
  };
}
