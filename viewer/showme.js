/* showme explorer: dependency-free graph viewer driven by the inline graph.json.
   Sections: 1 data · 2 i18n · 3 state · 4 view model · 5 layout · 6 rendering · 7 panels · 8 interaction · 9 boot */
(function () {
  'use strict';

  /* ===== 1. Data ===== */
  const dataEl = document.getElementById('showme-graph');
  const host = document.getElementById('showme-explorer');
  if (!dataEl || !host) return;
  let graph;
  try { graph = JSON.parse(dataEl.textContent); } catch (err) { return; }

  const meta = graph.meta || {};
  const nodes = graph.nodes || [];
  const edges = (graph.edges || []).filter((e) => e.source !== e.target);
  const groups = graph.groups || [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const FLOW = (meta.edges || (meta.mode === 'repo' || meta.mode === 'oop' ? 'dependency' : 'flow')) === 'flow';
  const badgeOf = (n) => n.change || n.status || '';
  const hasChanges = nodes.some((n) => n.change);
  // Symbol-level diff items: node.changes[] with kind added | removed | modified | moved | renamed.
  const KIND_OF = { added: 'added', create: 'added', deleted: 'removed', removed: 'removed', modified: 'modified', modify: 'modified', moved: 'moved', renamed: 'moved' };
  const SIGIL = { added: '+', removed: '-', modified: '~', moved: '→', renamed: '→' };
  const KINDS = ['added', 'removed', 'modified', 'moved'];
  const itemsOf = (n) => n.changes || [];
  const kindsOf = (n) => {
    const set = new Set();
    if (KIND_OF[n.change]) set.add(KIND_OF[n.change]);
    itemsOf(n).forEach((c) => set.add(KIND_OF[c.kind]));
    return set;
  };
  const countsText = (n) => KINDS.map((k) => {
    const count = itemsOf(n).filter((c) => KIND_OF[c.kind] === k).length;
    return count ? SIGIL[k] + count : '';
  }).filter(Boolean).join(' ');
  const types = [...new Set(nodes.map((n) => n.type))];
  const badges = [...new Set(nodes.map(badgeOf).filter(Boolean))];
  const typeColor = (type) => 'var(--t' + (Math.max(0, types.indexOf(type)) % 8) + ')';

  /* ===== 2. i18n ===== */
  const STR = {
    en: { search: 'Search nodes', changed: 'Changed', types: 'Node types', change: 'Change', status: 'Status',
      fit: 'Fit', reset: 'Reset', zoomIn: 'Zoom in', zoomOut: 'Zoom out', empty: 'Select a node to see its evidence.',
      overview: 'Overview', whatChanged: 'What changed', before: 'Before', after: 'After', why: 'Why this shape',
      fact: 'FACT', inference: 'INFERENCE', unknown: 'UNKNOWN', runtime: 'Runtime impact', tests: 'Tests', risks: 'Risks',
      learn: 'Learning', evidence: 'Evidence', task: 'Related task', out: FLOW ? 'Leads to' : 'Depends on',
      inn: FLOW ? 'Comes from' : 'Used by', connected: 'Connected', hlOut: FLOW ? 'Downstream' : 'Upstream dependencies',
      hlIn: FLOW ? 'Upstream' : 'Downstream dependents', focus: 'Focus', clear: 'Clear', expand: 'Expand group',
      collapse: 'Collapse group', members: 'Members', group: 'group', graph: 'Interactive graph', noMatch: 'No matching node',
      confidence: 'Confidence', symbols: 'Changed symbols', all: 'All', k_added: 'Added', k_removed: 'Removed',
      k_modified: 'Modified', k_moved: 'Moved', from: 'From', to: 'To', replacedBy: 'Replaced by', calledBy: 'Called by', calls: 'Calls' },
    th: { search: 'ค้นหา node', changed: 'สิ่งที่เปลี่ยน', types: 'ประเภท node', change: 'การเปลี่ยนแปลง', status: 'สถานะ',
      fit: 'พอดีจอ', reset: 'รีเซ็ต', zoomIn: 'ขยาย', zoomOut: 'ย่อ', empty: 'เลือก node เพื่อดูหลักฐาน',
      overview: 'ภาพรวม', whatChanged: 'สิ่งที่เปลี่ยน', before: 'ก่อน', after: 'หลัง', why: 'ทำไมถึงออกแบบแบบนี้',
      fact: 'FACT', inference: 'INFERENCE', unknown: 'UNKNOWN', runtime: 'ผลตอน runtime', tests: 'Tests', risks: 'ความเสี่ยง',
      learn: 'สิ่งที่ได้เรียนรู้', evidence: 'หลักฐาน', task: 'งานที่เกี่ยวข้อง', out: FLOW ? 'ไปต่อที่' : 'พึ่งพา',
      inn: FLOW ? 'มาจาก' : 'ถูกใช้โดย', connected: 'ที่เชื่อมกัน', hlOut: FLOW ? 'ปลายทาง (downstream)' : 'dependency ต้นทาง',
      hlIn: FLOW ? 'ต้นทาง (upstream)' : 'ผู้ใช้ปลายทาง', focus: 'โฟกัส', clear: 'ล้าง', expand: 'ขยายกลุ่ม',
      collapse: 'ย่อกลุ่ม', members: 'สมาชิก', group: 'กลุ่ม', graph: 'กราฟแบบโต้ตอบ', noMatch: 'ไม่พบ node ที่ตรงกัน',
      confidence: 'ความมั่นใจ', symbols: 'symbol ที่เปลี่ยน', all: 'ทั้งหมด', k_added: 'เพิ่ม', k_removed: 'ลบ',
      k_modified: 'แก้ไข', k_moved: 'ย้าย', from: 'จาก', to: 'ไปที่', replacedBy: 'ถูกแทนที่ด้วย', calledBy: 'ถูกเรียกโดย', calls: 'เรียกต่อ' },
  };
  const BADGE = {
    en: {},
    th: { added: 'เพิ่ม', modified: 'แก้ไข', deleted: 'ลบ', moved: 'ย้าย', renamed: 'เปลี่ยนชื่อ', unchanged: 'ไม่เปลี่ยน',
      existing: 'มีอยู่แล้ว', modify: 'แก้ไข', create: 'สร้างใหม่', partial: 'บางส่วน', unknown: 'ไม่ทราบ' },
  };
  const langSeen = { th: false, en: false };
  (function scan(v) {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(scan); return; }
    const keys = Object.keys(v);
    if (keys.length && keys.every((k) => k === 'th' || k === 'en') && keys.every((k) => typeof v[k] === 'string')) {
      keys.forEach((k) => { langSeen[k] = true; });
      return;
    }
    keys.forEach((k) => scan(v[k]));
  })(graph);
  const canSwitch = langSeen.th && langSeen.en;
  const bilingual = String(meta.language || '').includes('-');
  const otherLang = (l) => (l === 'th' ? 'en' : 'th');

  /* ===== 3. State ===== */
  const state = {
    lang: String(meta.language || 'en').split('-')[0] === 'th' ? 'th' : 'en',
    selected: null, item: null, kind: 'all', highlight: 'neighbors', focus: false, query: '',
    hiddenTypes: new Set(), hiddenBadges: new Set(), collapsed: new Set(),
    view: { x: 0, y: 0, k: 1 },
  };
  const t = (key) => STR[state.lang][key] || STR.en[key] || key;
  const L = (v) => (v == null ? '' : typeof v === 'string' ? v : v[state.lang] || v[otherLang(state.lang)] || '');
  const L2 = (v) => (bilingual && v && typeof v === 'object' && v[state.lang] && v[otherLang(state.lang)] ? v[otherLang(state.lang)] : '');
  const badgeText = (b) => (BADGE[state.lang][b] || b).toUpperCase();

  /* ===== 4. View model: which nodes/edges are on screen ===== */
  let view = { nodes: [], edges: [], ids: new Set() };
  let positions = new Map();

  function related(id, mode, vedges) {
    const set = new Set([id]);
    if (mode === 'neighbors') {
      for (const e of vedges) { if (e.source === id) set.add(e.target); if (e.target === id) set.add(e.source); }
      return set;
    }
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      for (const e of vedges) {
        const next = mode === 'out' ? (e.source === cur ? e.target : null) : (e.target === cur ? e.source : null);
        if (next && !set.has(next)) { set.add(next); queue.push(next); }
      }
    }
    return set;
  }

  function computeView() {
    const rep = new Map();
    let vnodes = [];
    const groupNodes = new Map();
    for (const n of nodes) {
      if (state.hiddenTypes.has(n.type) || state.hiddenBadges.has(badgeOf(n))) continue;
      if (n.group && state.collapsed.has(n.group)) {
        let g = groupNodes.get(n.group);
        if (!g) {
          g = { id: 'group:' + n.group, isGroup: true, group: n.group, members: [], type: 'group',
            label: (groupById.get(n.group) || {}).label || n.group };
          groupNodes.set(n.group, g);
          vnodes.push(g);
        }
        g.members.push(n);
        rep.set(n.id, g.id);
      } else {
        vnodes.push(n);
        rep.set(n.id, n.id);
      }
    }
    const seen = new Set();
    let vedges = [];
    for (const e of edges) {
      const s = rep.get(e.source), tg = rep.get(e.target);
      if (!s || !tg || s === tg) continue;
      const key = s + '>' + tg + '>' + (e.type || '');
      if (seen.has(key)) continue;
      seen.add(key);
      vedges.push({ source: s, target: tg, edge: e });
    }
    const selRep = state.selected && (rep.get(state.selected) || (groupNodes.has(state.selected.replace(/^group:/, '')) ? state.selected : null));
    if (state.focus && selRep) {
      const keep = related(selRep, state.highlight === 'none' ? 'neighbors' : state.highlight, vedges);
      vnodes = vnodes.filter((n) => keep.has(n.id));
      vedges = vedges.filter((e) => keep.has(e.source) && keep.has(e.target));
    }
    return { nodes: vnodes, edges: vedges, ids: new Set(vnodes.map((n) => n.id)) };
  }

  /* ===== 5. Layout: layered left-to-right, barycenter ordering ===== */
  const NW = 196, NH = 58, GX = 92, GY = 26;

  function layout(vn, ve) {
    const ids = vn.map((n) => n.id);
    const groupOf = new Map(vn.map((n) => [n.id, n.isGroup ? '' : n.group || '']));
    const adj = new Map(ids.map((i) => [i, []]));
    const incoming = new Map(ids.map((i) => [i, 0]));
    ve.forEach((e) => { adj.get(e.source).push(e); incoming.set(e.target, incoming.get(e.target) + 1); });

    // Mark back edges so cycles do not break the ranking.
    const mark = new Map();
    const forward = [];
    const visit = (u) => {
      mark.set(u, 1);
      for (const e of adj.get(u)) {
        const m = mark.get(e.target);
        if (m === 1) { e.back = true; continue; }
        forward.push(e);
        if (!m) visit(e.target);
      }
      mark.set(u, 2);
    };
    ids.filter((i) => incoming.get(i) === 0).concat(ids).forEach((i) => { if (!mark.get(i)) visit(i); });

    const out = new Map(ids.map((i) => [i, []])), inn = new Map(ids.map((i) => [i, []]));
    const indeg = new Map(ids.map((i) => [i, 0]));
    forward.forEach((e) => { out.get(e.source).push(e.target); inn.get(e.target).push(e.source); indeg.set(e.target, indeg.get(e.target) + 1); });
    const rank = new Map(ids.map((i) => [i, 0]));
    const queue = ids.filter((i) => indeg.get(i) === 0);
    while (queue.length) {
      const u = queue.shift();
      for (const v of out.get(u)) {
        rank.set(v, Math.max(rank.get(v), rank.get(u) + 1));
        indeg.set(v, indeg.get(v) - 1);
        if (indeg.get(v) === 0) queue.push(v);
      }
    }

    const cols = [];
    ids.forEach((i) => { (cols[rank.get(i)] = cols[rank.get(i)] || []).push(i); });
    for (let c = 0; c < cols.length; c++) cols[c] = cols[c] || [];
    const order = new Map();
    const reindex = () => cols.forEach((col) => col.forEach((id, i) => order.set(id, i)));
    reindex();
    for (let pass = 0; pass < 4; pass++) {
      const down = pass % 2 === 0;
      const seq = down ? cols : cols.slice().reverse();
      const nb = down ? inn : out;
      for (const col of seq) {
        const bary = new Map(col.map((id) => {
          const a = nb.get(id);
          return [id, a.length ? a.reduce((s, x) => s + order.get(x), 0) / a.length : order.get(id)];
        }));
        const groupBary = new Map();
        col.forEach((id) => {
          const g = groupOf.get(id);
          if (!g) return;
          const cur = groupBary.get(g) || { sum: 0, n: 0 };
          cur.sum += bary.get(id); cur.n += 1;
          groupBary.set(g, cur);
        });
        const key = (id) => { const g = groupOf.get(id); return g ? groupBary.get(g).sum / groupBary.get(g).n : bary.get(id); };
        col.sort((a, b) => key(a) - key(b) || groupOf.get(a).localeCompare(groupOf.get(b)) || bary.get(a) - bary.get(b) || ids.indexOf(a) - ids.indexOf(b));
        col.forEach((id, i) => order.set(id, i));
      }
    }
    const tallest = Math.max(1, ...cols.map((c) => c.length));
    const fullH = tallest * NH + (tallest - 1) * GY;
    const pos = new Map();
    cols.forEach((col, r) => {
      const colH = col.length * NH + (col.length - 1) * GY;
      col.forEach((id, i) => pos.set(id, { x: r * (NW + GX), y: (fullH - colH) / 2 + i * (NH + GY), rank: r }));
    });
    return pos;
  }

  /* ===== 6. Rendering ===== */
  const SVG = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, text) => {
    const el = document.createElementNS(SVG, tag);
    for (const k in attrs || {}) el.setAttribute(k, attrs[k]);
    if (text != null) el.textContent = text;
    return el;
  };
  const h = (tag, attrs, children) => {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach((c) => { if (c) el.appendChild(c); });
    return el;
  };
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  let svg, viewport, layerGroups, layerEdges, layerNodes, sideEl, inspectEl, searchEl;
  const nodeEls = new Map();
  const edgeEls = [];

  function vLabel(vn) { return vn.isGroup ? '▸ ' + L(vn.label) + ' (' + vn.members.length + ')' : L(vn.label); }

  function draw() {
    [layerGroups, layerEdges, layerNodes].forEach((g) => { while (g.firstChild) g.removeChild(g.firstChild); });
    nodeEls.clear();
    edgeEls.length = 0;

    for (const g of groups) {
      if (state.collapsed.has(g.id)) continue;
      const members = view.nodes.filter((n) => !n.isGroup && n.group === g.id);
      if (!members.length) continue;
      const ps = members.map((n) => positions.get(n.id));
      const x0 = Math.min(...ps.map((p) => p.x)) - 14, y0 = Math.min(...ps.map((p) => p.y)) - 30;
      const x1 = Math.max(...ps.map((p) => p.x)) + NW + 14, y1 = Math.max(...ps.map((p) => p.y)) + NH + 14;
      layerGroups.appendChild(svgEl('rect', { class: 'sm-group-box', x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 12 }));
      const head = svgEl('text', { class: 'sm-group-head', x: x0 + 10, y: y0 + 18, tabindex: 0, role: 'button' }, '▾ ' + L(g.label));
      head.setAttribute('aria-label', t('collapse') + ': ' + L(g.label));
      const collapse = () => { state.collapsed.add(g.id); rebuild(true); };
      head.addEventListener('click', collapse);
      head.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); collapse(); } });
      layerGroups.appendChild(head);
    }

    const showLabels = view.edges.length <= 40;
    for (const ve of view.edges) {
      const a = positions.get(ve.source), b = positions.get(ve.target);
      const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2;
      let c1x, c1y, c2x, c2y;
      if (x2 > x1) { const dx = Math.max(36, (x2 - x1) / 2); c1x = x1 + dx; c1y = y1; c2x = x2 - dx; c2y = y2; }
      else { const drop = Math.max(70, Math.abs(y2 - y1) / 2 + 60); c1x = x1 + 70; c1y = y1 + drop; c2x = x2 - 70; c2y = y2 + drop; }
      const wrap = svgEl('g', { class: 'sm-edge-wrap' + (showLabels ? '' : ' hide-label') });
      const inferred = ve.edge.confidence && ve.edge.confidence !== 'fact';
      wrap.appendChild(svgEl('path', { class: 'sm-edge' + (inferred ? ' is-inferred' : ''), 'marker-end': 'url(#sm-arrow)',
        d: 'M' + x1 + ',' + y1 + ' C' + c1x + ',' + c1y + ' ' + c2x + ',' + c2y + ' ' + (x2 - 4) + ',' + y2 }));
      const text = L(ve.edge.label) || ve.edge.type || '';
      if (text) {
        wrap.appendChild(svgEl('text', { class: 'sm-edge-label', 'text-anchor': 'middle',
          x: (x1 + 3 * c1x + 3 * c2x + x2) / 8, y: (y1 + 3 * c1y + 3 * c2y + y2) / 8 - 4 }, clip(text, 30)));
      }
      layerEdges.appendChild(wrap);
      edgeEls.push({ el: wrap, source: ve.source, target: ve.target });
    }

    for (const vn of view.nodes) {
      const p = positions.get(vn.id);
      const b = vn.isGroup ? '' : badgeOf(vn);
      const g = svgEl('g', { class: 'sm-node' + (vn.isGroup ? ' is-group' : '') + (b ? ' sm-b-' + b : ''),
        transform: 'translate(' + p.x + ',' + p.y + ')', tabindex: 0, role: 'button' });
      g.setAttribute('aria-label', vLabel(vn) + (vn.isGroup ? '' : ', ' + vn.type + (b ? ', ' + badgeText(b) : '')));
      g.appendChild(svgEl('title', null, vLabel(vn)));
      g.appendChild(svgEl('rect', { class: 'sm-node-box', width: NW, height: NH, rx: 9 }));
      const stripe = svgEl('rect', { x: 0, y: 8, width: 4, height: NH - 16, rx: 2 });
      stripe.style.fill = vn.isGroup ? 'var(--c-neutral)' : typeColor(vn.type);
      g.appendChild(stripe);
      g.appendChild(svgEl('text', { class: 'sm-node-label', x: 14, y: 24 }, clip(vLabel(vn), 25)));
      const counts = vn.isGroup ? '' : countsText(vn);
      g.appendChild(svgEl('text', { class: 'sm-node-sub', x: 14, y: 43 }, vn.isGroup ? t('group') : vn.type + (counts ? '   ' + counts : '')));
      if (b && b !== 'unchanged' && b !== 'existing') {
        g.appendChild(svgEl('text', { class: 'sm-node-badge', x: NW - 10, y: 43, 'text-anchor': 'end' }, badgeText(b)));
      }
      g.addEventListener('click', (ev) => { ev.stopPropagation(); select(vn.id); });
      g.addEventListener('dblclick', () => { if (vn.isGroup) { state.collapsed.delete(vn.group); state.selected = null; rebuild(true); renderInspector(); } });
      g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(vn.id); } });
      layerNodes.appendChild(g);
      nodeEls.set(vn.id, g);
    }
  }

  const haystack = new Map(nodes.map((n) => [n.id, [n.id, n.type, typeof n.label === 'string' ? n.label : Object.values(n.label || {}).join(' '),
    typeof n.description === 'string' ? n.description : Object.values(n.description || {}).join(' '),
    (n.evidence || []).map((e) => e.path + ' ' + (e.symbol || '')).join(' ')].join(' ').toLowerCase()]));
  function matches(vn, q) {
    return vn.isGroup ? vn.members.some((m) => haystack.get(m.id).includes(q)) : haystack.get(vn.id).includes(q);
  }

  // Applies selection / search / highlight classes without rebuilding the SVG.
  function paint() {
    const q = state.query.trim().toLowerCase();
    const sel = state.selected && view.ids.has(state.selected) ? state.selected : null;
    const hl = sel && state.highlight !== 'none' ? related(sel, state.highlight, view.edges) : null;
    const dim = new Map();
    for (const vn of view.nodes) {
      const el = nodeEls.get(vn.id);
      const hit = q ? matches(vn, q) : false;
      const kindMiss = state.kind !== 'all' && vn.id !== sel &&
        !(vn.isGroup ? vn.members.some((m) => kindsOf(m).has(state.kind)) : kindsOf(vn).has(state.kind));
      const isDim = (q && !hit && vn.id !== sel) || (hl && !hl.has(vn.id)) || kindMiss;
      dim.set(vn.id, !!isDim);
      el.classList.toggle('is-match', hit);
      el.classList.toggle('is-dim', !!isDim);
      el.classList.toggle('is-selected', vn.id === sel);
    }
    for (const e of edgeEls) {
      const active = !!hl && (state.highlight === 'neighbors' ? e.source === sel || e.target === sel : hl.has(e.source) && hl.has(e.target));
      e.el.classList.toggle('is-active', active);
      e.el.classList.toggle('is-dim', hl ? !active : dim.get(e.source) || dim.get(e.target));
    }
  }

  /* ===== 7. Panels ===== */
  function field(title, body) { return body ? h('div', { class: 'sm-field' }, [h('h4', { text: title }), body]) : null; }
  function para(v, tag) {
    if (!L(v)) return null;
    const wrap = h('div');
    wrap.appendChild(h(tag || 'p', { text: L(v) }));
    if (L2(v)) wrap.appendChild(h(tag || 'p', { class: 'sm-second', text: L2(v) }));
    return wrap;
  }
  function nodeButtons(list, pickId) {
    if (!list.length) return null;
    return h('div', null, list.map((e) => {
      const other = nodeById.get(pickId(e));
      const detail = L(e.label) || e.type || '';
      return h('button', { class: 'sm-item', type: 'button', onclick: () => select(other.id, true) },
        [h('span', { text: L(other.label) }), detail ? h('span', { class: 'sm-count', text: detail }) : null]);
    }));
  }
  function highlightButton(mode, label) {
    return h('button', { class: 'sm-btn', type: 'button', 'aria-pressed': String(state.highlight === mode), text: label,
      onclick: () => { state.highlight = mode; if (state.focus) rebuild(true); else paint(); renderInspector(); } });
  }

  function whyRows(why) {
    const rows = ['fact', 'inference', 'unknown'].filter((k) => why && L(why[k])).map((k) => {
      const row = h('p', { class: 'sm-why' }, [h('span', { class: 'sm-tag sm-tag-' + k, text: t(k) })]);
      row.appendChild(document.createTextNode(' ' + L(why[k])));
      if (L2(why[k])) row.appendChild(h('span', { class: 'sm-second', text: ' ' + L2(why[k]) }));
      return row;
    });
    return rows.length ? h('div', null, rows) : null;
  }
  function codeList(values) {
    const list = [].concat(values || []).filter(Boolean);
    return list.length ? h('ul', { class: 'sm-ev' }, list.map((v) => h('li', null, [h('code', { text: String(v) })]))) : null;
  }
  function evidenceList(evidence) {
    if (!(evidence || []).length) return null;
    return h('ul', { class: 'sm-ev' }, evidence.map((e) => h('li', null, [
      h('code', { text: e.path + (e.line != null ? ':' + e.line : '') }),
      e.symbol ? document.createTextNode(' ') : null,
      e.symbol ? h('code', { class: 'sm-sym', text: e.symbol }) : null,
    ])));
  }
  // Detail block for one changed symbol inside the inspector.
  function itemDetail(c) {
    const box = h('div', { class: 'sm-detail' });
    const add = (title, body) => { const f = field(title, body); if (f) box.appendChild(f); };
    const text = para(c.explanation);
    if (text) box.appendChild(text);
    if (c.from || c.to) add(t('from') + ' → ' + t('to'), h('p', null, [h('code', { text: c.from || '?' }), document.createTextNode(' → '), h('code', { text: c.to || '?' })]));
    add(t('before'), para(c.before, 'pre'));
    add(t('after'), para(c.after, 'pre'));
    add(t('why'), whyRows(c.why));
    add(t('replacedBy'), codeList(c.replacedBy));
    add(t('calledBy'), codeList(c.calledBy));
    add(t('calls'), codeList(c.calls));
    add(t('learn'), para(c.learn));
    add(t('evidence'), evidenceList(c.evidence));
    return box;
  }

  function renderInspector() {
    while (inspectEl.firstChild) inspectEl.removeChild(inspectEl.firstChild);
    const id = state.selected;
    if (!id) { inspectEl.appendChild(h('p', { class: 'sm-empty', text: t('empty') })); return; }

    const actions = h('div', { class: 'sm-actions' }, [
      highlightButton('neighbors', t('connected')), highlightButton('out', t('hlOut')), highlightButton('in', t('hlIn')),
      h('button', { class: 'sm-btn', type: 'button', 'aria-pressed': String(state.focus), text: t('focus'),
        onclick: () => { state.focus = !state.focus; rebuild(true); renderInspector(); } }),
      h('button', { class: 'sm-btn', type: 'button', text: t('clear'), onclick: () => clearSelection() }),
    ]);

    if (id.startsWith('group:')) {
      const g = groupById.get(id.slice(6)) || { id: id.slice(6), label: id.slice(6) };
      const members = nodes.filter((n) => n.group === g.id);
      inspectEl.appendChild(h('h3', { text: L(g.label) }));
      inspectEl.appendChild(actions);
      inspectEl.appendChild(h('button', { class: 'sm-btn', type: 'button', text: t('expand'),
        onclick: () => { state.collapsed.delete(g.id); state.selected = null; rebuild(true); renderInspector(); } }));
      inspectEl.appendChild(field(t('members'), h('div', null, members.map((m) =>
        h('button', { class: 'sm-item', type: 'button', onclick: () => select(m.id, true) }, [h('span', { text: L(m.label) })])))));
      return;
    }

    const n = nodeById.get(id);
    if (!n) return;
    const b = badgeOf(n);
    inspectEl.appendChild(h('h3', { text: L(n.label) }));
    if (L2(n.label)) inspectEl.appendChild(h('p', { class: 'sm-second', text: L2(n.label) }));
    inspectEl.appendChild(h('div', { class: 'sm-chips' }, [
      h('span', { class: 'sm-chip', text: n.type }),
      b ? h('span', { class: 'sm-chip sm-b-' + b, text: badgeText(b) }) : null,
      n.confidence ? h('span', { class: 'sm-tag sm-tag-' + n.confidence, text: t(n.confidence) }) : null,
    ]));
    inspectEl.appendChild(actions);

    const add = (title, body) => { const f = field(title, body); if (f) inspectEl.appendChild(f); };
    add(t('overview'), para(n.description));
    add(t('whatChanged'), para(n.explanation));
    if (itemsOf(n).length) {
      const box = h('div');
      itemsOf(n).forEach((c, i) => {
        const open = state.item === i;
        box.appendChild(h('button', { class: 'sm-item sm-sym-item sm-k-' + KIND_OF[c.kind], type: 'button', 'aria-expanded': String(open),
          onclick: () => { state.item = open ? null : i; renderInspector(); } },
          [h('span', { text: SIGIL[c.kind] + ' ' + c.label }), h('span', { class: 'sm-count', text: t('k_' + KIND_OF[c.kind]) })]));
        if (open) box.appendChild(itemDetail(c));
      });
      add(t('symbols'), box);
    }
    add(t('before'), para(n.before, 'pre'));
    add(t('after'), para(n.after, 'pre'));
    if (n.why) {
      const rows = ['fact', 'inference', 'unknown'].filter((k) => L(n.why[k])).map((k) => {
        const row = h('p', { class: 'sm-why' }, [h('span', { class: 'sm-tag sm-tag-' + k, text: t(k) })]);
        row.appendChild(document.createTextNode(' ' + L(n.why[k])));
        if (L2(n.why[k])) row.appendChild(h('span', { class: 'sm-second', text: ' ' + L2(n.why[k]) }));
        return row;
      });
      if (rows.length) add(t('why'), h('div', null, rows));
    }
    const rel = { out: edges.filter((e) => e.source === id && nodeById.has(e.target)), inn: edges.filter((e) => e.target === id && nodeById.has(e.source)) };
    add(t('out'), nodeButtons(rel.out, (e) => e.target));
    add(t('inn'), nodeButtons(rel.inn, (e) => e.source));
    add(t('runtime'), para(n.runtime));
    add(t('tests'), para(n.tests));
    add(t('risks'), para(n.risks));
    add(t('learn'), para(n.learn));
    add(t('task'), para(n.task));
    if ((n.evidence || []).length) {
      add(t('evidence'), h('ul', { class: 'sm-ev' }, n.evidence.map((e) => h('li', null, [
        h('code', { text: e.path + (e.line != null ? ':' + e.line : '') }),
        e.symbol ? document.createTextNode(' ') : null,
        e.symbol ? h('code', { class: 'sm-sym', text: e.symbol }) : null,
      ]))));
    }
  }

  function checkbox(label, checked, onchange, swatch, count) {
    const input = h('input', { type: 'checkbox' });
    input.checked = checked;
    input.addEventListener('change', () => onchange(input.checked));
    return h('label', { class: 'sm-check' }, [input, swatch || null, h('span', { text: label }), h('span', { class: 'sm-count', text: String(count) })]);
  }

  function renderSide() {
    const keepQuery = state.query;
    while (sideEl.firstChild) sideEl.removeChild(sideEl.firstChild);
    searchEl = h('input', { class: 'sm-search', type: 'search', placeholder: t('search'), 'aria-label': t('search') });
    searchEl.value = keepQuery;
    searchEl.addEventListener('input', () => { state.query = searchEl.value; paint(); });
    searchEl.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const q = state.query.trim().toLowerCase();
      const hit = q && nodes.find((n) => haystack.get(n.id).includes(q));
      if (hit) select(hit.id, true);
    });
    sideEl.appendChild(searchEl);

    const isChanged = (n) => (n.change && n.change !== 'unchanged') || itemsOf(n).length > 0;
    if (nodes.some(isChanged)) {
      // Change-type filter: dims everything that has no change of the chosen kind.
      sideEl.appendChild(h('div', { class: 'sm-actions' }, ['all'].concat(KINDS).map((k) =>
        h('button', { class: 'sm-btn', type: 'button', 'aria-pressed': String(state.kind === k), text: (k === 'all' ? '' : SIGIL[k] + ' ') + t(k === 'all' ? 'all' : 'k_' + k),
          onclick: () => { state.kind = k; renderSide(); paint(); } }))));
      const wanted = (n) => isChanged(n) && (state.kind === 'all' || kindsOf(n).has(state.kind));
      const rows = [];
      nodes.filter(wanted).forEach((n) => {
        rows.push(h('button', { class: 'sm-item', type: 'button', onclick: () => select(n.id, true) },
          [h('span', { text: L(n.label) }), n.change ? h('span', { class: 'sm-chip sm-b-' + n.change, text: badgeText(n.change) }) : null]));
        itemsOf(n).forEach((c, i) => {
          if (state.kind !== 'all' && KIND_OF[c.kind] !== state.kind) return;
          rows.push(h('button', { class: 'sm-item sm-sym-item sm-k-' + KIND_OF[c.kind], type: 'button', onclick: () => select(n.id, true, i) },
            [h('span', { text: SIGIL[c.kind] + ' ' + c.label })]));
        });
      });
      sideEl.appendChild(field(t('changed'), h('div', null, rows)));
    }
    sideEl.appendChild(field(t('types'), h('div', null, types.map((type) => {
      const sw = h('span', { class: 'sm-swatch' });
      sw.style.background = typeColor(type);
      return checkbox(type, !state.hiddenTypes.has(type), (on) => { on ? state.hiddenTypes.delete(type) : state.hiddenTypes.add(type); rebuild(true); },
        sw, nodes.filter((n) => n.type === type).length);
    }))));
    if (badges.length > 1 && !hasChanges) {
      sideEl.appendChild(field(t(hasChanges ? 'change' : 'status'), h('div', null, badges.map((b) =>
        checkbox(badgeText(b), !state.hiddenBadges.has(b), (on) => { on ? state.hiddenBadges.delete(b) : state.hiddenBadges.add(b); rebuild(true); },
          null, nodes.filter((n) => badgeOf(n) === b).length)))));
    }
  }

  function renderLangSwitch() {
    const box = document.getElementById('showme-lang');
    if (!box || !canSwitch) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    box.hidden = false;
    box.setAttribute('role', 'group');
    ['th', 'en'].forEach((l) => box.appendChild(h('button', { type: 'button', text: l.toUpperCase(), 'aria-pressed': String(state.lang === l),
      onclick: () => setLang(l) })));
  }

  /* ===== 8. Interaction ===== */
  function applyView() { viewport.setAttribute('transform', 'translate(' + state.view.x + ',' + state.view.y + ') scale(' + state.view.k + ')'); }

  function fit() {
    const box = svg.getBoundingClientRect();
    const ps = [...positions.values()];
    if (!ps.length || !box.width) return;
    const x0 = Math.min(...ps.map((p) => p.x)) - 30, y0 = Math.min(...ps.map((p) => p.y)) - 44;
    const x1 = Math.max(...ps.map((p) => p.x)) + NW + 30, y1 = Math.max(...ps.map((p) => p.y)) + NH + 30;
    const k = Math.min(box.width / (x1 - x0), box.height / (y1 - y0), 1.2);
    state.view = { k, x: (box.width - (x1 - x0) * k) / 2 - x0 * k, y: (box.height - (y1 - y0) * k) / 2 - y0 * k };
    applyView();
  }

  function zoomBy(factor, cx, cy) {
    const box = svg.getBoundingClientRect();
    const px = cx == null ? box.width / 2 : cx - box.left, py = cy == null ? box.height / 2 : cy - box.top;
    const k = Math.min(3, Math.max(0.15, state.view.k * factor));
    state.view.x = px - (px - state.view.x) * (k / state.view.k);
    state.view.y = py - (py - state.view.y) * (k / state.view.k);
    state.view.k = k;
    applyView();
  }

  function centerOn(id) {
    const p = positions.get(id);
    const box = svg.getBoundingClientRect();
    if (!p || !box.width) return;
    state.view.x = box.width / 2 - (p.x + NW / 2) * state.view.k;
    state.view.y = box.height / 2 - (p.y + NH / 2) * state.view.k;
    applyView();
  }

  function rebuild(refit) {
    view = computeView();
    positions = layout(view.nodes, view.edges);
    draw();
    paint();
    if (refit) fit();
  }

  // Makes a node visible again if a filter, a collapsed group or focus mode hides it.
  function reveal(id) {
    const n = nodeById.get(id);
    if (!n) return false;
    let changed = false;
    if (state.hiddenTypes.delete(n.type)) changed = true;
    if (state.hiddenBadges.delete(badgeOf(n))) changed = true;
    if (n.group && state.collapsed.delete(n.group)) changed = true;
    if (state.focus && !view.ids.has(id)) { state.focus = false; changed = true; }
    return changed;
  }

  function select(id, center, item) {
    const revealed = !id.startsWith('group:') && !view.ids.has(id) ? reveal(id) : false;
    state.selected = id;
    state.item = item == null ? null : item;
    if (state.highlight === 'none') state.highlight = 'neighbors';
    if (revealed) { renderSide(); rebuild(true); }
    else if (state.focus) rebuild(true);
    else paint();
    renderInspector();
    if (center && !state.focus) centerOn(id);
  }

  function clearSelection() {
    const wasFocus = state.focus;
    state.selected = null;
    state.focus = false;
    if (wasFocus) rebuild(true); else paint();
    renderInspector();
  }

  function resetAll() {
    state.selected = null; state.item = null; state.kind = 'all'; state.focus = false; state.query = ''; state.highlight = 'neighbors';
    state.hiddenTypes.clear(); state.hiddenBadges.clear(); state.collapsed.clear();
    renderSide(); rebuild(true); renderInspector();
  }

  function setLang(l) {
    state.lang = l;
    document.documentElement.lang = l;
    document.documentElement.setAttribute('data-lang', l);
    renderLangSwitch(); renderToolbar(); renderSide(); rebuild(false); renderInspector();
    svg.setAttribute('aria-label', t('graph'));
  }

  let toolbarEl;
  function renderToolbar() {
    while (toolbarEl.firstChild) toolbarEl.removeChild(toolbarEl.firstChild);
    const btn = (label, title, fn) => h('button', { class: 'sm-btn', type: 'button', text: label, title: title, 'aria-label': title, onclick: fn });
    toolbarEl.appendChild(btn('+', t('zoomIn'), () => zoomBy(1.25)));
    toolbarEl.appendChild(btn('−', t('zoomOut'), () => zoomBy(0.8)));
    toolbarEl.appendChild(btn(t('fit'), t('fit'), fit));
    toolbarEl.appendChild(btn(t('reset'), t('reset'), resetAll));
  }

  function bindCanvas() {
    let drag = null;
    svg.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('.sm-node, .sm-group-head')) return;
      drag = { x: ev.clientX, y: ev.clientY, vx: state.view.x, vy: state.view.y, moved: false };
      svg.setPointerCapture(ev.pointerId);
      svg.classList.add('is-dragging');
    });
    svg.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      state.view.x = drag.vx + dx; state.view.y = drag.vy + dy;
      applyView();
    });
    const end = () => {
      if (drag && !drag.moved && state.selected) clearSelection();
      drag = null;
      svg.classList.remove('is-dragging');
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (ev) => { ev.preventDefault(); zoomBy(Math.exp(-ev.deltaY * 0.0015), ev.clientX, ev.clientY); }, { passive: false });
    host.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && state.selected) clearSelection(); });
    window.addEventListener('resize', fit);
  }

  /* ===== 9. Boot ===== */
  sideEl = h('aside', { class: 'sm-side' });
  inspectEl = h('aside', { class: 'sm-inspect', 'aria-live': 'polite' });
  toolbarEl = h('div', { class: 'sm-toolbar' });
  svg = svgEl('svg', { class: 'sm-canvas', role: 'group' });
  svg.setAttribute('aria-label', t('graph'));
  const defs = svgEl('defs');
  const marker = svgEl('marker', { id: 'sm-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: 'auto-start-reverse' });
  marker.appendChild(svgEl('path', { class: 'sm-arrowhead', d: 'M0,0 L10,5 L0,10 z' }));
  defs.appendChild(marker);
  svg.appendChild(defs);
  viewport = svgEl('g');
  layerGroups = svgEl('g'); layerEdges = svgEl('g'); layerNodes = svgEl('g');
  viewport.appendChild(layerGroups); viewport.appendChild(layerEdges); viewport.appendChild(layerNodes);
  svg.appendChild(viewport);
  host.appendChild(sideEl);
  host.appendChild(h('div', { class: 'sm-stage' }, [toolbarEl, svg]));
  host.appendChild(inspectEl);
  host.hidden = false;
  const staticMap = document.getElementById('showme-static');
  if (staticMap) staticMap.open = false;

  renderLangSwitch(); renderToolbar(); renderSide(); bindCanvas();
  rebuild(true);
  renderInspector();

  // Deep link: index.html#node-<id> opens the page with that node selected.
  const fromHash = () => {
    // "#node-<id>" selects a node; "#node-<id>:<n>" also opens its n-th changed symbol.
    const m = /^#node-(.+?)(?::(\d+))?$/.exec(decodeURIComponent(location.hash));
    if (m && nodeById.has(m[1])) select(m[1], true, m[2] == null ? null : Number(m[2]));
  };
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
