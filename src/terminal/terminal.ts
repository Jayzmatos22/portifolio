// "jsh": a small hand-made shell. User input is only ever rendered with textContent;
// command output templates are static and escape every interpolated value.
import { scrollToId } from '../anim/motion';
import { education, files, profile, projects, stack } from '../data/content';
import { prefersReducedMotion, watchVisibility } from '../lib/dom';
import { wait } from '../lib/math';
import { completionLabel, esc, formatMonthYear, safeUrl } from '../lib/text';
import { accentNames, getAccentName, setAccent } from '../lib/theme';
import { asciiLines } from '../portrait/portrait';
import type { EditorMode } from '../ui/effects';
import { runMatrix } from './matrix';
import { banner, completeInput, parseCommand, suggestCommand, type AliasMap } from './shell-utils';

interface Command {
  readonly desc: string;
  readonly usage?: string;
  readonly hidden?: boolean;
  readonly args?: () => readonly string[];
  run(args: readonly string[]): void | Promise<void>;
}

export interface TerminalOptions {
  readonly portraitImg?: HTMLImageElement | null;
  readonly onModeChange?: (mode: EditorMode) => void;
}

export interface TerminalController {
  focus(): void;
}

const SECTIONS: Readonly<Record<string, string>> = {
  sobre: 'sobre', projetos: 'projetos', terminal: 'terminal', stack: 'stack', contato: 'contato', '~': 'inicio', '/': 'inicio',
};
const ALIASES: AliasMap = {
  ajuda: 'help', '?': 'help', cls: 'clear', projects: 'projetos', about: 'sobre', contact: 'contato', open: 'abrir', hire: 'contratar', ll: 'ls',
  education: 'formacao', 'formação': 'formacao', faculdade: 'formacao',
};
const CODE_WORDS = ['codigo', 'código', 'repo', 'code'];
const PROMPT_HTML = '<span class="t-prompt"><b>visitante@jailton</b>:<i>~</i>$</span> ';

export function initTerminal(root: HTMLElement | null, options: TerminalOptions = {}): TerminalController {
  const screen = root?.querySelector<HTMLElement>('.term__screen');
  const out = root?.querySelector<HTMLElement>('.term__out');
  const form = root?.querySelector<HTMLFormElement>('.term__form');
  const input = root?.querySelector<HTMLInputElement>('.term__input');
  if (!root || !screen || !out || !form || !input) return { focus: () => undefined };

  const reduceMotion = prefersReducedMotion();
  const history: string[] = [];
  const startedAt = Date.now();
  let historyIndex = 0;
  let queue: Promise<void> = Promise.resolve();
  let userHasTyped = false;

  /* Output helpers ------------------------------------------------------ */
  const scrollToEnd = (): void => {
    screen.scrollTop = screen.scrollHeight;
  };
  const print = (html = '', cls = ''): HTMLDivElement => {
    const line = document.createElement('div');
    line.className = `t-line ${cls}`.trim();
    line.innerHTML = html;
    out.append(line);
    scrollToEnd();
    return line;
  };
  const printText = (text: string, cls = ''): void => {
    print('', cls).textContent = text;
  };
  const printAll = async (lines: readonly string[], cls = '', delay = 14): Promise<void> => {
    for (const html of lines) {
      print(html, cls);
      if (!reduceMotion && delay) await wait(delay);
    }
  };
  const echo = (cmd: string): void => {
    const line = print(PROMPT_HTML);
    const span = document.createElement('span');
    span.className = 't-echo';
    span.textContent = cmd;
    line.append(span);
  };
  const link = (url: string, label: string): string => {
    const href = safeUrl(url);
    return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label);
  };
  const openUrl = (url: string): boolean => {
    const href = safeUrl(url);
    if (href) window.open(href, '_blank', 'noopener');
    return Boolean(href);
  };
  const uptime = (): string => {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`;
  };
  const row = (key: string, valueHtml: string): string => `<span class="t-row"><span class="t-acc">${esc(key)}</span><span>${valueHtml}</span></span>`;

  /* Commands -------------------------------------------------------------- */
  const commands: Record<string, Command> = {
    help: {
      desc: 'lista os comandos',
      run: () =>
        printAll([
          '<span class="t-muted">comandos disponíveis:</span>',
          ...Object.entries(commands)
            .filter(([, c]) => !c.hidden)
            .map(
              ([name, c]) =>
                `<span class="t-row"><span class="t-acc">${esc(name)}${c.usage ? ` <span class="t-dim">${esc(c.usage)}</span>` : ''}</span><span class="t-muted">${esc(c.desc)}</span></span>`,
            ),
          '',
          '<span class="t-dim">Tab completa · ↑ ↓ histórico · Ctrl+L limpa · "/" foca o terminal de qualquer lugar</span>',
        ]),
    },
    whoami: {
      desc: 'quem sou eu',
      run: () =>
        printAll([
          `<span class="t-strong">${esc(profile.name)}</span> <span class="t-dim">(${esc(profile.user)})</span>`,
          `${esc(profile.role)} <span class="t-dim">· foco em back-end</span>`,
          'java · python · typescript · react · aws',
          ...education.map(
            (e) => `<span class="t-dim">formação:</span> ${esc(e.course)} · ${esc(e.institution)} <span class="t-dim">(${esc(completionLabel(e.completion, e.inProgress))})</span>`,
          ),
          `<span class="t-acc">●</span> ${esc(profile.status)}`,
        ]),
    },
    sobre: { desc: 'um pouco sobre mim', run: () => printAll((files['sobre.md'] ?? []).map(esc)) },
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
        const project = projects.find((p) => p.id === (args[0] ?? '').toLowerCase());
        if (!project) {
          print(`<span class="t-red">uso:</span> abrir &lt;${projects.map((p) => esc(p.id)).join('|')}&gt; [codigo]`);
          return;
        }
        const wantsCode = CODE_WORDS.includes((args[1] ?? '').toLowerCase());
        const url = !wantsCode && project.links.live ? project.links.live : project.links.repo;
        print(openUrl(url) ? `<span class="t-acc">→</span> abrindo ${link(url, url)}` : '<span class="t-red">sem link disponível</span>');
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
      run: () => {
        const rows = [
          profile.email ? row('e-mail', link(`mailto:${profile.email}`, profile.email)) : '',
          row('github', link(profile.github, profile.githubLabel)),
          profile.linkedin ? row('linkedin', link(profile.linkedin, profile.linkedinLabel || profile.linkedin)) : '',
        ];
        return printAll(rows.filter(Boolean));
      },
    },
    formacao: {
      desc: 'formação acadêmica',
      run: () =>
        printAll(
          education.flatMap((e) => [
            `<span class="t-strong">${esc(e.course)}</span> <span class="t-dim">(${esc(e.degree.toLowerCase())})</span>`,
            `${esc(e.institution)} · ${e.inProgress ? '<span class="t-acc">●</span> cursando · ' : ''}${esc(completionLabel(e.completion, e.inProgress))}`,
          ]),
        ),
    },
    github: {
      desc: 'abre meu github',
      run: () => {
        if (openUrl(profile.github)) print(`<span class="t-acc">→</span> abrindo ${link(profile.github, profile.githubLabel)}`);
      },
    },
    neofetch: {
      desc: 'informações do sistema',
      run: () => {
        const info = [
          '<span class="t-strong">visitante</span>@<span class="t-acc">jailton</span>',
          '<span class="t-dim">─────────────────</span>',
          ['OS', 'Portfolio 2026 (TypeScript · Vite · GSAP)'],
          ['Host', window.location.host || 'localhost'],
          ['Shell', 'jsh 2.0'],
          ['Função', `${profile.role} (foco em back-end)`],
          ...education.map((e) => ['Formação', `${e.course} · ${e.institution} (${formatMonthYear(e.completion)})`]),
          ['Linguagens', 'Java, Python, TypeScript'],
          ['Back-end', 'Spring Boot, FastAPI'],
          ['Front-end', 'React, TypeScript, Tailwind'],
          ['Dados', 'PostgreSQL, DynamoDB'],
          ['Cloud', 'AWS Lambda, S3, CloudFront'],
          ['Projetos', `${projects.length} em produção`],
          ['Uptime', uptime()],
          ['Tema', getAccentName()],
        ].map((entry) => (typeof entry === 'string' ? entry : `<span class="k">${esc(entry[0])}</span>: ${esc(entry[1])}`));
        const swatches = ['#ff5f57', '#ffb547', '#3dff7a', '#42e2ff', '#ff4fd8', '#ecf3ee'].map((c) => `<i style="background:${c}"></i>`).join('');
        const block = print('', 'neofetch');
        const pre = document.createElement('pre');
        pre.textContent = asciiLines(options.portraitImg).join('\n');
        const right = document.createElement('div');
        right.innerHTML = `${info.join('<br>')}<span class="swatches">${swatches}</span>`;
        block.append(pre, right);
        scrollToEnd();
      },
    },
    theme: {
      desc: 'troca a cor de destaque',
      usage: '[cor]',
      args: accentNames,
      run: (args) => {
        const name = (args[0] ?? '').toLowerCase();
        if (!name) {
          print(`cores: ${accentNames().map((n) => (n === getAccentName() ? `<span class="t-acc">[${esc(n)}]</span>` : esc(n))).join('  ')}`);
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
        if ((args[0] ?? '').startsWith('projetos')) {
          print(projects.map((p) => `<span class="t-cyan">${esc(p.id)}/</span>`).join('  '));
          return;
        }
        const showHidden = args.includes('-a') || args.includes('-la');
        const hidden = showHidden ? ['<span class="t-dim">.</span>', '<span class="t-dim">..</span>', '<span class="t-amber">.segredo</span>'] : [];
        print([...hidden, 'sobre.md', '<span class="t-cyan">projetos/</span>', 'stack.txt', 'contato.txt'].join('  '));
      },
    },
    cat: {
      desc: 'mostra um arquivo',
      usage: '<arquivo>',
      args: () => Object.keys(files),
      run: async (args) => {
        const name = args[0];
        if (!name) {
          print('<span class="t-red">uso:</span> cat &lt;arquivo&gt;');
          return;
        }
        const project = projects.find((p) => name.replace(/\/.*$/, '') === p.id || name === `projetos/${p.id}`);
        if (project) {
          await printAll([`<span class="t-strong"># ${esc(project.name)}</span>`, esc(project.summary), '', ...project.highlights.map((h) => `- ${esc(h)}`)]);
          return;
        }
        const content = files[name];
        if (!content) {
          printText(`cat: ${name}: arquivo não encontrado`, 't-red');
          return;
        }
        await printAll(content.map(esc));
      },
    },
    cd: {
      desc: 'navega até uma seção',
      usage: '<seção>',
      args: () => Object.keys(SECTIONS).filter((k) => /^[a-z]/.test(k)),
      run: (args) => {
        const key = (args[0] ?? '~').replace(/\/$/, '').replace(/^~\//, '');
        const target = SECTIONS[key];
        if (!target) {
          printText(`cd: ${args[0] ?? ''}: diretório não encontrado`, 't-red');
          return;
        }
        print(`<span class="t-acc">→</span> indo para ~/${esc(target === 'inicio' ? '' : target)}`);
        scrollToId(target);
      },
    },
    contratar: {
      desc: 'vamos conversar',
      run: () => {
        print('<span class="t-acc">ótima escolha.</span> levando você ao contato…');
        scrollToId('contato');
      },
    },
    matrix: {
      desc: 'siga o coelho branco',
      run: async () => {
        print('<span class="t-acc">seguindo o coelho branco…</span> <span class="t-dim">(qualquer tecla para sair)</span>');
        if (reduceMotion) {
          print('<span class="t-dim">animação desativada (prefers-reduced-motion).</span>');
          return;
        }
        await runMatrix();
        input.focus({ preventScroll: true });
      },
    },
    banner: {
      desc: 'texto em letras grandes',
      usage: '[texto]',
      run: (args) => {
        print('', 't-banner').textContent = banner(args.join(' ') || 'jailton');
        scrollToEnd();
      },
    },
    clear: { desc: 'limpa a tela', run: () => out.replaceChildren() },
    history: {
      desc: 'histórico de comandos',
      run: () => printAll(history.map((h, i) => `<span class="t-dim">${String(i + 1).padStart(3)}</span>  ${esc(h)}`), '', 0),
    },
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
    rm: {
      hidden: true,
      desc: '',
      run: () => {
        print('<span class="t-red">permissão negada:</span> este portfólio é imutável. <span class="t-dim">(como todo bom estado deveria ser)</span>');
      },
    },
    exit: { hidden: true, desc: '', run: () => void print('logout… <span class="t-dim">brincadeira. aqui não tem saída, só deploy.</span>') },
    vim: { hidden: true, desc: '', run: () => void print('<span class="t-dim">você entrou. boa sorte para sair. (dica: :q!)</span>') },
  };

  const visibleNames = (): string[] => Object.keys(commands).filter((n) => !commands[n]?.hidden);
  const argOptions = (name: string): readonly string[] => commands[name]?.args?.() ?? [];

  /* Execution ----------------------------------------------------------- */
  async function execute(raw: string): Promise<void> {
    echo(raw.trim());
    const parsed = parseCommand(raw, ALIASES);
    if (!parsed) return;
    history.push(parsed.raw);
    historyIndex = history.length;
    if (parsed.raw === ':q' || parsed.raw === ':q!') {
      print('<span class="t-acc">saiu do vim.</span> lendário.');
      return;
    }
    const cmd = commands[parsed.name];
    if (!cmd) {
      printText(`jsh: comando não encontrado: ${parsed.raw.split(/\s+/)[0] ?? ''}`, 't-red');
      const suggestion = suggestCommand(parsed.name, Object.keys(commands));
      print(
        suggestion
          ? `<span class="t-dim">você quis dizer</span> <span class="t-acc">${esc(suggestion)}</span><span class="t-dim">?</span>`
          : '<span class="t-dim">digite</span> <span class="t-acc">help</span> <span class="t-dim">para ver os comandos.</span>',
      );
      return;
    }
    try {
      await cmd.run(parsed.args);
    } catch (err) {
      console.error('[terminal]', err);
      printText(`jsh: erro ao executar ${parsed.name}`, 't-red');
    }
  }

  const run = (raw: string): Promise<void> => {
    queue = queue.then(() => execute(raw)).then(() => void print(''));
    return queue;
  };

  const typeAndRun = async (cmd: string): Promise<void> => {
    if (!reduceMotion) {
      input.value = '';
      for (const ch of cmd) {
        input.value += ch;
        await wait(45 + Math.random() * 40);
      }
      await wait(160);
      input.value = '';
    }
    await run(cmd);
  };

  /* Events -------------------------------------------------------------- */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    userHasTyped = true;
    const value = input.value;
    input.value = '';
    void run(value);
  });
  input.addEventListener('keydown', (e) => {
    userHasTyped = true;
    const key = e.key.toLowerCase();
    if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] ?? '';
    } else if (e.key === 'ArrowDown' && history.length) {
      e.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] ?? '';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const completion = completeInput(input.value, visibleNames(), argOptions, ALIASES);
      if (completion.matches.length) printText(completion.matches.join('  '), 't-muted');
      input.value = completion.value;
    } else if (key === 'l' && e.ctrlKey) {
      e.preventDefault();
      out.replaceChildren();
    } else if (key === 'c' && e.ctrlKey && !window.getSelection()?.toString()) {
      echo(`${input.value}^C`);
      input.value = '';
    }
  });
  input.addEventListener('focus', () => options.onModeChange?.('INSERT'));
  input.addEventListener('blur', () => options.onModeChange?.('NORMAL'));
  screen.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('a')) return;
    if (!window.getSelection()?.toString()) input.focus({ preventScroll: true });
  });
  document.querySelectorAll<HTMLElement>('[data-cmd]').forEach((chip) =>
    chip.addEventListener('click', () => {
      userHasTyped = true;
      void typeAndRun(chip.dataset.cmd ?? 'help');
    }),
  );

  /* Welcome ------------------------------------------------------------- */
  let welcomed = false;
  const welcome = async (): Promise<void> => {
    if (welcomed) return;
    welcomed = true;
    print('', 't-banner').textContent = banner('jailton');
    await printAll(
      [
        '<span class="t-strong">jsh 2.0</span> <span class="t-dim">· terminal do portfólio de jailton santos</span>',
        `<span class="t-dim">último login: ${esc(new Date().toLocaleString('pt-BR'))} de visitante</span>`,
        '',
        'digite <span class="t-acc">help</span> para ver os comandos, ou clique num atalho abaixo.',
        '',
      ],
      '',
      60,
    );
    await wait(reduceMotion ? 0 : 500);
    if (!userHasTyped) await typeAndRun('whoami');
  };
  watchVisibility(root, (isVisible) => {
    if (isVisible) void welcome();
  }, { threshold: 0.35 });

  return {
    focus() {
      scrollToId('terminal', () => input.focus({ preventScroll: true }));
    },
  };
}
