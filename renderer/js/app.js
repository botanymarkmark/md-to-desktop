'use strict';

const { ipcRenderer } = require('electron');
const Theme = require('./theme');
const MD = require('./markdown');
const CV = require('./converters');
const DEFS = require('./tools');

const TOOLS = DEFS.tools;
const GROUPS = DEFS.groups;

/* ------------------------------------------------------------------ *
 *  状态
 * ------------------------------------------------------------------ */

const STORE_KEY = 'mdto.state.v2';

const state = {
  toolId: 'pdf',
  theme: 'dark',
  opts: {},          // toolId -> {optId: value}
  appearance: {},    // presetId -> {colors, fonts, sizes, spacing}
  src: {},           // toolId -> string
  files: {},         // toolId -> {name, base64, ext, size}
  fileOut: {},       // toolId -> {markdown, warnings}
  zoom: 1,
  zoomMode: 'fit',
  inputWidth: null
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    Object.assign(state, {
      toolId: s.toolId || 'pdf',
      theme: s.theme || 'dark',
      opts: s.opts || {},
      appearance: s.appearance || {},
      src: s.src || {},
      zoom: typeof s.zoom === 'number' ? s.zoom : 1,
      zoomMode: s.zoomMode || 'fit',
      inputWidth: s.inputWidth || null
    });
  } catch (_) {}
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        toolId: state.toolId,
        theme: state.theme,
        opts: state.opts,
        appearance: state.appearance,
        src: state.src,
        zoom: state.zoom,
        zoomMode: state.zoomMode,
        inputWidth: state.inputWidth
      }));
    } catch (_) {}
  }, 500);
}

/* ------------------------------------------------------------------ *
 *  DOM 引用
 * ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);
const el = {
  body: document.body,
  crumb: $('crumb'),
  toolList: $('toolList'),
  search: $('search'),
  editor: $('editor'),
  editorWrap: $('editorWrap'),
  dropzone: $('dropzone'),
  dzTitle: $('dzTitle'),
  dzSub: $('dzSub'),
  dzFile: $('dzFile'),
  inputTitle: $('inputTitle'),
  inputMeta: $('inputMeta'),
  preview: $('preview'),
  paper: $('paper'),
  paperWrap: $('paperWrap'),
  paperScroll: $('paperScroll'),
  codeScroll: $('codeScroll'),
  codeOut: $('codeOut'),
  emptyState: $('emptyState'),
  previewMeta: $('previewMeta'),
  optionsBody: $('optionsBody'),
  btnPrimary: $('btnPrimary'),
  btnPrimaryLabel: $('btnPrimaryLabel'),
  btnCopy: $('btnCopy'),
  btnCopyInline: $('btnCopyInline'),
  btnOpen: $('btnOpen'),
  btnSample: $('btnSample'),
  btnClear: $('btnClear'),
  btnReset: $('btnReset'),
  zoomIn: $('zoomIn'),
  zoomOut: $('zoomOut'),
  zoomLabel: $('zoomLabel'),
  themeBtn: $('themeBtn'),
  splitter: $('splitter'),
  paneInput: $('paneInput'),
  toast: $('toast'),
  overlay: $('overlay'),
  modalTitle: $('modalTitle'),
  modalBody: $('modalBody'),
  modalClose: $('modalClose')
};

/* ------------------------------------------------------------------ *
 *  工具函数
 * ------------------------------------------------------------------ */

const toolById = (id) => TOOLS.find((t) => t.id === id) || TOOLS[0];
const currentTool = () => toolById(state.toolId);

function defaultsFor(tool) {
  const o = {};
  tool.options.forEach((opt) => {
    if (opt.type === 'preset') o[opt.id] = 'classic';
    else if (opt.type === 'appearance') o[opt.id] = false;
    else if (opt.default !== undefined) o[opt.id] = opt.default;
  });
  return o;
}

function getOpts(tool) {
  const d = defaultsFor(tool);
  return Object.assign(d, state.opts[tool.id] || {});
}

function setOpt(tool, id, value) {
  state.opts[tool.id] = state.opts[tool.id] || {};
  state.opts[tool.id][id] = value;
  persist();
}

function currentTheme(tool) {
  const opts = getOpts(tool || currentTool());
  const presetId = opts.preset || 'classic';
  return Theme.resolveTheme(presetId, state.appearance[presetId], opts.density || 'standard');
}

function toast(msg, kind) {
  el.toast.textContent = msg;
  el.toast.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.toast.className = 'toast' + (kind ? ' ' + kind : '');
  }, 2600);
}

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function safeName(s) {
  return String(s || 'document')
    .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
    .trim()
    .slice(0, 60) || 'document';
}

function baseName() {
  const tool = currentTool();
  const f = state.files[tool.id];
  if (f && f.name) return safeName(f.name.replace(/\.[^.]+$/, ''));
  const src = getSource(tool);
  const m = /^#{1,3}\s+(.+)$/m.exec(src || '');
  if (m) return safeName(m[1].replace(/[*_`~\[\]]/g, ''));
  return 'document';
}

function getSource(tool) {
  return state.src[tool.id] || '';
}

/* ------------------------------------------------------------------ *
 *  侧边栏
 * ------------------------------------------------------------------ */

function renderSidebar() {
  const q = (el.search.value || '').trim().toLowerCase();
  el.toolList.innerHTML = '';

  GROUPS.forEach((g) => {
    const items = TOOLS.filter((t) => t.group === g.id)
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.badge.toLowerCase().includes(q) ||
        (g.name + '').toLowerCase().includes(q));
    if (!items.length) return;

    const label = document.createElement('div');
    label.className = 'group-label';
    label.textContent = g.name;
    el.toolList.appendChild(label);

    items.forEach((t) => {
      const div = document.createElement('div');
      div.className = 'tool-item' + (t.id === state.toolId ? ' active' : '');
      div.dataset.id = t.id;
      div.title = t.desc;
      div.innerHTML = `<span class="badge t-${t.badge}">${t.badge}</span><span class="tool-name">${t.name}</span>`;
      div.addEventListener('click', () => switchTool(t.id));
      el.toolList.appendChild(div);
    });
  });
}

/* ------------------------------------------------------------------ *
 *  选项面板
 * ------------------------------------------------------------------ */

const COLOR_LABELS = {
  bg: '页面底色', heading: '标题', text: '正文', link: '链接',
  quoteBorder: '引用边框', quoteText: '引用文字',
  codeBg: '代码背景', codeText: '代码文字', codeBorder: '代码边框',
  tableHeader: '表头', tableHeaderText: '表头文字',
  rowOdd: '奇数行', rowEven: '偶数行', tableBorder: '表格线', accent: '强调色'
};

function renderOptions() {
  const tool = currentTool();
  const opts = getOpts(tool);
  el.optionsBody.innerHTML = '';

  const groups = new Map();
  tool.options.forEach((o) => {
    const g = o.group || '常规';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(o);
  });

  groups.forEach((list, gname) => {
    const title = document.createElement('div');
    title.className = 'opt-group-title';
    title.textContent = gname;
    el.optionsBody.appendChild(title);
    list.forEach((opt) => el.optionsBody.appendChild(buildOption(tool, opt, opts[opt.id])));
  });
}

function buildOption(tool, opt, value) {
  const wrap = document.createElement('div');
  wrap.className = 'opt';

  switch (opt.type) {
    case 'preset': {
      const preset = Theme.getPreset(value);
      const btn = document.createElement('button');
      btn.className = 'preset-btn';
      btn.innerHTML = `
        <span class="preset-dot" style="background:${preset.colors.heading}"></span>
        <span class="preset-btn-text"><b>${preset.name}</b><small>${preset.group} · ${preset.desc || ''}</small></span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>`;
      btn.addEventListener('click', () => openPresetModal(tool));
      wrap.appendChild(btn);
      break;
    }

    case 'segmented': {
      const label = document.createElement('div');
      label.className = 'opt-label';
      label.innerHTML = `<span>${opt.label}</span>`;
      wrap.appendChild(label);
      const seg = document.createElement('div');
      seg.className = 'segmented';
      opt.choices.forEach((c) => {
        const b = document.createElement('button');
        b.textContent = c.l;
        b.className = String(value) === String(c.v) ? 'on' : '';
        b.addEventListener('click', () => {
          setOpt(tool, opt.id, c.v);
          [...seg.children].forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          scheduleRender(true);
        });
        seg.appendChild(b);
      });
      wrap.appendChild(seg);
      break;
    }

    case 'select': {
      const label = document.createElement('div');
      label.className = 'opt-label';
      label.innerHTML = `<span>${opt.label}</span>`;
      wrap.appendChild(label);
      const sel = document.createElement('select');
      opt.choices.forEach((c) => {
        const o = document.createElement('option');
        o.value = c.v; o.textContent = c.l;
        if (String(value) === String(c.v)) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => { setOpt(tool, opt.id, sel.value); scheduleRender(true); });
      wrap.appendChild(sel);
      break;
    }

    case 'toggle': {
      const row = document.createElement('div');
      row.className = 'toggle-row';
      const txt = document.createElement('span');
      txt.textContent = opt.label;
      txt.style.fontSize = '12px';
      txt.style.color = 'var(--ink-2)';
      const sw = document.createElement('span');
      sw.className = 'switch' + (value ? ' on' : '');
      row.appendChild(txt); row.appendChild(sw);
      row.addEventListener('click', () => {
        const nv = !sw.classList.contains('on');
        sw.classList.toggle('on', nv);
        setOpt(tool, opt.id, nv);
        scheduleRender(true);
      });
      wrap.appendChild(row);
      break;
    }

    case 'range': {
      const label = document.createElement('div');
      label.className = 'opt-label';
      label.innerHTML = `<span>${opt.label}</span><span class="opt-value">${value}${opt.unit || ''}</span>`;
      wrap.appendChild(label);
      const r = document.createElement('input');
      r.type = 'range';
      r.min = opt.min; r.max = opt.max; r.step = opt.step || 1; r.value = value;
      r.addEventListener('input', () => {
        label.querySelector('.opt-value').textContent = r.value + (opt.unit || '');
        setOpt(tool, opt.id, Number(r.value));
        scheduleRender();
      });
      wrap.appendChild(r);
      if (opt.hint) {
        const h = document.createElement('div');
        h.className = 'opt-hint';
        h.textContent = opt.hint;
        wrap.appendChild(h);
      }
      break;
    }

    case 'text': {
      const label = document.createElement('div');
      label.className = 'opt-label';
      label.innerHTML = `<span>${opt.label}</span>`;
      wrap.appendChild(label);
      const i = document.createElement('input');
      i.type = 'text';
      i.value = value || '';
      i.placeholder = opt.placeholder || '';
      i.addEventListener('input', () => { setOpt(tool, opt.id, i.value); scheduleRender(); });
      wrap.appendChild(i);
      break;
    }

    case 'margins': {
      const label = document.createElement('div');
      label.className = 'opt-label';
      label.innerHTML = `<span>${opt.label}</span>`;
      wrap.appendChild(label);
      const grid = document.createElement('div');
      grid.className = 'margin-grid';
      const names = ['上', '右', '下', '左'];
      (value || opt.default).forEach((v, i) => {
        const cell = document.createElement('div');
        cell.className = 'margin-cell';
        cell.innerHTML = `<span>${names[i]}</span>`;
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.min = 0; inp.max = 80; inp.value = v;
        inp.addEventListener('input', () => {
          const arr = (getOpts(tool).margins || []).slice();
          arr[i] = Math.max(0, Math.min(80, Number(inp.value) || 0));
          setOpt(tool, 'margins', arr);
          scheduleRender();
        });
        cell.appendChild(inp);
        grid.appendChild(cell);
      });
      wrap.appendChild(grid);
      break;
    }

    case 'appearance': {
      const head = document.createElement('div');
      head.className = 'appearance-toggle';
      head.innerHTML = `<span>${opt.label}</span>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"
          style="transform:rotate(${value ? 90 : 0}deg);transition:.15s"><path d="M9 6l6 6-6 6"/></svg>`;
      head.addEventListener('click', () => {
        setOpt(tool, opt.id, !value);
        renderOptions();
      });
      wrap.appendChild(head);
      if (value) wrap.appendChild(buildAppearance(tool));
      break;
    }
  }
  return wrap;
}

function buildAppearance(tool) {
  const opts = getOpts(tool);
  const presetId = opts.preset || 'classic';
  const preset = Theme.getPreset(presetId);
  const ov = state.appearance[presetId] || { colors: {}, fonts: {}, sizes: {}, spacing: {} };
  const cur = {
    colors: Object.assign({}, preset.colors, ov.colors || {}),
    fonts: Object.assign({}, preset.fonts, ov.fonts || {}),
    sizes: Object.assign({}, preset.sizes, ov.sizes || {}),
    spacing: Object.assign({}, preset.spacing, ov.spacing || {})
  };

  const box = document.createElement('div');
  box.className = 'appearance';

  const ensure = (k) => {
    state.appearance[presetId] = state.appearance[presetId] || {};
    state.appearance[presetId][k] = state.appearance[presetId][k] || {};
    return state.appearance[presetId][k];
  };

  // 颜色
  const cTitle = document.createElement('div');
  cTitle.className = 'opt-hint';
  cTitle.style.margin = '4px 0 6px';
  cTitle.textContent = '颜色';
  box.appendChild(cTitle);

  const grid = document.createElement('div');
  grid.className = 'swatch-grid';
  Object.keys(COLOR_LABELS).forEach((key) => {
    const s = document.createElement('div');
    s.className = 'swatch';
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.value = cur.colors[key] || '#000000';
    inp.addEventListener('input', () => {
      ensure('colors')[key] = inp.value;
      persist();
      scheduleRender(true);
    });
    const lab = document.createElement('label');
    lab.textContent = COLOR_LABELS[key];
    s.appendChild(inp); s.appendChild(lab);
    grid.appendChild(s);
  });
  box.appendChild(grid);

  // 字体
  const fTitle = document.createElement('div');
  fTitle.className = 'opt-hint';
  fTitle.style.margin = '12px 0 6px';
  fTitle.textContent = '字体';
  box.appendChild(fTitle);

  [['heading', '标题字体'], ['body', '正文字体'], ['code', '代码字体']].forEach(([k, lab]) => {
    const row = document.createElement('div');
    row.className = 'opt-label';
    row.style.marginTop = '6px';
    row.innerHTML = `<span>${lab}</span>`;
    const sel = document.createElement('select');
    sel.style.width = '150px';
    Theme.FONT_OPTIONS.forEach((fo) => {
      const o = document.createElement('option');
      o.value = fo.id; o.textContent = fo.label;
      if (cur.fonts[k] === fo.id) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => {
      ensure('fonts')[k] = sel.value;
      persist();
      scheduleRender(true);
    });
    row.appendChild(sel);
    box.appendChild(row);
  });

  // 字号
  const sTitle = document.createElement('div');
  sTitle.className = 'opt-hint';
  sTitle.style.margin = '12px 0 6px';
  sTitle.textContent = '字号（pt）';
  box.appendChild(sTitle);

  const ng = document.createElement('div');
  ng.className = 'num-grid';
  [['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'], ['body', '正文'], ['code', '代码']].forEach(([k, lab]) => {
    const cell = document.createElement('div');
    cell.className = 'num-cell';
    cell.innerHTML = `<label>${lab}</label>`;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.step = '0.5'; inp.min = '6'; inp.max = '48';
    inp.value = cur.sizes[k];
    inp.addEventListener('input', () => {
      const v = Number(inp.value);
      if (v > 0) { ensure('sizes')[k] = v; persist(); scheduleRender(); }
    });
    cell.appendChild(inp);
    ng.appendChild(cell);
  });
  box.appendChild(ng);

  // 间距
  const pTitle = document.createElement('div');
  pTitle.className = 'opt-hint';
  pTitle.style.margin = '12px 0 6px';
  pTitle.textContent = '间距';
  box.appendChild(pTitle);

  const pg = document.createElement('div');
  pg.className = 'num-grid';
  [['lineHeight', '行高'], ['headingBefore', '标题前(pt)'], ['paraAfter', '段后(pt)']].forEach(([k, lab]) => {
    const cell = document.createElement('div');
    cell.className = 'num-cell';
    cell.innerHTML = `<label>${lab}</label>`;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.step = k === 'lineHeight' ? '0.02' : '0.5';
    inp.min = '0'; inp.max = k === 'lineHeight' ? '3' : '60';
    inp.value = cur.spacing[k];
    inp.addEventListener('input', () => {
      const v = Number(inp.value);
      if (v >= 0) { ensure('spacing')[k] = v; persist(); scheduleRender(); }
    });
    cell.appendChild(inp);
    pg.appendChild(cell);
  });
  box.appendChild(pg);

  return box;
}

/* ------------------------------------------------------------------ *
 *  模板选择弹窗
 * ------------------------------------------------------------------ */

function openPresetModal(tool) {
  const opts = getOpts(tool);
  const curId = opts.preset || 'classic';
  el.modalTitle.textContent = '选择文档模板';
  el.modalBody.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'preset-grid';
  Theme.PRESETS.forEach((p) => {
    const c = p.colors;
    const card = document.createElement('div');
    card.className = 'preset-card' + (p.id === curId ? ' on' : '');
    card.innerHTML = `
      <div class="preset-preview" style="background:${c.bg}">
        <div class="pp-h" style="background:${c.heading}"></div>
        <div class="pp-t" style="background:${c.text}"></div>
        <div class="pp-t s" style="background:${c.text}"></div>
        <div class="pp-row">
          <div class="pp-chip" style="background:${c.tableHeader};border:1px solid ${c.tableBorder}"></div>
          <div class="pp-chip" style="background:${c.codeBg};border:1px solid ${c.codeBorder}"></div>
          <div class="pp-chip" style="background:${c.accent};opacity:.7"></div>
        </div>
      </div>
      <div class="preset-meta"><b>${p.name}</b><small>${p.group} · ${p.desc || ''}</small></div>`;
    card.addEventListener('click', () => {
      setOpt(tool, 'preset', p.id);
      closeModal();
      renderOptions();
      scheduleRender(true);
    });
    grid.appendChild(card);
  });
  el.modalBody.appendChild(grid);
  el.overlay.classList.remove('hidden');
}

function closeModal() {
  el.overlay.classList.add('hidden');
}

/* ------------------------------------------------------------------ *
 *  渲染
 * ------------------------------------------------------------------ */

let iframeDoc = null;
let renderTimer = null;

function scheduleRender(immediate) {
  clearTimeout(renderTimer);
  if (immediate) renderNow();
  else renderTimer = setTimeout(renderNow, 220);
}

function tablesBodyHtml(tool) {
  const src = getSource(tool);
  const tables = CV.mdTables(src);
  if (!tables.length) return '';
  return tables.map((t) => {
    const rows = CV.tableToRows(t);
    const head = rows[0] || [];
    const body = rows.slice(1);
    return `<table><thead><tr>${head.map((h) => `<th>${MD.escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${body.map((r) => `<tr>${r.map((cell) => `<td>${MD.escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }).join('');
}

function computeText(tool, src) {
  const opts = getOpts(tool);
  try {
    switch (tool.kind) {
      case 'latex': {
        const dom = MD.mdToDom(src);
        const body = MD.htmlToLatex(dom, { topLevel: opts.topLevel, codeEnv: opts.codeEnv });
        if (!src.trim()) return '';
        if (!opts.addPreamble) return body;
        return MD.latexPreamble({
          docClass: opts.docClass,
          fontSize: opts.fontSize,
          title: opts.texTitle || '',
          author: opts.texAuthor || ''
        }) + body + MD.latexPostamble();
      }
      case 'rst': {
        if (!src.trim()) return '';
        const dom = MD.mdToDom(src);
        let body = MD.htmlToRst(dom);
        if (opts.rstHeader) {
          const title = opts.rstTitle || baseName();
          body = `${title}\n${'='.repeat(Math.max(6, title.length * 2))}\n\n${body}`;
        }
        return body;
      }
      case 'confluence':
        return src.trim() ? MD.htmlToConfluence(MD.mdToDom(src), {
          cnfCode: opts.cnfCode,
          cnfTable: opts.cnfTable
        }) : '';
      case 'text':
        return src.trim() ? MD.htmlToPlainText(MD.mdToDom(src), {
          headingStyle: opts.headingStyle,
          keepUrls: opts.keepUrls,
          codeStyle: opts.codeStyle,
          wrap: Number(opts.wrapWidth) || 0
        }) : '';
      case 'csv':
        return src.trim() ? CV.mdToCsv(src, {
          delimiter: opts.delimiter,
          allTables: opts.allTables,
          quoteAll: opts.quoteAll
        }) : '';
      case 'csv2md':
        return src.trim() ? CV.csvToMdTable(src, {
          delimiter: opts.csvDelim === 'auto' ? '' : opts.csvDelim,
          align: opts.align,
          firstRowHeader: opts.firstRowHeader,
          skipEmpty: opts.skipEmpty
        }) : '';
      case 'json2md':
        return src.trim() ? CV.jsonToMdTable(src, {
          nested: opts.nested,
          rootKey: opts.rootKey,
          align: opts.align
        }) : '';
      case 'html2md':
        return src.trim() ? CV.htmlToMarkdown(src, {
          headingStyle: opts.headingStyle,
          keepTags: (opts.keepTags || '').split(',').map((s) => s.trim()).filter(Boolean),
          brAsSpace: opts.brAsSpace
        }) : '';
      case 'docx2md':
      case 'pdf2md': {
        const out = state.fileOut[tool.id];
        return out ? out.markdown : '';
      }
      default:
        return '';
    }
  } catch (err) {
    return '⚠ ' + (err && err.message ? err.message : String(err));
  }
}

function ensureIframe() {
  if (iframeDoc) return iframeDoc;
  const d = el.preview.contentDocument;
  if (!d) return null;
  d.open();
  d.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <style id="docCss"></style>
    <style>html,body{margin:0;padding:0;}</style>
    </head><body></body></html>`);
  d.close();
  iframeDoc = d;
  return d;
}

function paintDoc(css, bodyHtml) {
  const d = ensureIframe();
  if (!d) return;
  d.getElementById('docCss').textContent = css;
  d.body.className = '';
  d.body.innerHTML = bodyHtml;
  // 等一帧再量高度（用 body 的实际高度，scrollHeight 会被 iframe 视口高度撑大）
  requestAnimationFrame(() => {
    try {
      const h = Math.max(320, Math.ceil(d.body.getBoundingClientRect().height));
      el.preview.style.height = h + 'px';
      layoutPaper();
      setTimeout(layoutPaper, 220);
    } catch (_) {}
  });
}

function renderNow() {
  const tool = currentTool();
  const opts = getOpts(tool);
  const src = getSource(tool);
  const hasFile = tool.input === 'file';

  // 输入区
  el.inputTitle.textContent = inputTitleFor(tool);
  el.btnSample.classList.toggle('hidden', !tool.sample);
  const dropMode = hasFile;
  el.editor.classList.toggle('hidden', dropMode);
  el.dropzone.classList.toggle('hidden', !dropMode);
  if (dropMode) {
    el.dzTitle.textContent = tool.dropHint || '拖入文件';
    const f = state.files[tool.id];
    el.dzFile.innerHTML = f ? `${f.name} <span style="color:var(--ink-3)">· ${fmtBytes(f.size)}</span>` : '';
    el.dzFile.classList.toggle('hidden', !f);
    el.dzSub.textContent = f ? '重新拖入可替换' : '文件不会离开这台电脑';
  }

  // 元信息
  if (hasFile) {
    const f = state.files[tool.id];
    el.inputMeta.textContent = f ? `${f.name} · ${fmtBytes(f.size)}` : '等待文件';
  } else if (tool.input === 'markdown') {
    const st = CV.stats(src);
    el.inputMeta.textContent = src ? `${st.words.toLocaleString()} 字 · ${st.lines} 行` : '空';
  } else if (tool.input === 'csv') {
    const n = src.trim() ? src.trim().split('\n').length : 0;
    el.inputMeta.textContent = n ? `${n} 行` : '空';
  } else if (tool.input === 'json' || tool.input === 'html') {
    el.inputMeta.textContent = src ? `${src.length.toLocaleString()} 字符` : '空';
  }

  // 预览区
  const mode = tool.preview;
  el.paperScroll.classList.toggle('hidden', mode === 'code');
  el.codeScroll.classList.toggle('hidden', mode !== 'code');
  el.emptyState.classList.add('hidden');
  [el.zoomIn, el.zoomOut, el.zoomLabel].forEach((b) => b.classList.toggle('hidden', mode === 'code'));

  if (mode === 'code') {
    const text = computeText(tool, src);
    el.codeOut.textContent = text || '';
    const lines = text ? text.split('\n').length : 0;
    el.previewMeta.textContent = text ? `${lines} 行 · ${fmtBytes(new Blob([text]).size)}` : '';
    if (!text) showEmpty(true);
  } else {
    const theme = currentTheme(tool);
    let bodyHtml = '';
    if (tool.kind === 'pdf' || tool.kind === 'docx' || tool.kind === 'image' ||
        tool.kind === 'html' || tool.kind === 'editor') {
      bodyHtml = MD.renderMarkdown(src);
    } else {
      bodyHtml = tablesBodyHtml(tool);
    }

    if (!src.trim()) {
      showEmpty(true);
      paintDoc(Theme.buildDocCSS(theme, { pageWidth: 794 }), '');
    } else {
      showEmpty(false);
      const toc = (opts.toc && (tool.kind === 'pdf' || tool.kind === 'docx' || tool.kind === 'html' || tool.kind === 'editor'))
        ? MD.buildToc(src) : '';
      const css = Theme.buildDocCSS(theme, { pageWidth: 794 });
      const m = opts.margins || [22, 22, 20, 20];
      const mm2px = (v) => Math.round(Number(v || 0) * 3.7795);
      const pad = (tool.kind === 'image' || tool.kind === 'table-image')
        ? [1, 1, 1, 1].map(() => Math.round(Number(opts.imgPad != null ? opts.imgPad : 32) * 1.15))
        : [m[0], m[1], m[2], m[3]].map(mm2px);
      const inner = `<div class="doc${opts.numbered ? ' numbered' : ''}" ` +
        `style="padding:${pad[0]}px ${pad[1]}px ${pad[2]}px ${pad[3]}px">${toc}${bodyHtml}</div>`;
      paintDoc(css, inner);
    }

    el.previewMeta.textContent = presetLabel(tool) + (tool.kind === 'image' || tool.kind === 'table-image' ? ` · ${opts.imgWidth}px` : '');
  }

  // 主按钮
  el.btnPrimaryLabel.textContent = primaryLabel(tool);
}

function showEmpty(on) {
  el.emptyState.classList.toggle('hidden', !on);
  if (on) {
    el.previewMeta.textContent = '';
  }
}

function inputTitleFor(tool) {
  if (tool.input === 'file') return tool.acceptExts ? tool.acceptExts[0].toUpperCase() : '文件';
  if (tool.input === 'csv') return 'CSV / TSV';
  if (tool.input === 'json') return 'JSON';
  if (tool.input === 'html') return 'HTML';
  return 'Markdown';
}

function presetLabel(tool) {
  const opts = getOpts(tool);
  const p = Theme.getPreset(opts.preset);
  const d = (Theme.DENSITY[opts.density] || Theme.DENSITY.standard).label;
  const size = opts.pageSize || '';
  return [size, p.name, d].filter(Boolean).join(' · ');
}

function primaryLabel(tool) {
  if (tool.kind === 'editor') {
    const opts = getOpts(tool);
    const f = opts.editorFormat || 'pdf';
    return '导出 ' + ({ pdf: 'PDF', docx: 'Word', html: 'HTML', image: '图片' }[f] || 'PDF');
  }
  if (tool.kind === 'latex') return '导出 .tex';
  if (tool.kind === 'rst') return '导出 .rst';
  if (tool.kind === 'confluence') return '另存为文本';
  if (tool.kind === 'text') return '导出 .txt';
  if (tool.kind === 'csv') return '导出 CSV';
  if (tool.kind === 'excel') return '导出 Excel';
  if (tool.kind === 'csv2md' || tool.kind === 'json2md' ||
      tool.kind === 'docx2md' || tool.kind === 'pdf2md' || tool.kind === 'html2md') return '导出 .md';
  if (tool.kind === 'table-image' || tool.kind === 'image') return '导出图片';
  if (tool.kind === 'table-pdf') return '导出 PDF';
  if (tool.kind === 'docx') return '导出 Word';
  if (tool.kind === 'html') return '导出 HTML';
  return '导出 PDF';
}

/* ------------------------------------------------------------------ *
 *  导出
 * ------------------------------------------------------------------ */

function buildDocHtml(tool, mode, overrideOpts) {
  const opts = Object.assign({}, getOpts(tool), overrideOpts || {});
  const theme = currentTheme(tool);
  const src = getSource(tool);
  const bodyHtml = MD.renderMarkdown(src);
  const toc = opts.toc ? MD.buildToc(src) : '';
  const m = opts.margins || [22, 22, 20, 20];
  const pad = Number(opts.imgPad != null ? opts.imgPad : 32);

  return Theme.buildDocument({
    bodyHtml,
    theme,
    mode,
    title: baseName(),
    pageSize: opts.pageSize || 'A4',
    landscape: opts.landscape === 'landscape',
    numbered: !!opts.numbered,
    toc,
    pageWidth: 794,
    imageWidth: Number(opts.imgWidth) || 900,
    zoom: mode === 'image' ? (Number(opts.imgScale) || 2) : 1,
    margins: mode === 'image'
      ? { top: pad, right: Math.round(pad * 1.1), bottom: pad, left: Math.round(pad * 1.1) }
      : { top: m[0], right: m[1], bottom: m[2], left: m[3] },
    forReady: mode !== 'preview'
  });
}

function buildTableHtml(tool, mode) {
  const opts = getOpts(tool);
  const theme = currentTheme(tool);
  const tables = tablesBodyHtml(tool);
  const title = opts.tableTitle
    ? `<h2 style="margin-top:0">${MD.escapeHtml(opts.tableTitle)}</h2>` : '';
  const body = `<div class="doc">${title}${tables || '<p style="color:#999">没有找到表格</p>'}</div>`;
  const pad = Number(opts.imgPad != null ? opts.imgPad : 32);
  return Theme.buildDocument({
    bodyHtml: body,
    theme,
    mode,
    title: baseName(),
    pageSize: opts.pageSize || 'A4',
    landscape: opts.landscape === 'landscape',
    pageWidth: 794,
    imageWidth: Number(opts.imgWidth) || 900,
    zoom: mode === 'image' ? (Number(opts.imgScale) || 2) : 1,
    margins: mode === 'image'
      ? { top: pad, right: Math.round(pad * 1.1), bottom: pad, left: Math.round(pad * 1.1) }
      : { top: 18, right: 16, bottom: 18, left: 16 },
    forReady: true
  });
}

async function saveText(text, name, filters) {
  return ipcRenderer.invoke('file:save', { defaultName: name, filters, text });
}
async function saveBase64(base64, name, filters) {
  return ipcRenderer.invoke('file:save', { defaultName: name, filters, base64 });
}

async function doExport() {
  const tool = currentTool();
  const opts = getOpts(tool);
  const src = getSource(tool);
  const base = baseName();

  if (tool.input === 'file' && !state.fileOut[tool.id]) {
    toast('请先选择一个文件', 'err');
    return;
  }
  if (tool.input !== 'file' && !src.trim()) {
    toast('输入是空的，先写点内容', 'err');
    return;
  }

  el.btnPrimary.disabled = true;
  try {
    switch (tool.kind) {
      case 'pdf': case 'table-pdf': {
        const html = tool.kind === 'pdf' ? buildDocHtml(tool, 'pdf') : buildTableHtml(tool, 'pdf');
        const m = opts.margins || [22, 22, 20, 20];
        const r = await ipcRenderer.invoke('render:pdf', {
          html,
          pageSize: opts.pageSize || 'A4',
          landscape: opts.landscape === 'landscape',
          pageNumbers: !!opts.pageNumbers,
          marginTop: m[0], marginRight: m[1], marginBottom: m[2], marginLeft: m[3]
        });
        if (!r.ok) throw new Error(r.error || 'PDF 渲染失败');
        const s = await saveBase64(r.base64, base + '.pdf', tool.filters);
        if (!s.canceled) toast('已保存 ' + s.path, 'ok');
        break;
      }
      case 'docx': {
        const r = await ipcRenderer.invoke('docx:build', {
          markdown: src,
          opts: {
            theme: currentTheme(tool),
            pageSize: opts.pageSize,
            landscape: opts.landscape === 'landscape',
            margins: {
              top: (opts.margins || [22])[0],
              right: (opts.margins || [22, 22])[1],
              bottom: (opts.margins || [22, 22, 22])[2],
              left: (opts.margins || [22, 22, 22, 22])[3]
            },
            toc: !!opts.toc,
            pageNumbers: !!opts.pageNumbers,
            title: base
          }
        });
        if (!r.ok) throw new Error(r.error || 'Word 生成失败');
        const s = await saveBase64(r.base64, base + '.docx', tool.filters);
        if (!s.canceled) toast('已保存 ' + s.path, 'ok');
        break;
      }
      case 'html': {
        const full = buildDocHtml(tool, 'preview');
        const out = opts.standalone === false
          ? `<div class="doc">${MD.renderMarkdown(src)}</div>`
          : full;
        const s = await saveText(out, base + '.html', tool.filters);
        if (!s.canceled) toast('已保存 ' + s.path, 'ok');
        break;
      }
      case 'image': case 'table-image': {
        const html = tool.kind === 'image' ? buildDocHtml(tool, 'image') : buildTableHtml(tool, 'image');
        const r = await ipcRenderer.invoke('render:image', {
          html,
          width: Number(opts.imgWidth) || 900,
          scale: Number(opts.imgScale) || 2,
          format: opts.imgFormat || 'png',
          quality: 92
        });
        if (!r.ok) throw new Error(r.error || '图片渲染失败');
        const ext = (opts.imgFormat || 'png') === 'jpeg' ? 'jpg' : 'png';
        const filter = ext === 'jpg' ? tool.filters[1] : tool.filters[0];
        const s = await saveBase64(r.base64, `${base}.${ext}`, [filter]);
        if (!s.canceled) toast(`已保存 ${s.path}（${r.width}×${r.height}）`, 'ok');
        break;
      }
      case 'excel': {
        const tables = CV.mdTables(src);
        if (!tables.length) throw new Error('没有找到表格');
        const r = await ipcRenderer.invoke('excel:build', {
          tables: CV.tablesForExcel(tables),
          opts: { singleSheet: opts.sheetMode === 'single', freezeHeader: opts.freezeHeader }
        });
        if (!r.ok) throw new Error(r.error || 'Excel 生成失败');
        const s = await saveBase64(r.base64, base + '.xlsx', tool.filters);
        if (!s.canceled) toast(`已保存 ${s.path}（${tables.length} 个表）`, 'ok');
        break;
      }
      case 'editor': {
        const f = opts.editorFormat || 'pdf';
        await exportAs({ kind: f }, tool);
        break;
      }
      case 'latex': case 'rst': case 'text': case 'confluence':
      case 'csv': case 'csv2md': case 'json2md': case 'docx2md':
      case 'pdf2md': case 'html2md': {
        const text = computeText(tool, src);
        if (!text || text.startsWith('⚠')) throw new Error(text.replace('⚠ ', '') || '没有内容');
        const ext = tool.ext || 'txt';
        const s = await saveText(text, `${base}.${ext}`, tool.filters);
        if (!s.canceled) toast('已保存 ' + s.path, 'ok');
        break;
      }
      default:
        toast('这个工具暂不支持导出', 'err');
    }
  } catch (err) {
    toast(err && err.message ? err.message : String(err), 'err');
  } finally {
    el.btnPrimary.disabled = false;
  }
}

function filtersFor(kind) {
  if (kind === 'pdf') return [{ name: 'PDF 文档', extensions: ['pdf'] }];
  if (kind === 'docx') return [{ name: 'Word 文档', extensions: ['docx'] }];
  if (kind === 'html') return [{ name: 'HTML 文件', extensions: ['html'] }];
  if (kind === 'image') return [{ name: 'PNG 图片', extensions: ['png'] }];
  return [{ name: '所有文件', extensions: ['*'] }];
}

/** 编辑器多格式导出：临时改写 kind 走同一套流程 */
async function exportAs(fakeTool, realTool) {
  const opts = getOpts(realTool);
  const base = baseName();
  if (fakeTool.kind === 'pdf') {
    const html = buildDocHtml(realTool, 'pdf');
    const m = opts.margins || [22, 22, 20, 20];
    const r = await ipcRenderer.invoke('render:pdf', {
      html, pageSize: opts.pageSize, landscape: opts.landscape === 'landscape',
      pageNumbers: !!opts.pageNumbers,
      marginTop: m[0], marginRight: m[1], marginBottom: m[2], marginLeft: m[3]
    });
    if (!r.ok) throw new Error(r.error);
    const s = await saveBase64(r.base64, base + '.pdf', filtersFor('pdf'));
    if (!s.canceled) toast('已保存 ' + s.path, 'ok');
  } else if (fakeTool.kind === 'docx') {
    const r = await ipcRenderer.invoke('docx:build', {
      markdown: getSource(realTool),
      opts: {
        theme: currentTheme(realTool),
        pageSize: opts.pageSize,
        landscape: opts.landscape === 'landscape',
        margins: { top: opts.margins[0], right: opts.margins[1], bottom: opts.margins[2], left: opts.margins[3] },
        toc: !!opts.toc, pageNumbers: !!opts.pageNumbers, title: base
      }
    });
    if (!r.ok) throw new Error(r.error || 'Word 生成失败');
    const s = await saveBase64(r.base64, base + '.docx', filtersFor('docx'));
    if (!s.canceled) toast('已保存 ' + s.path, 'ok');
  } else if (fakeTool.kind === 'html') {
    const s = await saveText(buildDocHtml(realTool, 'preview'), base + '.html', filtersFor('html'));
    if (!s.canceled) toast('已保存 ' + s.path, 'ok');
  } else if (fakeTool.kind === 'image') {
    const html = buildDocHtml(realTool, 'image');
    const r = await ipcRenderer.invoke('render:image', {
      html, width: Number(opts.imgWidth) || 900, scale: Number(opts.imgScale) || 2, format: 'png'
    });
    if (!r.ok) throw new Error(r.error);
    const s = await saveBase64(r.base64, base + '.png', filtersFor('image'));
    if (!s.canceled) toast(`已保存 ${s.path}（${r.width}×${r.height}）`, 'ok');
  }
}

async function doCopy() {
  const tool = currentTool();
  const src = getSource(tool);
  try {
    if (tool.preview === 'code') {
      const text = computeText(tool, src);
      if (!text) return toast('没有可复制的内容', 'err');
      await ipcRenderer.invoke('clipboard:write', { text });
      toast('已复制到剪贴板', 'ok');
      return;
    }
    if (!src.trim()) return toast('没有可复制的内容', 'err');
    const bodyHtml = tool.kind === 'pdf' || tool.kind === 'docx' || tool.kind === 'html' || tool.kind === 'editor'
      ? MD.renderMarkdown(src)
      : tablesBodyHtml(tool);
    const theme = currentTheme(tool);
    const css = Theme.buildDocCSS(theme, { pageWidth: 794 });
    const html = `<style>${css}</style><div class="doc">${bodyHtml}</div>`;
    const plain = MD.htmlToPlainText(MD.domFromHtml(bodyHtml), { keepUrls: false });
    await ipcRenderer.invoke('clipboard:write', { html, text: plain });
    toast('已复制（含富文本格式）', 'ok');
  } catch (err) {
    toast(String(err.message || err), 'err');
  }
}

/* ------------------------------------------------------------------ *
 *  文件
 * ------------------------------------------------------------------ */

function inputFilters(tool) {
  if (tool.acceptExts) return [{ name: tool.acceptExts.map((e) => e.toUpperCase()).join(' / '), extensions: tool.acceptExts }];
  if (tool.input === 'markdown') return [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'txt'] }];
  if (tool.input === 'csv') return [{ name: 'CSV / TSV', extensions: ['csv', 'tsv', 'txt'] }];
  if (tool.input === 'json') return [{ name: 'JSON', extensions: ['json', 'txt'] }];
  if (tool.input === 'html') return [{ name: 'HTML', extensions: ['html', 'htm', 'txt'] }];
  return [{ name: '所有文件', extensions: ['*'] }];
}

async function openFile(fileObj) {
  const tool = currentTool();
  let name = '', base64 = '', size = 0, ext = '';

  if (fileObj) {
    const buf = Buffer.from(await fileObj.arrayBuffer());
    name = fileObj.name;
    base64 = buf.toString('base64');
    size = buf.length;
    ext = (name.split('.').pop() || '').toLowerCase();
  } else {
    const r = await ipcRenderer.invoke('file:pick', { filters: inputFilters(tool) });
    if (r.canceled) return;
    name = r.name; base64 = r.base64; size = r.size; ext = (r.ext || '').replace('.', '');
  }

  if (tool.input === 'file') {
    state.files[tool.id] = { name, base64, size, ext };
    await parseFile(tool);
  } else {
    const text = Buffer.from(base64, 'base64').toString('utf8');
    state.src[tool.id] = text;
    state.files[tool.id] = { name, base64, size, ext };
    if (el.editor) el.editor.value = text;
  }
  persist();
  renderNow();
  toast('已载入 ' + name, 'ok');
}

async function parseFile(tool) {
  const f = state.files[tool.id];
  if (!f) return;
  if (tool.kind === 'docx2md') {
    const opts = getOpts(tool);
    try {
      const r = await CV.docxToMarkdown(f.base64, {
        headingStyle: opts.headingStyle,
        bullet: opts.bullet,
        codeBlockStyle: opts.codeBlockStyle
      });
      state.fileOut[tool.id] = { markdown: r.markdown, warnings: r.warnings };
      if (r.warnings && r.warnings.length) toast('转换完成（有 ' + r.warnings.length + ' 条提示）', 'ok');
    } catch (err) {
      state.fileOut[tool.id] = { markdown: '⚠ ' + err.message };
      toast(err.message, 'err');
    }
  } else if (tool.kind === 'pdf2md') {
    const opts = getOpts(tool);
    const r = await ipcRenderer.invoke('pdf:extract', { base64: f.base64 });
    if (!r.ok) {
      state.fileOut[tool.id] = { markdown: '⚠ ' + r.error };
      toast(r.error || 'PDF 解析失败', 'err');
      return;
    }
    try {
      const md = CV.pdfToMarkdown(r.pages, {
        pageMarkers: opts.pageMarkers,
        dehyphenate: opts.dehyphenate,
        joinWith: opts.joinWith
      });
      state.fileOut[tool.id] = { markdown: md };
      toast(`已解析 ${r.numPages} 页`, 'ok');
    } catch (err) {
      state.fileOut[tool.id] = { markdown: '⚠ ' + err.message };
      toast(err.message, 'err');
    }
  }
}

/* ------------------------------------------------------------------ *
 *  切换 / 初始化
 * ------------------------------------------------------------------ */

function switchTool(id) {
  if (state.toolId === id) return;
  state.toolId = id;
  persist();

  const tool = currentTool();
  document.querySelectorAll('.tool-item').forEach((n) => {
    n.classList.toggle('active', n.dataset.id === id);
  });
  el.crumb.textContent = tool.name;

  // 首次进入时给个示例
  if (tool.sample && state.src[id] === undefined) {
    state.src[id] = tool.sample;
  }
  el.editor.value = tool.input === 'file' ? '' : (state.src[id] || '');

  renderOptions();
  renderNow();
  el.paperScroll.scrollTop = 0;
  setTimeout(() => { el.paperScroll.scrollTop = 0; }, 260);
}

function applyTheme() {
  el.body.dataset.theme = state.theme;
  persist();
}

function currentZoom() {
  if (state.zoomMode === 'fit') {
    const pane = document.getElementById('panePreview');
    const w = Math.min(el.paperScroll.clientWidth || 9999, pane.getBoundingClientRect().width || 9999);
    const avail = Math.max(200, w - 40);
    state.zoom = Math.max(0.3, Math.min(1.2, avail / 794));
  }
  return state.zoom;
}

function layoutPaper() {
  const z = currentZoom();
  const h = parseFloat(el.preview.style.height) || 1123;
  el.paper.style.transform = `scale(${z})`;
  el.paperWrap.style.width = Math.round(794 * z) + 'px';
  el.paperWrap.style.height = Math.round(h * z) + 'px';
  el.zoomLabel.textContent = Math.round(z * 100) + '%';
}

function applyZoom() {
  layoutPaper();
}

function applyInputWidth() {
  if (state.inputWidth) {
    el.paneInput.style.width = state.inputWidth + 'px';
    el.paneInput.style.flex = '0 0 auto';
  }
}

function initEvents() {
  el.editor.addEventListener('input', () => {
    state.src[state.toolId] = el.editor.value;
    scheduleRender();
    persist();
  });

  // Tab 插入
  el.editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = el.editor.selectionStart, en = el.editor.selectionEnd;
      const v = el.editor.value;
      el.editor.value = v.slice(0, s) + '  ' + v.slice(en);
      el.editor.selectionStart = el.editor.selectionEnd = s + 2;
      state.src[state.toolId] = el.editor.value;
      scheduleRender();
    }
  });

  el.search.addEventListener('input', renderSidebar);

  el.btnPrimary.addEventListener('click', doExport);
  el.btnCopy.addEventListener('click', doCopy);
  el.btnCopyInline.addEventListener('click', doCopy);

  el.btnOpen.addEventListener('click', () => openFile(null));
  el.btnSample.addEventListener('click', () => {
    const tool = currentTool();
    if (!tool.sample) return;
    state.src[tool.id] = tool.sample;
    el.editor.value = tool.sample;
    persist();
    renderNow();
  });
  el.btnClear.addEventListener('click', () => {
    const tool = currentTool();
    state.src[tool.id] = '';
    state.files[tool.id] = null;
    state.fileOut[tool.id] = null;
    el.editor.value = '';
    persist();
    renderNow();
  });
  el.btnReset.addEventListener('click', () => {
    const tool = currentTool();
    delete state.opts[tool.id];
    persist();
    renderOptions();
    renderNow();
    toast('已恢复默认选项');
  });

  el.themeBtn.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
  });

  el.zoomIn.addEventListener('click', () => {
    state.zoomMode = 'manual';
    state.zoom = Math.min(2, +(state.zoom + 0.1).toFixed(2));
    applyZoom(); persist();
  });
  el.zoomOut.addEventListener('click', () => {
    state.zoomMode = 'manual';
    state.zoom = Math.max(0.3, +(state.zoom - 0.1).toFixed(2));
    applyZoom(); persist();
  });
  el.zoomLabel.addEventListener('click', () => {
    state.zoomMode = 'fit';
    applyZoom(); persist();
    toast('已切换为自适应宽度');
  });

  // 模板弹窗
  el.modalClose.addEventListener('click', closeModal);
  el.overlay.addEventListener('click', (e) => { if (e.target === el.overlay) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); doExport(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); openFile(null); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); doCopy(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); renderNow(); }
  });

  // 拖拽
  ['dragenter', 'dragover'].forEach((ev) => {
    window.addEventListener(ev, (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        el.dropzone.classList.add('hover');
      }
    });
  });
  ['dragleave', 'drop'].forEach((ev) => {
    window.addEventListener(ev, (e) => {
      e.preventDefault();
      el.dropzone.classList.remove('hover');
      if (ev === 'drop' && e.dataTransfer && e.dataTransfer.files.length) {
        openFile(e.dataTransfer.files[0]);
      }
    });
  });

  el.dropzone.addEventListener('click', () => openFile(null));

  // 分割条
  let dragging = false;
  el.splitter.addEventListener('mousedown', (e) => {
    dragging = true;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = document.getElementById('workspace').getBoundingClientRect();
    const w = Math.max(320, Math.min(rect.width - 420, e.clientX - rect.left));
    el.paneInput.style.width = w + 'px';
    el.paneInput.style.flex = '0 0 auto';
    state.inputWidth = w;
  });
  window.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; document.body.style.cursor = ''; persist(); }
  });

  // 预览区尺寸变化时重算自适应缩放
  if (window.ResizeObserver) {
    let ro_t = null;
    const ro = new ResizeObserver(() => {
      clearTimeout(ro_t);
      ro_t = setTimeout(() => { if (state.zoomMode === 'fit') applyZoom(); }, 60);
    });
    ro.observe(el.paperScroll);
  }

  // 菜单事件
  ipcRenderer.on('menu:open', () => openFile(null));
  ipcRenderer.on('menu:export', () => doExport());
  ipcRenderer.on('menu:copy', () => doCopy());
  ipcRenderer.on('mdto:open-tool', (_e, id) => {
    if (toolById(id)) switchTool(id);
  });

  window.addEventListener('resize', () => {
    const d = el.preview.contentDocument;
    if (d && d.body) {
      try { el.preview.style.height = Math.max(320, Math.ceil(d.body.getBoundingClientRect().height)) + 'px'; } catch (_) {}
    }
    if (state.zoomMode === 'fit') {
      clearTimeout(window.__rz);
      window.__rz = setTimeout(applyZoom, 120);
    }
  });
}

function init() {
  loadState();
  applyTheme();
  el.search.value = '';

  // 支持 index.html?tool=docx 直接进入某个工具
  try {
    const q = new URLSearchParams(location.search);
    const t = q.get('tool');
    if (t && toolById(t).id === t) state.toolId = t;
  } catch (_) {}

  renderSidebar();

  const tool = currentTool();
  if (tool.sample && state.src[tool.id] === undefined) state.src[tool.id] = tool.sample;
  el.crumb.textContent = tool.name;
  el.editor.value = tool.input === 'file' ? '' : (state.src[tool.id] || '');

  initEvents();
  applyInputWidth();
  renderOptions();
  renderNow();
  applyZoom();
  setTimeout(() => { el.paperScroll.scrollTop = 0; applyZoom(); }, 300);

  // iframe 首次可能未就绪
  el.preview.addEventListener('load', () => { iframeDoc = null; renderNow(); }, { once: true });
}

function start() {
  try {
    init();
  } catch (err) {
    console.error(err);
    document.body.innerHTML = '<pre style="padding:24px;color:#ff8080;font:12px monospace">' +
      '初始化失败：\n' + (err && err.stack || err) + '</pre>';
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
