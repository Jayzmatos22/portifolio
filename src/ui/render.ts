// Renders the data-driven parts of the page (projects, stack, contact, hero arcs).
import { arcs, education, profile, projects, stack } from '../data/content';
import { completionLabel, esc, safeUrl } from '../lib/text';
import type { Project, VisualKind } from '../types';

const VISUAL_OVERLAYS: Readonly<Record<VisualKind, () => string>> = {
  blackhole: () => '<div class="viz-tag"><b>nasa apod</b> · 1995 → hoje · ia</div>',
  market: () => `
    <div class="viz-legend">
      <span style="color:var(--accent)"><i></i>SELIC</span>
      <span style="color:var(--amber)"><i></i>USD/BRL</span>
      <span style="color:var(--cyan)"><i></i>IPCA</span>
    </div>
    <div class="viz-log" data-log aria-hidden="true"></div>`,
};

function linkButton(url: string, label: string, isPrimary: boolean): string {
  const href = safeUrl(url);
  if (!href) return '';
  const variant = isPrimary ? 'btn--primary' : 'btn--ghost';
  return `<a class="btn ${variant} btn--sm" href="${esc(href)}" target="_blank" rel="noopener noreferrer" data-magnetic=".2">
      <span>${esc(label)}</span><span class="btn__arrow" aria-hidden="true">↗</span>
    </a>`;
}

function projectTemplate(p: Project): string {
  return `
  <article class="project" id="p-${esc(p.id)}" data-reveal>
    <div class="project__window" data-spotlight data-tilt>
      <div class="project__bar">
        <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="project__path">~/projetos/${esc(p.id)}</span>
        <span class="project__status"><i aria-hidden="true"></i>${esc(p.status)}</span>
      </div>
      <div class="project__visual" data-visual="${esc(p.visual)}">
        <canvas aria-hidden="true"></canvas>
        ${VISUAL_OVERLAYS[p.visual]()}
      </div>
    </div>
    <div class="project__body">
      <span class="project__index" aria-hidden="true">${esc(p.index)}</span>
      <p class="project__kind">${esc(p.kind)}</p>
      <h3 class="project__name">${esc(p.name)}</h3>
      <p class="project__summary">${esc(p.summary)}</p>
      <ul class="project__highlights">${p.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
      <ul class="chips" aria-label="Tecnologias">${p.stack.map((s) => `<li class="chip">${esc(s)}</li>`).join('')}</ul>
      <div class="project__links">
        ${linkButton(p.links.live, 'ver no ar', true)}
        ${linkButton(p.links.repo, 'código', !p.links.live)}
      </div>
    </div>
  </article>`;
}

export function renderProjects(container: HTMLElement | null): void {
  if (container) container.innerHTML = projects.map(projectTemplate).join('');
}

/** Fills the "formação" fact in the about section (static HTML is the no-JS fallback). */
export function renderEducation(container: HTMLElement | null): void {
  if (!container) return;
  container.innerHTML = education
    .map(
      (e) =>
        `<span>${esc(e.course)} · ${esc(e.institution)}</span><span class="fact__meta">${esc(completionLabel(e.completion, e.inProgress))}</span>`,
    )
    .join('');
}

export function renderStack(container: HTMLElement | null): void {
  if (!container) return;
  container.innerHTML = stack
    .map(
      (col) => `
    <div class="stack-col">
      <h3>${esc(col.group)}<span>/</span></h3>
      <ul class="tree">
        ${col.items
          .map(
            ([name, where], i, all) => `
          <li>
            <span class="branch" aria-hidden="true">${i === all.length - 1 ? '└──' : '├──'}</span>
            <span class="name">${esc(name)}</span>
            <span class="leader" aria-hidden="true"></span>
            <span class="where">${esc(where)}</span>
          </li>`,
          )
          .join('')}
      </ul>
    </div>`,
    )
    .join('');
}

function linkRow(key: string, value: string, url: string, action: string): string {
  const href = safeUrl(url);
  if (!href) return '';
  return `<a class="c-row" href="${esc(href)}" target="_blank" rel="noopener noreferrer">
      <span class="c-row__k">${esc(key)}</span>
      <span class="c-row__v">${esc(value)}</span>
      <span class="c-row__a">${esc(action)} <b aria-hidden="true">→</b></span>
    </a>`;
}

export function renderContact(container: HTMLElement | null): void {
  if (!container) return;
  const rows: string[] = [];
  if (profile.email) {
    rows.push(`<button class="c-row" type="button" data-copy="${esc(profile.email)}">
        <span class="c-row__k">e-mail</span>
        <span class="c-row__v">${esc(profile.email)}</span>
        <span class="c-row__a"><span data-copy-label>copiar</span> <b aria-hidden="true">→</b></span>
      </button>`);
  }
  rows.push(linkRow('github', profile.githubLabel, profile.github, 'abrir'));
  rows.push(linkRow('linkedin', profile.linkedinLabel || 'linkedin', profile.linkedin, 'abrir'));
  rows.push(`<a class="c-row" href="#terminal" data-focus-terminal>
      <span class="c-row__k">terminal</span>
      <span class="c-row__v">$ contato</span>
      <span class="c-row__a">digitar <b aria-hidden="true">→</b></span>
    </a>`);
  container.innerHTML = rows.join('');
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** SVG arcs that orbit the portrait, drawn in on load (see .arc-* in sections.css). */
export function renderArcs(container: HTMLElement | null): void {
  if (!container) return;
  const center: Point = { x: -250, y: 350 };
  const point = (r: number, deg: number): Point => {
    const a = (deg * Math.PI) / 180;
    return { x: +(center.x + r * Math.cos(a)).toFixed(2), y: +(center.y + r * Math.sin(a)).toFixed(2) };
  };
  const parts = arcs.map((arc, i) => {
    const start = point(arc.r, arc.from);
    const end = point(arc.r, arc.to);
    const dot = point(arc.r, arc.dot);
    const length = ((arc.r * (arc.to - arc.from) * Math.PI) / 180).toFixed(1);
    const delay = (0.9 + i * 0.22).toFixed(2);
    return `
      <linearGradient id="arcGrad${i}" gradientUnits="userSpaceOnUse" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}">
        <stop offset="0" stop-color="#fff" stop-opacity="0"/>
        <stop offset=".22" stop-color="#fff" stop-opacity=".5"/>
        <stop offset=".55" stop-color="#fff" stop-opacity=".5"/>
        <stop offset=".85" stop-color="#fff" stop-opacity=".1"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <g style="--d:${delay}s">
        <path class="arc-line" d="M ${start.x} ${start.y} A ${arc.r} ${arc.r} 0 0 1 ${end.x} ${end.y}" stroke="url(#arcGrad${i})" style="--len:${length}"/>
        <circle class="arc-ring" cx="${dot.x}" cy="${dot.y}" r="7"/>
        <circle class="arc-dot" cx="${dot.x}" cy="${dot.y}" r="3.4"/>
        <text class="arc-num" x="${dot.x + 16}" y="${dot.y + 8}">${esc(arc.title)}</text>
        <text class="arc-label" x="${dot.x + 18}" y="${dot.y + 25}">${esc(arc.label)}</text>
      </g>`;
  });
  container.innerHTML = `<svg viewBox="0 0 380 700" preserveAspectRatio="xMinYMid meet">${parts.join('')}</svg>`;
}
