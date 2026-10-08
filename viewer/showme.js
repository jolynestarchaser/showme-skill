/* showme reader + explorer: dependency-free, driven by the inline graph.json.
   Sections: 1 data · 2 i18n · 3 state + preferences · 4 view model · 5 layout · 6 rendering
             · 7 panels · 8 reading modes + steps · 9 interaction · 10 boot */
(function () {
  'use strict';

  /* ===== 1. Data ===== */
  const dataEl = document.getElementById('showme-graph');
  const host = document.getElementById('showme-explorer');
  if (!dataEl || !host) return;
  let graph;
  try { graph = JSON.parse(dataEl.textContent); } catch (err) { return; }

  const root = document.documentElement;
  const meta = graph.meta || {};
  const nodes = graph.nodes || [];
  const edges = (graph.edges || []).filter((e) => e.source !== e.target);
  const groups = graph.groups || [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const FLOW = (meta.edges || (meta.mode === 'repo' || meta.mode === 'oop' ? 'dependency' : 'flow')) === 'flow';
  const badgeOf = (n) => n.change || n.status || '';
  const hasChanges = nodes.some((n) => n.change);
  const types = [...new Set(nodes.map((n) => n.type))];
  const badges = [...new Set(nodes.map(badgeOf).filter(Boolean))];
  const typeColor = (type) => 'var(--t' + (Math.max(0, types.indexOf(type)) % 8) + ')';

  // Derived by the build script from the graph itself: the key node and one critical path through it.
  const derived = graph._derived || {};
  const keyNodeId = nodeById.has(derived.key) ? derived.key : null;
  const pathIds = Array.isArray(derived.path) && derived.path.length >= 3 && derived.path.every((id) => nodeById.has(id)) ? derived.path : null;
  const pathIsPartial = !!pathIds && pathIds.length < nodes.length;

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

  /* ===== 2. i18n ===== */
  const STR = {
    en: { search: 'Search nodes', changed: 'Changed', types: 'Node types', change: 'Change', status: 'Status',
      fit: 'Fit', reset: 'Reset', zoomIn: 'Zoom in', zoomOut: 'Zoom out', empty: 'Select a node to see what it is, why it matters and how it is connected.',
      overview: 'Overview', whatChanged: 'What changed', before: 'Before', after: 'After', why: 'Why this shape',
      fact: 'FACT', inference: 'INFERENCE', unknown: 'UNKNOWN', runtime: 'Runtime impact', tests: 'Tests', risks: 'Risks',
      learn: 'Learning', evidence: 'Evidence', task: 'Related task', out: FLOW ? 'Leads to' : 'Depends on',
      inn: FLOW ? 'Comes from' : 'Used by', connected: 'Connected', hlOut: FLOW ? 'Downstream' : 'Upstream dependencies',
      hlIn: FLOW ? 'Upstream' : 'Downstream dependents', focus: 'Focus', clear: 'Clear', expand: 'Expand group',
      collapse: 'Collapse group', members: 'Members', group: 'group', graph: 'Interactive graph', confidence: 'Confidence',
      symbols: 'Changed symbols', all: 'All', k_added: 'Added', k_removed: 'Removed', k_modified: 'Modified', k_moved: 'Moved',
      from: 'From', to: 'To', replacedBy: 'Replaced by', calledBy: 'Called by', calls: 'Calls',
      mScan: 'Scan', mUnderstand: 'Understand', mDeep: 'Deep Dive', modes: 'Reading mode',
      fullGraph: 'View full graph', pathOnly: 'Critical path only', scopeNote: 'Showing {a} of {b} nodes', filters: 'Search and filters', details: 'Details panel',
      qWhat: 'What is it?', qWhy: 'Why does it matter?', qHow: 'How is it connected?', na: 'Not available in source', noLinks: 'No recorded connections',
      copy: 'Copy', copied: 'Copied', copyFail: 'Press Ctrl+C', inferredEdge: 'inferred', hasRisk: 'has recorded risks', selected: 'selected',
      fontDown: 'Smaller text', fontUp: 'Larger text', fontReset: 'Reset text size', theme: 'Theme', tAuto: 'Auto', tLight: 'Light', tDark: 'Dark',
      width: 'Reading width', wNarrow: 'Narrow', wNormal: 'Normal', wWide: 'Wide' },
    th: { search: 'ค้นหา node', changed: 'สิ่งที่เปลี่ยน', types: 'ประเภท node', change: 'การเปลี่ยนแปลง', status: 'สถานะ',
      fit: 'พอดีจอ', reset: 'รีเซ็ต', zoomIn: 'ขยาย', zoomOut: 'ย่อ', empty: 'เลือก node เพื่อดูว่าคืออะไร สำคัญอย่างไร และเชื่อมกับส่วนใด',
      overview: 'ภาพรวม', whatChanged: 'สิ่งที่เปลี่ยน', before: 'ก่อน', after: 'หลัง', why: 'ทำไมถึงออกแบบแบบนี้',
      fact: 'FACT', inference: 'INFERENCE', unknown: 'UNKNOWN', runtime: 'ผลตอน runtime', tests: 'Tests', risks: 'ความเสี่ยง',
      learn: 'สิ่งที่ได้เรียนรู้', evidence: 'หลักฐาน', task: 'งานที่เกี่ยวข้อง', out: FLOW ? 'ไปต่อที่' : 'พึ่งพา',
      inn: FLOW ? 'มาจาก' : 'ถูกใช้โดย', connected: 'ที่เชื่อมกัน', hlOut: FLOW ? 'ปลายทาง (downstream)' : 'dependency ต้นทาง',
      hlIn: FLOW ? 'ต้นทาง (upstream)' : 'ผู้ใช้ปลายทาง', focus: 'โฟกัส', clear: 'ล้าง', expand: 'ขยายกลุ่ม',
      collapse: 'ย่อกลุ่ม', members: 'สมาชิก', group: 'กลุ่ม', graph: 'กราฟแบบโต้ตอบ', confidence: 'ความมั่นใจ',
      symbols: 'symbol ที่เปลี่ยน', all: 'ทั้งหมด', k_added: 'เพิ่ม', k_removed: 'ลบ', k_modified: 'แก้ไข', k_moved: 'ย้าย',
      from: 'จาก', to: 'ไปที่', replacedBy: 'ถูกแทนที่ด้วย', calledBy: 'ถูกเรียกโดย', calls: 'เรียกต่อ',
      mScan: 'Scan', mUnderstand: 'Understand', mDeep: 'Deep Dive', modes: 'โหมดการอ่าน',
      fullGraph: 'ดู graph ทั้งหมด', pathOnly: 'เฉพาะเส้นทางหลัก', scopeNote: 'แสดง {a} จาก {b} node', filters: 'ค้นหาและตัวกรอง', details: 'แผงรายละเอียด',
      qWhat: 'คืออะไร?', qWhy: 'สำคัญอย่างไร?', qHow: 'เชื่อมกับอะไร?', na: 'ไม่มีข้อมูลนี้ใน source', noLinks: 'ไม่มีการเชื่อมต่อที่บันทึกไว้',
      copy: 'คัดลอก', copied: 'คัดลอกแล้ว', copyFail: 'กด Ctrl+C', inferredEdge: 'สันนิษฐาน', hasRisk: 'มีความเสี่ยงที่บันทึกไว้', selected: 'เลือกอยู่',
      fontDown: 'ลดขนาดตัวอักษร', fontUp: 'เพิ่มขนาดตัวอักษร', fontReset: 'คืนค่าขนาดตัวอักษร', theme: 'ธีม', tAuto: 'อัตโนมัติ', tLight: 'สว่าง', tDark: 'มืด',
      width: 'ความกว้างการอ่าน', wNarrow: 'แคบ', wNormal: 'ปกติ', wWide: 'กว้าง' },
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

  /* ===== 3. State + preferences ===== */
  const state = {
    lang: String(meta.language || 'en').split('-')[0] === 'th' ? 'th' : 'en',
    mode: 'understand', step: 1, scope: pathIds ? 'path' : 'full', side: false, inspect: true,
    selected: null, item: null, kind: 'all', highlight: 'neighbors', focus: false, query: '',
    hiddenTypes: new Set(), hiddenBadges: new Set(), collapsed: new Set(), open: {},
    view: { x: 0, y: 0, k: 1 },
  };
  const t = (key) => STR[state.lang][key] || STR.en[key] || key;
  const L = (v) => (v == null ? '' : typeof v === 'string' ? v : v[state.lang] || v[otherLang(state.lang)] || '');
  const L2 = (v) => (bilingual && v && typeof v === 'object' && v[state.lang] && v[otherLang(state.lang)] ? v[otherLang(state.lang)] : '');
  const badgeText = (b) => (BADGE[state.lang][b] || b).toUpperCase();

  // Reading preferences live only in this browser. Storage can be unavailable, so every access is guarded.
  const PREF_KEY = 'showme.prefs';
  const WIDTHS = { narrow: '62ch', normal: '72ch', wide: '86ch' };
  const prefs = { size: 17, theme: 'auto', width: 'normal' };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (err) { /* defaults */ }
  function applyPrefs(save) {
    prefs.size = Math.min(22, Math.max(14, Number(prefs.size) || 17));
    if (!WIDTHS[prefs.width]) prefs.width = 'normal';
    root.style.setProperty('--reader-size', prefs.size + 'px');
    root.style.setProperty('--reader-width', WIDTHS[prefs.width]);
    if (prefs.theme === 'light' || prefs.theme === 'dark') root.setAttribute('data-theme', prefs.theme); else root.removeAttribute('data-theme');
    if (save) { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (err) { /* not persisted */ } }
  }

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
    const inScope = (n) => state.scope === 'full' || !pathIds || pathIds.includes(n.id);
    for (const n of nodes) {
      if (!inScope(n) || state.hiddenTypes.has(n.type) || state.hiddenBadges.has(badgeOf(n))) continue;
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
    const sel = state.selected;
    const selRep = sel && (rep.get(sel) || (sel.startsWith('group:') && groupNodes.has(sel.slice(6)) ? sel : null));
    if (state.focus && selRep) {
      const keep = related(selRep, state.highlight === 'none' ? 'neighbors' : state.highlight, vedges);
      vnodes = vnodes.filter((n) => keep.has(n.id));
      vedges = vedges.filter((e) => keep.has(e.source) && keep.has(e.target));
    }
    return { nodes: vnodes, edges: vedges, ids: new Set(vnodes.map((n) => n.id)) };
  }

  /* ===== 5. Layout: layered left-to-right, barycenter ordering ===== */
  const NW = 216, NH = 62, GX = 96, GY = 28;

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
    cols.forEach((col) => col.forEach((id, i) => order.set(id, i)));
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
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  let svg, viewport, layerGroups, layerEdges, layerNodes, sideEl, inspectEl, searchEl, toolbarEl;
  const nodeEls = new Map();
  const edgeEls = [];

  function vLabel(vn) { return vn.isGroup ? '▸ ' + L(vn.label) + ' (' + vn.members.length + ')' : L(vn.label); }

  function draw() {
    [layerGroups, layerEdges, layerNodes].forEach(clear);
    nodeEls.clear();
    edgeEls.length = 0;

    for (const g of groups) {
      if (state.collapsed.has(g.id)) continue;
      const members = view.nodes.filter((n) => !n.isGroup && n.group === g.id);
      if (!members.length) continue;
      const ps = members.map((n) => positions.get(n.id));
      const x0 = Math.min(...ps.map((p) => p.x)) - 14, y0 = Math.min(...ps.map((p) => p.y)) - 32;
      const x1 = Math.max(...ps.map((p) => p.x)) + NW + 14, y1 = Math.max(...ps.map((p) => p.y)) + NH + 14;
      layerGroups.appendChild(svgEl('rect', { class: 'sm-group-box', x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 12 }));
      const head = svgEl('text', { class: 'sm-group-head', x: x0 + 10, y: y0 + 19, tabindex: 0, role: 'button' }, '▾ ' + L(g.label));
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
      // An inferred edge is dashed and says so in words, so the meaning never rests on line style alone.
      const base = L(ve.edge.label) || ve.edge.type || '';
      const text = clip(base, 28) + (inferred ? (base ? ' · ' : '') + '≈ ' + t('inferredEdge') : '');
      if (text) {
        wrap.appendChild(svgEl('text', { class: 'sm-edge-label', 'text-anchor': 'middle',
          x: (x1 + 3 * c1x + 3 * c2x + x2) / 8, y: (y1 + 3 * c1y + 3 * c2y + y2) / 8 - 5 }, text));
      }
      layerEdges.appendChild(wrap);
      edgeEls.push({ el: wrap, source: ve.source, target: ve.target });
    }

    for (const vn of view.nodes) {
      const p = positions.get(vn.id);
      const b = vn.isGroup ? '' : badgeOf(vn);
      const inferredNode = !vn.isGroup && vn.confidence && vn.confidence !== 'fact';
      const g = svgEl('g', { class: 'sm-node' + (vn.isGroup ? ' is-group' : '') + (b ? ' sm-b-' + b : '') + (inferredNode ? ' is-inferred' : ''),
        transform: 'translate(' + p.x + ',' + p.y + ')', tabindex: 0, role: 'button' });
      const warn = !vn.isGroup && !!L(vn.risks);
      g.setAttribute('aria-label', vLabel(vn) + (vn.isGroup ? '' : ', ' + vn.type + (b ? ', ' + badgeText(b) : '') + (warn ? ', ' + t('hasRisk') : '')));
      g.appendChild(svgEl('title', null, vLabel(vn)));
      g.appendChild(svgEl('rect', { class: 'sm-node-ring', x: -5, y: -5, width: NW + 10, height: NH + 10, rx: 13 }));
      g.appendChild(svgEl('rect', { class: 'sm-node-box', width: NW, height: NH, rx: 9 }));
      const stripe = svgEl('rect', { x: 0, y: 9, width: 4, height: NH - 18, rx: 2 });
      stripe.style.fill = vn.isGroup ? 'var(--c-neutral)' : typeColor(vn.type);
      g.appendChild(stripe);
      g.appendChild(svgEl('text', { class: 'sm-node-label', x: 14, y: 26 }, clip(vLabel(vn), warn ? 22 : 25)));
      if (warn) g.appendChild(svgEl('text', { class: 'sm-node-warn', x: NW - 12, y: 25, 'text-anchor': 'end' }, '⚠'));
      const counts = vn.isGroup ? '' : countsText(vn);
      g.appendChild(svgEl('text', { class: 'sm-node-sub', x: 14, y: 47 }, vn.isGroup ? t('group') : vn.type + (counts ? '   ' + counts : '')));
      if (b && b !== 'unchanged' && b !== 'existing') {
        g.appendChild(svgEl('text', { class: 'sm-node-badge', x: NW - 12, y: 47, 'text-anchor': 'end' }, badgeText(b)));
      }
      g.addEventListener('click', (ev) => { ev.stopPropagation(); select(vn.id); });
      g.addEventListener('dblclick', () => { if (vn.isGroup) { state.collapsed.delete(vn.group); state.selected = null; rebuild(true); renderInspector(); } });
      g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(vn.id); } });
      layerNodes.appendChild(g);
      nodeEls.set(vn.id, g);
    }
  }

  const flat = (v) => (typeof v === 'string' ? v : Object.values(v || {}).join(' '));
  const haystack = new Map(nodes.map((n) => [n.id, [n.id, n.type, flat(n.label), flat(n.description),
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
  function para(v, tag) {
    if (!L(v)) return null;
    const wrap = h('div');
    wrap.appendChild(h(tag || 'p', { text: L(v) }));
    if (L2(v)) wrap.appendChild(h(tag || 'p', { class: 'sm-second', text: L2(v) }));
    return wrap;
  }
  function field(title, body) { return body ? h('div', { class: 'sm-field' }, [h('h4', { text: title }), body]) : null; }

  // Copies a source reference. No link is ever invented: a path that cannot be opened is still copyable.
  function copyButton(text) {
    const btn = h('button', { class: 'sm-copy', type: 'button', text: t('copy') });
    btn.setAttribute('aria-label', t('copy') + ': ' + text);
    const done = (ok) => {
      btn.textContent = t(ok ? 'copied' : 'copyFail');
      btn.classList.toggle('is-done', ok);
      setTimeout(() => { btn.textContent = t('copy'); btn.classList.remove('is-done'); }, 1600);
    };
    btn.addEventListener('click', () => {
      const legacy = () => {
        const ta = h('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        ta.remove(); done(ok);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), legacy);
      else legacy();
    });
    return btn;
  }
  const evidenceText = (e) => e.path + (e.line != null ? ':' + e.line : '') + (e.symbol ? ' ' + e.symbol : '');
  function evidenceList(evidence) {
    if (!(evidence || []).length) return null;
    return h('ul', { class: 'sm-ev' }, evidence.map((e) => h('li', null, [
      h('code', { text: e.path + (e.line != null ? ':' + e.line : '') }),
      e.symbol ? h('code', { class: 'sm-sym', text: e.symbol }) : null,
      copyButton(evidenceText(e)),
    ])));
  }
  // The statically rendered evidence lists (steps, cards, reference table) get the same copy button.
  function enhanceStaticEvidence() {
    document.querySelectorAll('main ul.sm-ev > li').forEach((li) => {
      if (li.closest('.sm-explorer') || li.querySelector('.sm-copy')) return;
      const text = [...li.querySelectorAll('code')].map((c) => c.textContent).join(' ');
      if (text) li.appendChild(copyButton(text));
    });
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
  function nodeButtons(list, pickId) {
    if (!list.length) return null;
    return h('div', null, list.map((e) => {
      const other = nodeById.get(pickId(e));
      const inferred = e.confidence && e.confidence !== 'fact';
      const detail = (L(e.label) || e.type || '') + (inferred ? ' · ≈ ' + t('inferredEdge') : '');
      return h('button', { class: 'sm-item', type: 'button', onclick: () => select(other.id, true) },
        [h('span', { text: L(other.label) }), detail ? h('span', { class: 'sm-count', text: detail }) : null]);
    }));
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
  function highlightButton(mode, label) {
    return h('button', { class: 'sm-btn', type: 'button', 'aria-pressed': String(state.highlight === mode), text: label,
      onclick: () => { state.highlight = mode; if (state.focus) rebuild('focus'); else paint(); renderInspector(); } });
  }

  function renderInspector() {
    clear(inspectEl);
    const id = state.selected;
    if (!id) { inspectEl.appendChild(h('p', { class: 'sm-empty', text: t('empty') })); return; }

    const actions = h('div', { class: 'sm-actions' }, [
      highlightButton('neighbors', t('connected')), highlightButton('in', t('hlIn')), highlightButton('out', t('hlOut')),
      h('button', { class: 'sm-btn', type: 'button', 'aria-pressed': String(state.focus), text: t('focus'),
        onclick: () => { state.focus = !state.focus; rebuild('focus'); renderInspector(); } }),
      h('button', { class: 'sm-btn', type: 'button', text: t('fit'), onclick: fit }),
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
    const rel = { out: edges.filter((e) => e.source === id && nodeById.has(e.target)), inn: edges.filter((e) => e.target === id && nodeById.has(e.source)) };
    inspectEl.appendChild(h('h3', { text: L(n.label) }));
    if (L2(n.label)) inspectEl.appendChild(h('p', { class: 'sm-second', text: L2(n.label) }));
    inspectEl.appendChild(h('div', { class: 'sm-chips' }, [
      h('span', { class: 'sm-chip', text: n.type }),
      b ? h('span', { class: 'sm-chip sm-b-' + b, text: badgeText(b) }) : null,
      n.confidence ? h('span', { class: 'sm-tag sm-tag-' + n.confidence, text: t(n.confidence) }) : null,
    ]));

    // Three orienting answers come first; everything else follows as expandable sections.
    const naSpan = () => h('span', { class: 'sm-na', text: t('na') });
    const whyKind = ['fact', 'inference', 'unknown'].find((k) => n.why && L(n.why[k]));
    const whyAnswer = h('dd');
    if (L(n.explanation)) whyAnswer.textContent = L(n.explanation);
    else if (whyKind) { whyAnswer.appendChild(h('span', { class: 'sm-tag sm-tag-' + whyKind, text: t(whyKind) })); whyAnswer.appendChild(document.createTextNode(' ' + L(n.why[whyKind]))); }
    else if (L(n.risks) || L(n.runtime)) whyAnswer.textContent = L(n.risks) || L(n.runtime);
    else whyAnswer.appendChild(naSpan());
    const names = (list, pickId) => list.map((e) => L(nodeById.get(pickId(e)).label)).join(', ');
    const how = [rel.inn.length ? t('inn') + ': ' + names(rel.inn, (e) => e.source) : '', rel.out.length ? t('out') + ': ' + names(rel.out, (e) => e.target) : ''].filter(Boolean).join(' · ');
    const whatAnswer = h('dd');
    if (L(n.description)) whatAnswer.textContent = L(n.description); else whatAnswer.appendChild(naSpan());
    inspectEl.appendChild(h('dl', { class: 'sm-lead3' }, [
      h('dt', { text: t('qWhat') }), whatAnswer,
      h('dt', { text: t('qWhy') }), whyAnswer,
      h('dt', { text: t('qHow') }), h('dd', { text: how || t('noLinks') }),
    ]));
    inspectEl.appendChild(actions);

    // Sections are <details>. Evidence, symbol lists and raw relations start collapsed outside Deep Dive;
    // a section the reader opened or closed keeps that choice while they move between nodes.
    const add = (key, title, body, openByDefault) => {
      if (!body) return;
      const open = key in state.open ? state.open[key] : state.mode === 'deep' ? true : openByDefault;
      const det = h('details', { class: 'sm-field' }, [h('summary', null, [h('h4', { text: title })]), body]);
      det.open = open;
      det.addEventListener('toggle', () => { state.open[key] = det.open; });
      inspectEl.appendChild(det);
    };
    add('whatChanged', t('whatChanged'), L(n.explanation) && L(n.description) ? para(n.explanation) : null, true);
    add('before', t('before'), para(n.before, 'pre'), true);
    add('after', t('after'), para(n.after, 'pre'), true);
    add('why', t('why'), whyRows(n.why), true);
    add('runtime', t('runtime'), para(n.runtime), true);
    add('tests', t('tests'), para(n.tests), true);
    add('risks', t('risks'), para(n.risks), true);
    add('learn', t('learn'), para(n.learn), false);
    if (itemsOf(n).length) {
      const box = h('div');
      itemsOf(n).forEach((c, i) => {
        const open = state.item === i;
        box.appendChild(h('button', { class: 'sm-item sm-sym-item sm-k-' + KIND_OF[c.kind], type: 'button', 'aria-expanded': String(open),
          onclick: () => { state.item = open ? null : i; renderInspector(); } },
          [h('span', { text: SIGIL[c.kind] + ' ' + c.label }), h('span', { class: 'sm-count', text: t('k_' + KIND_OF[c.kind]) })]));
        if (open) box.appendChild(itemDetail(c));
      });
      add('symbols', t('symbols') + ' (' + itemsOf(n).length + ')', box, false);
    }
    add('inn', t('inn') + ' (' + rel.inn.length + ')', nodeButtons(rel.inn, (e) => e.source), false);
    add('out', t('out') + ' (' + rel.out.length + ')', nodeButtons(rel.out, (e) => e.target), false);
    add('task', t('task'), para(n.task), false);
    add('evidence', t('evidence') + ' (' + (n.evidence || []).length + ')', evidenceList(n.evidence), false);
  }

  function checkbox(label, checked, onchange, swatch, count) {
    const input = h('input', { type: 'checkbox' });
    input.checked = checked;
    input.addEventListener('change', () => onchange(input.checked));
    return h('label', { class: 'sm-check' }, [input, swatch || null, h('span', { text: label }), h('span', { class: 'sm-count', text: String(count) })]);
  }

  function renderSide() {
    clear(sideEl);
    searchEl = h('input', { class: 'sm-search', type: 'search', placeholder: t('search'), 'aria-label': t('search') });
    searchEl.value = state.query;
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
      sideEl.appendChild(field(t('status'), h('div', null, badges.map((b) =>
        checkbox(badgeText(b), !state.hiddenBadges.has(b), (on) => { on ? state.hiddenBadges.delete(b) : state.hiddenBadges.add(b); rebuild(true); },
          null, nodes.filter((n) => badgeOf(n) === b).length)))));
    }
  }

  function renderToolbar() {
    clear(toolbarEl);
    const btn = (label, title, fn, pressed) => {
      const b = h('button', { class: 'sm-btn', type: 'button', text: label, title: title, 'aria-label': title, onclick: fn });
      if (pressed != null) b.setAttribute('aria-pressed', String(pressed));
      return b;
    };
    toolbarEl.appendChild(btn('+', t('zoomIn'), () => zoomBy(1.25)));
    toolbarEl.appendChild(btn('−', t('zoomOut'), () => zoomBy(0.8)));
    toolbarEl.appendChild(btn(t('fit'), t('fit'), fit));
    if (pathIsPartial) {
      toolbarEl.appendChild(btn(state.scope === 'path' ? t('fullGraph') : t('pathOnly'), state.scope === 'path' ? t('fullGraph') : t('pathOnly'),
        () => setScope(state.scope === 'path' ? 'full' : 'path')));
    }
    toolbarEl.appendChild(btn(t('filters'), t('filters'), () => { state.side = !state.side; applyPanels(); renderToolbar(); }, state.side));
    toolbarEl.appendChild(btn(t('details'), t('details'), () => { state.inspect = !state.inspect; applyPanels(); renderToolbar(); }, state.inspect));
    toolbarEl.appendChild(btn(t('reset'), t('reset'), resetAll));
    if (pathIsPartial) {
      toolbarEl.appendChild(h('span', { class: 'sm-scope-note', role: 'status',
        text: t('scopeNote').replace('{a}', String(view.nodes.length)).replace('{b}', String(nodes.length)) }));
    }
  }

  function segment(box, label, items, current, onPick) {
    if (!box) return;
    clear(box);
    box.hidden = false;
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', label);
    items.forEach(([value, text]) => box.appendChild(h('button', { type: 'button', text: text, 'aria-pressed': String(current === value), onclick: () => onPick(value) })));
  }
  function renderHeaderControls() {
    segment(document.getElementById('showme-modes'), t('modes'), [['scan', t('mScan')], ['understand', t('mUnderstand')], ['deep', t('mDeep')]], state.mode, setMode);
    if (canSwitch) segment(document.getElementById('showme-lang'), 'Language', [['th', 'TH'], ['en', 'EN']], state.lang, setLang);
    const box = document.getElementById('showme-prefs');
    if (!box) return;
    clear(box);
    box.hidden = false;
    const fontBtn = (text, label, fn) => h('button', { type: 'button', text: text, title: label, 'aria-label': label, onclick: () => { fn(); applyPrefs(true); } });
    const select = (label, options, value, onchange) => {
      const el = h('select', { 'aria-label': label, title: label });
      options.forEach(([v, text]) => { const o = h('option', { value: v, text: text }); if (v === value) o.selected = true; el.appendChild(o); });
      el.addEventListener('change', () => { onchange(el.value); applyPrefs(true); requestAnimationFrame(refit); });
      return el;
    };
    box.appendChild(fontBtn('A−', t('fontDown'), () => { prefs.size -= 1; }));
    box.appendChild(fontBtn('A', t('fontReset'), () => { prefs.size = 17; }));
    box.appendChild(fontBtn('A+', t('fontUp'), () => { prefs.size += 1; }));
    box.appendChild(select(t('theme'), [['auto', t('theme') + ': ' + t('tAuto')], ['light', t('tLight')], ['dark', t('tDark')]], prefs.theme, (v) => { prefs.theme = v; }));
    box.appendChild(select(t('width'), [['narrow', t('wNarrow')], ['normal', t('width') + ': ' + t('wNormal')], ['wide', t('wWide')]], prefs.width, (v) => { prefs.width = v; }));
  }

  /* ===== 8. Reading modes + steps ===== */
  const steps = [...document.querySelectorAll('.sm-step')];
  const progressLinks = [...document.querySelectorAll('.sm-progress a')];
  const discs = [...document.querySelectorAll('#deep > details.sm-disc')];
  const mapDisc = document.getElementById('map');
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollTo = (el) => { if (el) el.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' }); };

  function showStep(n, scroll) {
    state.step = Math.min(5, Math.max(1, n));
    steps.forEach((el) => el.classList.toggle('is-current', Number(el.dataset.step) === state.step));
    progressLinks.forEach((a, i) => { if (i + 1 === state.step) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
    if (scroll) scrollTo(steps[state.step - 1] || document.getElementById('guided'));
  }

  function setMode(mode) {
    state.mode = mode;
    state.open = {};
    root.setAttribute('data-mode', mode);
    discs.forEach((d) => { d.open = mode === 'deep'; });
    if (mapDisc) mapDisc.open = mode !== 'scan';
    state.scope = mode === 'deep' || !pathIds ? 'full' : 'path';
    state.side = mode === 'deep';
    state.focus = false;
    renderHeaderControls(); applyPanels(); renderSide(); rebuild('focus'); renderToolbar(); renderInspector();
    showStep(state.step, false);
  }

  function setScope(scope) {
    state.scope = scope;
    state.focus = false;
    rebuild(scope === 'full' ? true : 'focus');
    renderToolbar();
  }

  /* ===== 9. Interaction ===== */
  function applyView() { viewport.setAttribute('transform', 'translate(' + state.view.x + ',' + state.view.y + ') scale(' + state.view.k + ')'); }

  function fit() {
    const box = svg.getBoundingClientRect();
    const ps = [...positions.values()];
    if (!ps.length || !box.width) return;
    const x0 = Math.min(...ps.map((p) => p.x)) - 30, y0 = Math.min(...ps.map((p) => p.y)) - 46;
    const x1 = Math.max(...ps.map((p) => p.x)) + NW + 30, y1 = Math.max(...ps.map((p) => p.y)) + NH + 30;
    const k = Math.min(box.width / (x1 - x0), box.height / (y1 - y0), 1.2);
    state.view = { k, x: (box.width - (x1 - x0) * k) / 2 - x0 * k, y: (box.height - (y1 - y0) * k) / 2 - y0 * k };
    applyView();
  }

  // Reading view: never shrink node text below a legible scale; centre on the selected node instead.
  const READ_SCALE = 0.85;
  function focusView() {
    fit();
    if (state.view.k >= READ_SCALE) return;
    state.view.k = READ_SCALE;
    const target = state.selected && positions.has(state.selected) ? state.selected : view.nodes.length ? view.nodes[0].id : null;
    if (target) centerOn(target); else applyView();
  }
  let lastFit = 'focus';
  function refit() { if (lastFit === 'focus') focusView(); else fit(); }

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

  // refit: true = fit everything, 'focus' = legible reading view, false = keep the current view.
  function rebuild(refitMode) {
    view = computeView();
    positions = layout(view.nodes, view.edges);
    draw();
    paint();
    if (refitMode) { lastFit = refitMode === 'focus' ? 'focus' : 'fit'; refit(); }
  }

  function applyPanels() {
    host.classList.toggle('no-side', !state.side);
    host.classList.toggle('no-inspect', !state.inspect);
    requestAnimationFrame(refit);
  }

  // Makes a node visible again if the path scope, a filter, a collapsed group or focus mode hides it.
  function reveal(id) {
    const n = nodeById.get(id);
    if (!n) return false;
    let changed = false;
    if (state.scope === 'path' && pathIds && !pathIds.includes(id)) { state.scope = 'full'; changed = true; }
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
    if (item != null) state.open.symbols = true;
    if (state.highlight === 'none') state.highlight = 'neighbors';
    if (!state.inspect) { state.inspect = true; applyPanels(); }
    if (revealed) { renderSide(); rebuild('focus'); renderToolbar(); }
    else if (state.focus) rebuild('focus');
    else paint();
    renderInspector();
    if (center && !state.focus) centerOn(id);
  }

  function clearSelection() {
    const wasFocus = state.focus;
    state.selected = null;
    state.item = null;
    state.focus = false;
    if (wasFocus) rebuild(true); else paint();
    renderInspector();
  }

  function resetAll() {
    state.selected = null; state.item = null; state.kind = 'all'; state.focus = false; state.query = ''; state.highlight = 'neighbors';
    state.hiddenTypes.clear(); state.hiddenBadges.clear(); state.collapsed.clear(); state.open = {};
    state.scope = state.mode === 'deep' || !pathIds ? 'full' : 'path';
    renderSide(); rebuild(true); renderToolbar(); renderInspector();
  }

  function setLang(l) {
    state.lang = l;
    root.lang = l;
    root.setAttribute('data-lang', l);
    renderHeaderControls(); renderSide(); rebuild(false); renderToolbar(); renderInspector();
    svg.setAttribute('aria-label', t('graph'));
    document.querySelectorAll('.sm-copy').forEach((b) => { b.textContent = t('copy'); });
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
    const end = () => { drag = null; svg.classList.remove('is-dragging'); };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (ev) => { ev.preventDefault(); zoomBy(Math.exp(-ev.deltaY * 0.0015), ev.clientX, ev.clientY); }, { passive: false });
    host.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && state.selected) clearSelection(); });
    window.addEventListener('resize', refit);
    if (mapDisc) mapDisc.addEventListener('toggle', () => { if (mapDisc.open) requestAnimationFrame(refit); });
  }

  // Addressable state: #step-<1-5>, #mode-<scan|understand|deep>, #node-<id>[:<n-th changed symbol>].
  function fromHash() {
    const hash = decodeURIComponent(location.hash);
    let m;
    if ((m = /^#step-([1-5])$/.exec(hash))) {
      if (state.mode === 'scan') setMode('understand');
      showStep(Number(m[1]), true);
      return 'step';
    }
    if ((m = /^#mode-(scan|understand|deep)$/.exec(hash))) {
      setMode(m[1]);
      scrollTo(document.getElementById(m[1] === 'deep' ? 'deep' : 'start'));
      return 'mode';
    }
    if ((m = /^#node-(.+?)(?::(\d+))?$/.exec(hash)) && nodeById.has(m[1])) {
      if (mapDisc && !mapDisc.open) mapDisc.open = true;
      select(m[1], true, m[2] == null ? null : Number(m[2]));
      scrollTo(mapDisc);
      return 'node';
    }
    return '';
  }

  /* ===== 10. Boot ===== */
  applyPrefs(false);
  root.classList.add('sm-js');
  sideEl = h('aside', { class: 'sm-side', 'aria-label': t('filters') });
  inspectEl = h('aside', { class: 'sm-inspect', 'aria-live': 'polite', 'aria-label': t('details') });
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

  bindCanvas();
  enhanceStaticEvidence();
  // A sensible starting node so the details panel is never empty; an incoming deep link always wins.
  state.selected = keyNodeId;
  setMode('understand');
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
