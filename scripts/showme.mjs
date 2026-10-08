#!/usr/bin/env node
// showme build tool: validates graph.json, derives map.mmd, assembles index.html + summary.md.
// Usage:
//   node showme.mjs validate <dir>
//   node showme.mjs mmd <dir> [--force]
//   node showme.mjs build <dir> [--static]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VIEWER = path.join(HERE, '..', 'viewer');

const MODES = ['repo', 'task', 'flow', 'change', 'diff', 'walkthrough', 'oop'];
const LANGS = ['th', 'en', 'th-en', 'en-th'];
const CHANGES = ['added', 'modified', 'deleted', 'moved', 'renamed', 'unchanged'];
const STATUSES = ['existing', 'modify', 'create', 'partial', 'unknown'];
const CONFIDENCE = ['fact', 'inference', 'unknown'];
const NO_EVIDENCE_OK = new Set(['external', 'actor', 'task', 'state', 'effect']);
// Symbol-level diff items (node.changes[]) and the notation used for them everywhere.
const KINDS = ['added', 'removed', 'modified', 'moved', 'renamed'];
const SIGIL = { added: '+', removed: '-', modified: '~', moved: '→', renamed: '→' };
const KIND_CLASS = { added: 'added', removed: 'removed', modified: 'modified', moved: 'moved', renamed: 'moved' };
const NODE_TEXT = ['description', 'explanation', 'before', 'after', 'runtime', 'tests', 'risks', 'learn', 'task'];

const UI = {
  en: { insight: 'Big picture', before: 'Before', after: 'After', visual: 'Visual map', staticMap: 'Static diagram',
    changes: 'What changed', hotspots: 'Hotspots', risks: 'Risks and unknowns', next: 'Next action', learn: 'What to learn',
    reference: 'All nodes and relationships', node: 'Node', type: 'Type', state: 'State', role: 'Role', evidence: 'Evidence',
    relationships: 'Relationships', why: 'Why this shape', fact: 'FACT', inference: 'INFERENCE', unknown: 'UNKNOWN',
    runtime: 'Runtime impact', tests: 'Tests', risk: 'Risks', learning: 'Learning', whatChanged: 'What changed', task: 'Task',
    diff: 'Git diff', symbols: 'Changed symbols', added: 'Added', removed: 'Removed', modified: 'Modified', moved: 'Moved', renamed: 'Renamed',
    replacements: 'Removed → replaced by', fromTo: 'From → to', replacedBy: 'Replaced by', calledBy: 'Called by', calls: 'Calls', note: 'Meaning' },
  th: { insight: 'ภาพรวม', before: 'ก่อน', after: 'หลัง', visual: 'แผนภาพ', staticMap: 'แผนภาพแบบ static',
    changes: 'อะไรเปลี่ยนไปบ้าง', hotspots: 'จุดสำคัญ', risks: 'ความเสี่ยงและสิ่งที่ยังไม่ทราบ', next: 'ขั้นตอนถัดไป', learn: 'สิ่งที่ได้เรียนรู้',
    reference: 'node และความสัมพันธ์ทั้งหมด', node: 'Node', type: 'ประเภท', state: 'สถานะ', role: 'หน้าที่', evidence: 'หลักฐาน',
    relationships: 'ความสัมพันธ์', why: 'ทำไมถึงออกแบบแบบนี้', fact: 'FACT', inference: 'INFERENCE', unknown: 'UNKNOWN',
    runtime: 'ผลตอน runtime', tests: 'Tests', risk: 'ความเสี่ยง', learning: 'สิ่งที่ได้เรียนรู้', whatChanged: 'สิ่งที่เปลี่ยน', task: 'งาน',
    diff: 'Git diff', symbols: 'symbol ที่เปลี่ยน', added: 'เพิ่ม', removed: 'ลบ', modified: 'แก้ไข', moved: 'ย้าย', renamed: 'เปลี่ยนชื่อ',
    replacements: 'สิ่งที่ลบ → สิ่งที่มาแทน', fromTo: 'จาก → ไปที่', replacedBy: 'ถูกแทนที่ด้วย', calledBy: 'ถูกเรียกโดย', calls: 'เรียกต่อ', note: 'ความหมาย' },
};

const isL = (v) => typeof v === 'string' ||
  (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 &&
    Object.keys(v).every((k) => (k === 'th' || k === 'en') && typeof v[k] === 'string'));
const primaryLang = (g) => String(g.meta?.language || 'en').split('-')[0];
const pick = (v, lang) => (v == null ? '' : typeof v === 'string' ? v : v[lang] || v[lang === 'th' ? 'en' : 'th'] || '');
const badgeOf = (n) => n.change || n.status || '';
const mermaidId = (id) => 'n_' + id.replace(/[^A-Za-z0-9]/g, '_');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function validate(g) {
  const errors = [], warnings = [];
  const bad = (m) => errors.push(m), warn = (m) => warnings.push(m);
  const checkL = (v, where, required) => {
    if (v == null) { if (required) bad(`${where} is required`); return; }
    if (!isL(v)) bad(`${where} must be a string or an object with "th"/"en" string keys`);
  };
  if (!g || typeof g !== 'object') return { errors: ['graph.json is not an object'], warnings };
  const meta = g.meta || {};
  checkL(meta.title, 'meta.title', true);
  if (!MODES.includes(meta.mode)) bad(`meta.mode must be one of ${MODES.join(', ')}`);
  if (!LANGS.includes(meta.language)) bad(`meta.language must be one of ${LANGS.join(', ')}`);
  if (meta.edges && !['dependency', 'flow'].includes(meta.edges)) bad('meta.edges must be "dependency" or "flow"');
  if (meta.direction && !['LR', 'TD'].includes(meta.direction)) bad('meta.direction must be "LR" or "TD"');
  checkL(meta.task, 'meta.task');

  const groupIds = new Set();
  for (const [i, gr] of (g.groups || []).entries()) {
    if (!gr.id) bad(`groups[${i}].id is required`);
    if (groupIds.has(gr.id)) bad(`duplicate group id "${gr.id}"`);
    groupIds.add(gr.id);
    checkL(gr.label, `groups[${i}].label`, true);
  }

  const ids = new Set(), mids = new Set();
  if (!Array.isArray(g.nodes) || g.nodes.length === 0) bad('nodes must be a non-empty array');
  for (const [i, n] of (g.nodes || []).entries()) {
    const at = `nodes[${i}]${n.id ? ` (${n.id})` : ''}`;
    if (typeof n.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(n.id)) { bad(`${at}.id must be ASCII letters, digits, ".", "_" or "-"`); continue; }
    if (ids.has(n.id)) bad(`duplicate node id "${n.id}"`);
    if (mids.has(mermaidId(n.id))) bad(`node id "${n.id}" collides with another id once punctuation is normalised`);
    ids.add(n.id); mids.add(mermaidId(n.id));
    checkL(n.label, `${at}.label`, true);
    if (typeof n.type !== 'string' || !n.type) bad(`${at}.type is required`);
    if (n.change && !CHANGES.includes(n.change)) bad(`${at}.change must be one of ${CHANGES.join(', ')}`);
    if (n.status && !STATUSES.includes(n.status)) bad(`${at}.status must be one of ${STATUSES.join(', ')}`);
    if (n.confidence && !CONFIDENCE.includes(n.confidence)) bad(`${at}.confidence must be one of ${CONFIDENCE.join(', ')}`);
    if (n.group && !groupIds.has(n.group)) bad(`${at}.group "${n.group}" is not declared in groups`);
    for (const f of NODE_TEXT) checkL(n[f], `${at}.${f}`);
    if (n.why != null) {
      if (typeof n.why !== 'object' || Array.isArray(n.why)) bad(`${at}.why must be an object with fact/inference/unknown`);
      else for (const k of Object.keys(n.why)) { if (!CONFIDENCE.includes(k)) bad(`${at}.why.${k} is not fact/inference/unknown`); else checkL(n.why[k], `${at}.why.${k}`); }
    }
    if (n.changes != null) {
      if (!Array.isArray(n.changes)) bad(`${at}.changes must be an array`);
      else n.changes.forEach((c, j) => {
        const cat = `${at}.changes[${j}]`;
        if (!KINDS.includes(c.kind)) bad(`${cat}.kind must be one of ${KINDS.join(', ')}`);
        if (typeof c.label !== 'string' || !c.label) bad(`${cat}.label must be a non-empty string (the symbol or behaviour, never translated)`);
        for (const f of ['explanation', 'before', 'after', 'learn']) checkL(c[f], `${cat}.${f}`);
        if (c.kind === 'removed' && !c.replacedBy && !c.explanation) warn(`${cat} is removed with no replacedBy and no explanation; say whether the behaviour moved or disappeared`);
      });
    }
    const ev = n.evidence || [];
    if (!Array.isArray(ev)) bad(`${at}.evidence must be an array`);
    else {
      ev.forEach((e, j) => { if (!e || typeof e.path !== 'string' || !e.path) bad(`${at}.evidence[${j}].path is required`); });
      if (ev.length === 0 && !NO_EVIDENCE_OK.has(n.type)) warn(`${at} has no evidence; add a path or mark confidence "inference"/"unknown"`);
    }
  }
  for (const [i, e] of (g.edges || []).entries()) {
    const at = `edges[${i}]`;
    if (!ids.has(e.source)) bad(`${at}.source "${e.source}" is not a node id`);
    if (!ids.has(e.target)) bad(`${at}.target "${e.target}" is not a node id`);
    if (e.confidence && !CONFIDENCE.includes(e.confidence)) bad(`${at}.confidence must be one of ${CONFIDENCE.join(', ')}`);
    checkL(e.label, `${at}.label`);
  }
  const s = g.summary;
  if (!s) warn('summary is missing; the page will have no Big picture / Hotspots / Risks / Next action');
  else {
    for (const f of ['insight', 'next', 'before', 'after']) checkL(s[f], `summary.${f}`);
    checkL(s.overall, 'summary.overall');
    (s.changes || []).forEach((c, j) => {
      if (!KINDS.includes(c.kind)) bad(`summary.changes[${j}].kind must be one of ${KINDS.join(', ')}`);
      checkL(c.text, `summary.changes[${j}].text`, true);
    });
    (s.replacements || []).forEach((r, j) => {
      if (typeof r.removed !== 'string' || typeof r.added !== 'string') bad(`summary.replacements[${j}] needs string "removed" and "added"`);
      checkL(r.note, `summary.replacements[${j}].note`);
    });
    for (const f of ['hotspots', 'risks', 'learn']) {
      if (s[f] == null) continue;
      if (!Array.isArray(s[f])) bad(`summary.${f} must be an array`);
      else s[f].forEach((v, j) => checkL(v, `summary.${f}[${j}]`, true));
    }
  }
  if ((g.nodes || []).length > 15) warn(`${g.nodes.length} nodes: fine for the interactive explorer, but split or group the static Mermaid diagram`);
  return { errors, warnings };
}

function fail(msg) { console.error(`error: ${msg}`); process.exit(1); }

function loadGraph(dir) {
  const file = path.join(dir, 'graph.json');
  if (!fs.existsSync(file)) fail(`no graph.json in ${dir}`);
  let g;
  try { g = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { fail(`graph.json is not valid JSON: ${err.message}`); }
  const { errors, warnings } = validate(g);
  warnings.forEach((w) => console.error(`warning: ${w}`));
  if (errors.length) { errors.forEach((e) => console.error(`error: ${e}`)); process.exit(1); }
  return g;
}

function toMermaid(g) {
  const lang = primaryLang(g);
  const q = (s) => String(s).replace(/"/g, '#quot;').replace(/\r?\n/g, '<br/>');
  const out = [`flowchart ${g.meta.direction || 'LR'}`];
  const line = (n, pad) => {
    const b = badgeOf(n);
    const badge = b && b !== 'unchanged' && b !== 'existing' ? `<br/>${b.toUpperCase()}` : '';
    out.push(`${pad}${mermaidId(n.id)}["${q(pick(n.label, lang))}${badge}"]`);
  };
  for (const gr of g.groups || []) {
    const members = g.nodes.filter((n) => n.group === gr.id);
    if (!members.length) continue;
    out.push(`    subgraph g_${gr.id.replace(/[^A-Za-z0-9]/g, '_')}["${q(pick(gr.label, lang))}"]`);
    members.forEach((n) => line(n, '        '));
    out.push('    end');
  }
  g.nodes.filter((n) => !n.group).forEach((n) => line(n, '    '));
  out.push('');
  for (const e of g.edges || []) {
    const arrow = e.confidence && e.confidence !== 'fact' ? '-.->' : '-->';
    const label = pick(e.label, lang) || '';
    out.push(`    ${mermaidId(e.source)} ${arrow}${label ? `|"${q(label)}"|` : ''} ${mermaidId(e.target)}`);
  }
  out.push('',
    '    classDef added fill:#e6f6ea,stroke:#2f8f4e,color:#12351f',
    '    classDef modified fill:#fff4dc,stroke:#b7791f,color:#3d2a05',
    '    classDef deleted fill:#fde8e8,stroke:#c53030,color:#4a1212,stroke-dasharray:5 3',
    '    classDef moved fill:#efe9fb,stroke:#6b46c1,color:#2a1a55',
    '    classDef partial fill:#e6f0fb,stroke:#2b6cb0,color:#12304f',
    '    classDef uncertain stroke-dasharray:4 3');
  const cls = { added: 'added', create: 'added', modified: 'modified', modify: 'modified', deleted: 'deleted',
    moved: 'moved', renamed: 'moved', partial: 'partial', unknown: 'uncertain' };
  const byClass = {};
  for (const n of g.nodes) { const c = cls[badgeOf(n)]; if (c) (byClass[c] ||= []).push(mermaidId(n.id)); }
  for (const [c, list] of Object.entries(byClass)) out.push(`    class ${list.join(',')} ${c}`);
  return out.join('\n') + '\n';
}

// ---- HTML assembly ----
function both(v, tag = 'span') {
  if (v == null || v === '') return '';
  if (typeof v === 'string') return `<${tag}>${esc(v)}</${tag}>`;
  const langs = ['th', 'en'].filter((l) => v[l]);
  if (langs.length === 1) return `<${tag}>${esc(v[langs[0]])}</${tag}>`;
  return langs.map((l) => `<${tag} data-l="${l}">${esc(v[l])}</${tag}>`).join('');
}
const ui = (key) => `<span class="ui" data-l="en">${esc(UI.en[key])}</span><span class="ui" data-l="th">${esc(UI.th[key])}</span>`;
const badge = (n) => (badgeOf(n) ? `<span class="sm-chip sm-b-${esc(badgeOf(n))}">${esc(badgeOf(n).toUpperCase())}</span>` : '');
const evidenceHtml = (n) => (n.evidence || []).map((e) =>
  `<li><code>${esc(e.path)}${e.line != null ? ':' + esc(e.line) : ''}</code>${e.symbol ? ` <code class="sm-sym">${esc(e.symbol)}</code>` : ''}</li>`).join('');
const block = (key, body) => (body ? `<div class="sm-field"><h4>${ui(key)}</h4>${body}</div>` : '');
const list = (items) => (items && items.length ? `<ul>${items.map((v) => `<li>${both(v)}</li>`).join('')}</ul>` : '');

function whyHtml(why) {
  if (!why) return '';
  return CONFIDENCE.filter((k) => why[k]).map((k) =>
    `<p class="sm-why"><span class="sm-tag sm-tag-${k}">${ui(k)}</span> ${both(why[k])}</p>`).join('');
}

const codes = (v) => [].concat(v || []).filter(Boolean).map((x) => `<code>${esc(x)}</code>`).join(', ');

// One changed symbol: "+ refreshSession()" followed by whatever the evidence supports.
function itemHtml(c) {
  const detail = [
    c.explanation ? `<p>${both(c.explanation)}</p>` : '',
    c.from || c.to ? block('fromTo', `<p><code>${esc(c.from || '?')}</code> → <code>${esc(c.to || '?')}</code></p>`) : '',
    c.before || c.after ? `<div class="sm-ba">${block('before', both(c.before, 'pre'))}${block('after', both(c.after, 'pre'))}</div>` : '',
    block('why', whyHtml(c.why)),
    block('replacedBy', codes(c.replacedBy) ? `<p>${codes(c.replacedBy)}</p>` : ''),
    block('calledBy', codes(c.calledBy) ? `<p>${codes(c.calledBy)}</p>` : ''),
    block('calls', codes(c.calls) ? `<p>${codes(c.calls)}</p>` : ''),
    block('learning', c.learn ? `<p>${both(c.learn)}</p>` : ''),
    block('evidence', (c.evidence || []).length ? `<ul class="sm-ev">${evidenceHtml(c)}</ul>` : ''),
  ].join('');
  return `<li class="sm-k-${KIND_CLASS[c.kind]}"><code>${SIGIL[c.kind]} ${esc(c.label)}</code> <span class="sm-muted">${ui(c.kind)}</span>${detail ? `<div class="sm-detail">${detail}</div>` : ''}</li>`;
}

function changeCard(n) {
  return `<article class="sm-card" id="card-${esc(n.id)}">
<h3>${both(n.label)} ${badge(n)}</h3>
${n.description ? `<p class="sm-role">${both(n.description)}</p>` : ''}
${block('whatChanged', n.explanation ? `<p>${both(n.explanation)}</p>` : '')}
${block('symbols', (n.changes || []).length ? `<ul class="sm-delta">${n.changes.map(itemHtml).join('')}</ul>` : '')}
${n.before || n.after ? `<div class="sm-ba">${block('before', both(n.before, 'pre'))}${block('after', both(n.after, 'pre'))}</div>` : ''}
${block('why', whyHtml(n.why))}
${block('runtime', n.runtime ? `<p>${both(n.runtime)}</p>` : '')}
${block('tests', n.tests ? `<p>${both(n.tests)}</p>` : '')}
${block('risk', n.risks ? `<p>${both(n.risks)}</p>` : '')}
${block('learning', n.learn ? `<p>${both(n.learn)}</p>` : '')}
${block('evidence', (n.evidence || []).length ? `<ul class="sm-ev">${evidenceHtml(n)}</ul>` : '')}
</article>`;
}

// ---- Guided reading ----
// Everything here is derived from graph.json. Nothing is authored per report, and a field that is
// absent renders "Not available in source" instead of a guess.
Object.assign(UI.en, { startHere: 'Start here', tldr: 'TL;DR', scope: 'Scope', keyNode: 'Start with', start: 'Start guided reading', skipAll: 'Skip to full details',
  glance: 'At a glance', problem: 'Problem', cause: 'Root cause', keyChanges: 'Key changes', mainRisk: 'Main risk', na: 'Not available in source',
  step: 'Step', s1: 'Problem — what happened?', s2: 'Root cause — why did it happen?', s3: 'Fix — how was it changed?', s4: 'Impact and risks — what does it affect?', s5: 'Evidence — check it yourself',
  n1: 'Problem', n2: 'Root cause', n3: 'Fix', n4: 'Impact', n5: 'Evidence',
  prev: 'Previous', nextStep: 'Next', backSummary: 'Back to summary', deepDive: 'Open Deep Dive', skipDeep: 'Skip to Deep Dive', tech: 'Technical details',
  where: 'Where', otherChanged: 'Other changed parts', unknowns: 'Unknowns', inferred: 'Inferred relationships', path: 'Critical path',
  noPath: 'No single critical path could be identified from the graph. Use the full graph below.', s5idea: 'Every claim above traces back to these source locations. Follow the path, then open any node for its full details.',
  openGraph: 'Open the graph', fullDetails: 'Full details', map: 'Visual map' });
Object.assign(UI.th, { startHere: 'เริ่มอ่านที่นี่', tldr: 'สรุปสั้น', scope: 'ขอบเขต', keyNode: 'เริ่มดูที่', start: 'เริ่มอ่านแบบนำทาง', skipAll: 'ข้ามไปดูรายละเอียดทั้งหมด',
  glance: 'สรุปภาพรวม', problem: 'ปัญหา', cause: 'สาเหตุ', keyChanges: 'การเปลี่ยนแปลงหลัก', mainRisk: 'ความเสี่ยงหลัก', na: 'ไม่มีข้อมูลนี้ใน source',
  step: 'ขั้นที่', s1: 'ปัญหา — เกิดอะไรขึ้น?', s2: 'สาเหตุ — ทำไมจึงเกิด?', s3: 'การแก้ — แก้อย่างไร?', s4: 'ผลกระทบและความเสี่ยง — กระทบอะไร?', s5: 'หลักฐาน — ตรวจสอบต่อ',
  n1: 'ปัญหา', n2: 'สาเหตุ', n3: 'การแก้', n4: 'ผลกระทบ', n5: 'หลักฐาน',
  prev: 'ก่อนหน้า', nextStep: 'ถัดไป', backSummary: 'กลับไปที่สรุป', deepDive: 'เปิด Deep Dive', skipDeep: 'ข้ามไป Deep Dive', tech: 'รายละเอียดทางเทคนิค',
  where: 'ตำแหน่ง', otherChanged: 'ส่วนอื่นที่เปลี่ยน', unknowns: 'สิ่งที่ยังไม่ทราบ', inferred: 'ความสัมพันธ์ที่เป็นข้อสันนิษฐาน', path: 'เส้นทางหลัก',
  noPath: 'ไม่สามารถระบุเส้นทางหลักเส้นเดียวจาก graph ได้อย่างน่าเชื่อถือ ให้ดู graph เต็มด้านล่าง', s5idea: 'ทุกข้อสรุปด้านบนอ้างอิงกลับไปยังตำแหน่งใน source เหล่านี้ ไล่ตามเส้นทาง แล้วเปิด node ที่ต้องการเพื่อดูรายละเอียดทั้งหมด',
  openGraph: 'เปิด graph', fullDetails: 'รายละเอียดทั้งหมด', map: 'แผนภาพ' });

const DETAIL_FIELDS = ['description', 'explanation', 'before', 'after', 'why', 'runtime', 'tests', 'risks', 'learn', 'changes', 'evidence'];
const filled = (v) => v != null && v !== '' && !(Array.isArray(v) && !v.length);
const isChanged = (n) => (n.change && n.change !== 'unchanged') || ['modify', 'create', 'partial'].includes(n.status);

// Key node = the changed node with the most detail. Critical path = one chain through it, walking
// edges upstream to a source and downstream to a sink. Returns path: null when no reliable chain exists.
function derive(g) {
  const edges = g.edges || [];
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const score = (n) => DETAIL_FIELDS.filter((f) => filled(n[f])).length;
  const outDeg = (id) => edges.filter((e) => e.source === id).length;
  const pool = g.nodes.filter(isChanged);
  const key = (pool.length ? pool : g.nodes).slice().sort((a, b) => score(b) - score(a) || outDeg(b.id) - outDeg(a.id))[0];
  const seen = new Set([key.id]);
  const walk = (from, dir) => {
    const out = [];
    for (let cur = from; ;) {
      const next = edges.map((e, i) => ({ e, i, other: dir === 'up' ? e.source : e.target }))
        .filter((x) => (dir === 'up' ? x.e.target : x.e.source) === cur && !seen.has(x.other) && byId.has(x.other))
        .sort((a, b) => (a.e.confidence && a.e.confidence !== 'fact' ? 1 : 0) - (b.e.confidence && b.e.confidence !== 'fact' ? 1 : 0) ||
          (dir === 'up' ? Number(isChanged(byId.get(b.other))) - Number(isChanged(byId.get(a.other))) || score(byId.get(b.other)) - score(byId.get(a.other)) : 0) || a.i - b.i)[0];
      if (!next) break;
      seen.add(next.other); out.push(next.other); cur = next.other;
    }
    return out;
  };
  const path = [...walk(key.id, 'up').reverse(), key.id, ...walk(key.id, 'down')];
  return { key: key.id, path: path.length >= 3 ? path : null };
}

const na = () => `<span class="sm-na">${ui('na')}</span>`;
const nodeLink = (n) => `<a class="sm-nodelink" href="#node-${esc(n.id)}">${both(n.label)}</a>`;

function diffInner(g) {
  const s = g.summary || {};
  const groups = KINDS.map((k) => {
    const items = (s.changes || []).filter((c) => c.kind === k);
    return items.length ? `<div class="sm-field"><h4>${SIGIL[k]} ${ui(k)}</h4><ul>${items.map((c) => `<li>${both(c.text)}</li>`).join('')}</ul></div>` : '';
  }).join('');
  const reps = (s.replacements || []).length ? `<h3>${ui('replacements')}</h3><div class="sm-scroll"><table><tbody>${s.replacements.map((r) =>
    `<tr><td class="sm-k-removed"><code>- ${esc(r.removed)}</code></td><td>→</td><td class="sm-k-added"><code>+ ${esc(r.added)}</code></td><td>${both(r.note)}</td></tr>`).join('')}</tbody></table></div>` : '';
  if (!groups && !reps && !g.meta.stat && !s.overall) return '';
  return `${g.meta.stat ? `<p class="sm-stat">${esc(g.meta.stat)}</p>` : ''}${groups ? `<div class="sm-ba">${groups}</div>` : ''}${s.overall ? `<p class="sm-lead">${both(s.overall)}</p>` : ''}${reps}`;
}

function stepHtml(i, idea, body, tech) {
  const prev = i > 1 ? `<a class="sm-btn" href="#step-${i - 1}">← ${ui('prev')}</a>` : `<a class="sm-btn" href="#start">↑ ${ui('backSummary')}</a>`;
  const next = i < 5 ? `<a class="sm-btn sm-btn-primary" href="#step-${i + 1}">${ui('nextStep')} →</a>` : `<a class="sm-btn sm-btn-primary" href="#mode-deep">${ui('deepDive')}</a>`;
  return `<section class="sm-step" id="step-${i}" data-step="${i}" aria-labelledby="step-${i}-h">
<p class="sm-kicker">${ui('step')} ${i} / 5</p>
<h2 id="step-${i}-h">${ui('s' + i)}</h2>
<p class="sm-idea">${idea || na()}</p>
${body || ''}
${tech ? `<details class="sm-tech"><summary>${ui('tech')}</summary>${tech}</details>` : ''}
<nav class="sm-stepnav">${prev}<span class="sm-stepcount">${i} / 5</span>${next}${i < 5 ? `<a class="sm-quiet" href="#mode-deep">${ui('skipDeep')}</a>` : ''}</nav>
</section>`;
}

function guidedHtml(g, d) {
  const s = g.summary || {};
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const k = byId.get(d.key);
  const others = g.nodes.filter((n) => isChanged(n) && n !== k);
  const why = k.why || {};
  const causeKind = CONFIDENCE.find((c) => why[c]);
  const causeIdea = causeKind ? `<span class="sm-tag sm-tag-${causeKind}">${ui(causeKind)}</span> ${both(why[causeKind])}` : s.insight ? both(s.insight) : '';
  const restWhy = Object.fromEntries(CONFIDENCE.filter((c) => c !== causeKind && why[c]).map((c) => [c, why[c]]));
  const where = `<p class="sm-where">${ui('where')}: ${nodeLink(k)}</p>`;
  const unknowns = g.nodes.filter((n) => n.why && n.why.unknown).map((n) => `<li>${nodeLink(n)}: ${both(n.why.unknown)}</li>`).join('');
  const inferred = (g.edges || []).filter((e) => e.confidence && e.confidence !== 'fact')
    .map((e) => `<li>${nodeLink(byId.get(e.source))} <span class="sm-arrow">→</span> ${nodeLink(byId.get(e.target))} ${both(e.label)} <span class="sm-tag sm-tag-${e.confidence}">${ui(e.confidence)}</span></li>`).join('');
  const pathNodes = (d.path || []).map((id) => byId.get(id));
  const evNodes = (pathNodes.length ? pathNodes : g.nodes).filter((n) => (n.evidence || []).length);

  const s1 = stepHtml(1, g.meta.task ? both(g.meta.task) : '', block('before', both(s.before, 'pre')), g.meta.stat ? `<p class="sm-stat">${esc(g.meta.stat)}</p>` : '');
  const s2 = stepHtml(2, causeIdea,
    where + whyHtml(restWhy) + block('hotspots', list(s.hotspots)),
    others.filter((n) => n.why).map((n) => `<h4>${nodeLink(n)}</h4>${whyHtml(n.why)}`).join(''));
  const s3 = stepHtml(3, s.overall ? both(s.overall) : k.explanation ? both(k.explanation) : '',
    (s.before || s.after ? `<div class="sm-ba">${block('before', both(s.before, 'pre'))}${block('after', both(s.after, 'pre'))}</div>` : '') +
    where + (s.overall && k.explanation ? `<p>${both(k.explanation)}</p>` : '') +
    block('symbols', (k.changes || []).length ? `<ul class="sm-delta">${k.changes.map(itemHtml).join('')}</ul>` : ''),
    diffInner(g) + (others.length ? `<h4>${ui('otherChanged')}</h4><ul>${others.map((n) => `<li>${nodeLink(n)} ${badge(n)}${n.explanation ? ' ' + both(n.explanation) : ''}</li>`).join('')}</ul>` : ''));
  const s4 = stepHtml(4, k.runtime ? both(k.runtime) : (s.risks || []).length ? both(s.risks[0]) : '',
    block('tests', k.tests ? `<p>${both(k.tests)}</p>` : '') +
    (k.risks ? `<div class="sm-sem-risk">${block('risk', `<p>${both(k.risks)}</p>`)}</div>` : '') +
    block('risks', list(s.risks)) + block('unknowns', unknowns ? `<ul>${unknowns}</ul>` : '') +
    (s.next ? `<div class="sm-sem-result">${block('next', `<p>${both(s.next)}</p>`)}</div>` : ''),
    inferred ? `<h4>${ui('inferred')}</h4><ul class="sm-rels">${inferred}</ul>` : '');
  const s5 = stepHtml(5, ui('s5idea'),
    (pathNodes.length ? block('path', `<ol class="sm-chain">${pathNodes.map((n) => `<li>${nodeLink(n)}</li>`).join('')}</ol>`) : `<p>${ui('noPath')}</p>`) +
    evNodes.map((n) => `<h4>${nodeLink(n)}</h4><ul class="sm-ev">${evidenceHtml(n)}</ul>`).join('') +
    `<p><a href="#map">${ui('openGraph')}</a> · <a href="#mode-deep">${ui('fullDetails')}</a></p>`, '');

  const keyChanges = (s.changes || []).slice(0, 5).map((c) => `<li><code>${SIGIL[c.kind]}</code> ${both(c.text)}</li>`).join('') ||
    (k.changes || []).slice(0, 5).map((c) => `<li><code>${SIGIL[c.kind]} ${esc(c.label)}</code></li>`).join('');
  const scan = `<section class="sm-scan" id="scan" aria-labelledby="scan-h">
<h2 id="scan-h">${ui('glance')}</h2>
<dl>
<dt>${ui('problem')}</dt><dd>${g.meta.task ? both(g.meta.task) : na()}</dd>
<dt>${ui('cause')}</dt><dd>${causeIdea || na()}</dd>
<dt>${ui('keyChanges')}</dt><dd>${keyChanges ? `<ul>${keyChanges}</ul>` : na()}</dd>
<dt>${ui('mainRisk')}</dt><dd>${(s.risks || []).length ? both(s.risks[0]) : k.risks ? both(k.risks) : na()}</dd>
<dt>${ui('next')}</dt><dd>${s.next ? both(s.next) : na()}</dd>
</dl>
</section>`;
  const start = `<section class="sm-start" id="start" aria-labelledby="start-h">
<p class="sm-kicker">${ui('startHere')}</p>
<h1 id="start-h">${both(g.meta.title)}</h1>
<p class="sm-tldr"><strong>${ui('tldr')}</strong> ${s.insight ? both(s.insight) : s.overall ? both(s.overall) : na()}</p>
<dl class="sm-know">
${g.meta.task ? `<dt>${ui('task')}</dt><dd>${both(g.meta.task)}</dd>` : ''}
${g.meta.stat ? `<dt>${ui('scope')}</dt><dd class="sm-stat">${esc(g.meta.stat)}</dd>` : ''}
<dt>${ui('keyNode')}</dt><dd>${nodeLink(k)} ${badge(k)}</dd>
</dl>
<p class="sm-cta-row"><a class="sm-cta" href="#step-1">${ui('start')} →</a> <a class="sm-quiet" href="#deep">${ui('skipAll')}</a></p>
<ol class="sm-progress" aria-label="steps">${[1, 2, 3, 4, 5].map((i) => `<li><a href="#step-${i}">${ui('n' + i)}</a></li>`).join('')}</ol>
</section>`;
  return { start, scan, steps: `<div class="sm-guided" id="guided">${s1}${s2}${s3}${s4}${s5}</div>` };
}

const disc = (id, key, inner) => (inner ? `<details class="sm-disc" id="${id}"><summary><h2>${ui(key)}</h2></summary>${inner}</details>` : '');

function buildPage(g, svgs, interactive) {
  const lang = primaryLang(g);
  const bilingual = g.meta.language.includes('-');
  const s = g.summary || {};
  const d = derive(g);
  const gd = guidedHtml(g, d);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const changed = g.nodes.filter((n) => n.change && n.change !== 'unchanged');
  const hasDetail = (n) => n.explanation || n.before || n.after || n.why || n.learn || (n.changes || []).length;
  const cards = changed.length ? changed : g.nodes.filter(hasDetail);
  const diagrams = svgs.map((svg, i) => `<div class="sm-diagram">${svg.replace(/my-svg/g, `showme-d${i + 1}`)}</div>`).join('\n');
  const rows = g.nodes.map((n) => `<tr id="node-${esc(n.id)}"><td>${both(n.label)}<br><code class="sm-id">${esc(n.id)}</code></td><td>${esc(n.type)}</td><td>${badge(n)}</td><td>${both(n.description)}</td><td><ul class="sm-ev">${evidenceHtml(n)}</ul></td></tr>`).join('\n');
  const rels = (g.edges || []).map((e) => `<li>${both(byId.get(e.source).label)} <span class="sm-arrow">→</span> ${both(byId.get(e.target).label)} <span class="sm-muted">${esc(e.type || '')}${e.label ? ' · ' : ''}</span>${both(e.label)}${e.confidence && e.confidence !== 'fact' ? ` <span class="sm-tag sm-tag-${e.confidence}">${ui(e.confidence)}</span>` : ''}</li>`).join('\n');
  // "<" is escaped so graph text can never close the inline script block.
  const json = JSON.stringify({ ...g, _derived: d }).split('<').join('\\' + 'u003c');
  const big = (s.insight ? `<p class="sm-lead">${both(s.insight)}</p>` : '') +
    (s.before || s.after ? `<div class="sm-ba">${block('before', both(s.before, 'pre'))}${block('after', both(s.after, 'pre'))}</div>` : '');

  return `<!doctype html>
<html lang="${lang}" data-lang="${lang}"${bilingual ? ' data-bilingual="1"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pick(g.meta.title, lang))} · showme</title>
<link rel="stylesheet" href="showme.css">
</head>
<body>
<a class="sm-skip" href="#start">${ui('startHere')}</a>
<header class="sm-header">
  <p class="sm-brand">SHOWME · ${esc(g.meta.mode)}</p>
  <div class="sm-tools">
    <div id="showme-modes" class="sm-seg" hidden></div>
    <div id="showme-prefs" class="sm-prefs" hidden></div>
    <div id="showme-lang" class="sm-seg" hidden></div>
  </div>
</header>
<main>
${gd.start}
${gd.scan}
${gd.steps}
<details class="sm-disc sm-map" id="map" open>
  <summary><h2>${ui('map')}</h2></summary>
  ${interactive ? '<div id="showme-explorer" class="sm-explorer" hidden></div>' : ''}
  ${diagrams ? (interactive ? `<details class="sm-static" id="showme-static" open><summary>${ui('staticMap')}</summary>${diagrams}</details>` : diagrams) : ''}
</details>
<div id="deep">
${disc('d-diff', 'diff', diffInner(g))}
${disc('d-big', 'insight', big)}
${disc('d-changes', 'changes', cards.length ? `<div class="sm-cards">${cards.map(changeCard).join('\n')}</div>` : '')}
${disc('d-hotspots', 'hotspots', list(s.hotspots))}
${disc('d-risks', 'risks', list(s.risks))}
${disc('d-next', 'next', s.next ? `<p>${both(s.next)}</p>` : '')}
${disc('d-learn', 'learn', list(s.learn))}
${disc('d-ref', 'reference', `<div class="sm-scroll"><table>
<thead><tr><th>${ui('node')}</th><th>${ui('type')}</th><th>${ui('state')}</th><th>${ui('role')}</th><th>${ui('evidence')}</th></tr></thead>
<tbody>
${rows}
</tbody></table></div>${rels ? `<h3>${ui('relationships')}</h3><ul class="sm-rels">${rels}</ul>` : ''}`)}
</div>
</main>
${interactive ? `<script type="application/json" id="showme-graph">${json}</script>\n<script src="showme.js"></script>` : ''}
</body>
</html>
`;
}

function buildSummaryMd(g) {
  const lang = primaryLang(g), other = lang === 'th' ? 'en' : 'th';
  const bilingual = g.meta.language.includes('-');
  const T = UI[lang];
  const txt = (v) => {
    const a = pick(v, lang);
    const b = bilingual && v && typeof v === 'object' && v[lang] && v[other] ? `  \n  _${v[other]}_` : '';
    return a + b;
  };
  const s = g.summary || {};
  const out = [`# ${pick(g.meta.title, lang)}`, '', `Mode: \`${g.meta.mode}\` · Visual: [index.html](index.html) · Graph data: [graph.json](graph.json)`, ''];
  if (g.meta.task) out.push(`**${T.task}:** ${txt(g.meta.task)}`, '');
  if ((s.changes || []).length || g.meta.stat) {
    out.push(`## ${T.diff}`, '');
    if (g.meta.stat) out.push(`\`${g.meta.stat}\``, '');
    for (const k of KINDS) {
      const items = (s.changes || []).filter((c) => c.kind === k);
      if (items.length) out.push(`**${SIGIL[k]} ${T[k]}**`, '', ...items.map((c) => `- ${txt(c.text)}`), '');
    }
    if (s.overall) out.push(txt(s.overall), '');
    if ((s.replacements || []).length) out.push(`**${T.replacements}**`, '', ...s.replacements.map((r) => `- \`- ${r.removed}\` → \`+ ${r.added}\`${r.note ? ': ' + txt(r.note) : ''}`), '');
  }
  if (s.insight) out.push(`## ${T.insight}`, '', txt(s.insight), '');
  if (s.before) out.push(`### ${T.before}`, '', '```text', pick(s.before, lang), '```', '');
  if (s.after) out.push(`### ${T.after}`, '', '```text', pick(s.after, lang), '```', '');
  const changed = g.nodes.filter((n) => n.change && n.change !== 'unchanged');
  if (changed.length) {
    out.push(`## ${T.changes}`, '');
    for (const n of changed) {
      const ev = (n.evidence || []).map((e) => `\`${e.path}${e.symbol ? ' · ' + e.symbol : ''}\``).join(', ');
      out.push(`- **${pick(n.label, lang)}** (${n.change})${ev ? ' ' + ev : ''}${n.explanation ? ': ' + txt(n.explanation) : ''}`);
      for (const c of n.changes || []) out.push(`  - \`${SIGIL[c.kind]} ${c.label}\`${c.explanation ? ' ' + txt(c.explanation) : ''}`);
    }
    out.push('');
  }
  for (const [key, items] of [['hotspots', s.hotspots], ['risks', s.risks]]) {
    if (items && items.length) out.push(`## ${T[key]}`, '', ...items.map((v) => `- ${txt(v)}`), '');
  }
  if (s.next) out.push(`## ${T.next}`, '', txt(s.next), '');
  if (s.learn && s.learn.length) out.push(`## ${T.learn}`, '', ...s.learn.map((v) => `- ${txt(v)}`), '');
  return out.join('\n');
}

// ---- CLI ----
const [cmd, dirArg, ...flags] = process.argv.slice(2);
if (!cmd || !dirArg) fail('usage: node showme.mjs <validate|mmd|build> <dir> [--force|--static]');
const dir = path.resolve(dirArg);

if (cmd === 'validate') {
  loadGraph(dir);
  console.log('graph.json is valid');
} else if (cmd === 'mmd') {
  const g = loadGraph(dir);
  const file = path.join(dir, 'map.mmd');
  if (fs.existsSync(file) && !flags.includes('--force')) fail('map.mmd already exists; pass --force to overwrite');
  fs.writeFileSync(file, toMermaid(g));
  console.log(file);
} else if (cmd === 'build') {
  const g = loadGraph(dir);
  const interactive = !flags.includes('--static');
  const svgNames = fs.readdirSync(dir).filter((f) => f.endsWith('.svg'))
    .sort((a, b) => (a === 'map.svg' ? -1 : b === 'map.svg' ? 1 : a.localeCompare(b)));
  const svgs = svgNames.map((f) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/^<\?xml[^>]*\?>\s*/, ''));
  if (!svgs.length) console.error('warning: no .svg in the directory; the page has no static diagram fallback');
  fs.writeFileSync(path.join(dir, 'index.html'), buildPage(g, svgs, interactive));
  fs.writeFileSync(path.join(dir, 'summary.md'), buildSummaryMd(g));
  fs.copyFileSync(path.join(VIEWER, 'showme.css'), path.join(dir, 'showme.css'));
  if (interactive) fs.copyFileSync(path.join(VIEWER, 'showme.js'), path.join(dir, 'showme.js'));
  console.log(path.join(dir, 'index.html'));
} else {
  fail(`unknown command "${cmd}"`);
}
