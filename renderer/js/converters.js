'use strict';

const Papa = require('papaparse');
const TurndownService = require('turndown');
const turndownGfm = require('turndown-plugin-gfm');
const MD = require('./markdown');

/* ------------------------------------------------------------------ *
 *  表格：通用工具
 * ------------------------------------------------------------------ */

function tableToRows(table) {
  const cols = Math.max(...table.rows.map((r) => r.length));
  return table.rows.map((r) => {
    const row = r.slice();
    while (row.length < cols) row.push('');
    return row;
  });
}

function escapeCell(s) {
  return String(s == null ? '' : s)
    .replace(/\r?\n/g, '<br>')
    .replace(/\|/g, '\\|')
    .trim();
}

/** rows → markdown 表格 */
function rowsToMdTable(rows, opts = {}) {
  if (!rows.length) return '';
  const cols = Math.max(...rows.map((r) => r.length));
  const norm = rows.map((r) => {
    const c = r.slice();
    while (c.length < cols) c.push('');
    return c.map(escapeCell);
  });
  const align = opts.align || 'left';
  const head = norm[0];
  const body = norm.slice(1);
  const sep = Array.from({ length: cols }, () => {
    if (align === 'center') return ':---:';
    if (align === 'right') return '---:';
    if (align === 'auto') return ':---';
    return '---';
  });
  const line = (cells) => '| ' + cells.join(' | ') + ' |';
  return [line(head), line(sep), ...body.map(line)].join('\n');
}

function mdTables(src) {
  const dom = MD.mdToDom(src);
  return MD.extractTables(dom);
}

/* ------------------------------------------------------------------ *
 *  CSV
 * ------------------------------------------------------------------ */

function mdToCsv(src, opts = {}) {
  const tables = mdTables(src);
  if (!tables.length) throw new Error('没有在内容里找到 Markdown 表格');
  const sep = opts.delimiter === 'tab' ? '\t' : (opts.delimiter || ',');
  const list = opts.allTables ? tables : [tables[0]];
  return list.map((t, i) => {
    const rows = tableToRows(t);
    const csv = rows.map((r) => r.map((c) => {
      const v = String(c == null ? '' : c);
      if (sep === '\t') return v.replace(/\t/g, ' ').replace(/\n/g, ' ');
      const needQuote = opts.quoteAll || /["\n\r]/.test(v) || v.includes(sep);
      return needQuote ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(sep)).join('\r\n');
    return (opts.allTables && tables.length > 1 ? `# table-${i + 1}\n` : '') + csv;
  }).join('\n\n');
}

function csvToMdTable(text, opts = {}) {
  const res = Papa.parse(text.replace(/^\uFEFF/, ''), {
    delimiter: opts.delimiter === 'auto' || !opts.delimiter ? '' : opts.delimiter,
    skipEmptyLines: opts.skipEmpty ? 'greedy' : false,
    newline: '\n'
  });
  let rows = (res.data || []).filter((r) => Array.isArray(r));
  if (!rows.length) throw new Error('CSV 内容为空');
  rows = rows.map((r) => r.map((c) => String(c == null ? '' : c)));
  if (opts.firstRowHeader === false) {
    const cols = Math.max(...rows.map((r) => r.length));
    rows.unshift(Array.from({ length: cols }, (_, i) => `列${i + 1}`));
  }
  return rowsToMdTable(rows, { align: opts.align }) + '\n';
}

/* ------------------------------------------------------------------ *
 *  JSON → Markdown 表格
 * ------------------------------------------------------------------ */

function jsonToMdTable(text, opts = {}) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('JSON 解析失败：' + e.message); }

  let arr = data;
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (opts.rootKey && data[opts.rootKey]) {
      arr = data[opts.rootKey];
    } else {
      const keys = Object.keys(data);
      const arrKey = keys.find((k) => Array.isArray(data[k]));
      arr = arrKey ? data[arrKey] : [data];
    }
  }
  if (!Array.isArray(arr)) throw new Error('JSON 根节点不是数组，无法转成表格');
  if (!arr.length) throw new Error('JSON 数组为空');

  let rows;
  if (arr.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
    const keys = [];
    arr.forEach((o) => Object.keys(o).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
    rows = [keys, ...arr.map((o) => keys.map((k) => flattenVal(o[k], opts)))];
  } else if (arr.every((x) => Array.isArray(x))) {
    rows = arr.map((r) => r.map((v) => flattenVal(v, opts)));
    if (opts.firstRowHeader !== false) {
      const cols = Math.max(...rows.map((r) => r.length));
      rows.unshift(Array.from({ length: cols }, (_, i) => `列${i + 1}`));
    }
  } else {
    rows = [['#', 'value'], ...arr.map((v, i) => [String(i + 1), flattenVal(v, opts)])];
  }
  return rowsToMdTable(rows, { align: opts.align }) + '\n';
}

function flattenVal(v, opts = {}) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v)) return opts.nested === 'json' ? JSON.stringify(v) : v.join(', ');
    return opts.nested === 'json' ? JSON.stringify(v)
      : Object.entries(v).map(([k, x]) => `${k}: ${typeof x === 'object' ? JSON.stringify(x) : x}`).join('; ');
  }
  return String(v);
}

/* ------------------------------------------------------------------ *
 *  表格数据（Excel 由主进程生成）
 * ------------------------------------------------------------------ */

function tablesForExcel(tables, opts = {}) {
  return tables.map((t, i) => ({
    name: (opts.sheetNames && opts.sheetNames[i]) || `Table${i + 1}`,
    rows: tableToRows(t)
  }));
}

/* ------------------------------------------------------------------ *
 *  HTML / DOCX / PDF → Markdown
 * ------------------------------------------------------------------ */

function makeTurndown(opts = {}) {
  const td = new TurndownService({
    headingStyle: opts.headingStyle || 'atx',
    hr: '---',
    bulletListMarker: opts.bullet || '-',
    codeBlockStyle: opts.codeBlockStyle || 'fenced',
    fence: '```',
    emDelimiter: opts.emDelimiter || '_',
    strongDelimiter: '**',
    linkStyle: opts.linkStyle || 'inlined'
  });

  try { td.use(turndownGfm.tables); td.use(turndownGfm.strikethrough); } catch (_) {}

  // 保留未转换的 HTML 标签
  if (opts.keepTags && opts.keepTags.length) {
    td.keep(opts.keepTags);
  }

  // 去掉脚本与样式
  td.remove(['script', 'style', 'noscript', 'meta', 'link']);

  // 图片：保留原始 src
  td.addRule('img', {
    filter: 'img',
    replacement: (content, node) => {
      const src = node.getAttribute('src') || '';
      const alt = node.getAttribute('alt') || '';
      const title = node.getAttribute('title');
      if (!src) return '';
      return `![${alt}](${src}${title ? ` "${title}"` : ''})`;
    }
  });

  // 表格单元格内换行
  td.addRule('br', {
    filter: 'br',
    replacement: () => (opts.brAsSpace ? ' ' : '  \n')
  });

  return td;
}

function htmlToMarkdown(html, opts = {}) {
  if (!html || !html.trim()) throw new Error('内容为空');

  // 先把表格抽出来自己做（turndown 的表格规则对无 th 的表格会生成坏表格）
  const dom = MD.domFromHtml(html);
  const tables = [];
  dom.querySelectorAll('table').forEach((t) => {
    const rows = [];
    t.querySelectorAll('tr').forEach((tr) => {
      const cells = [];
      tr.querySelectorAll('th,td').forEach((c) => cells.push(MD.textOf(c).replace(/\s+/g, ' ').trim()));
      if (cells.length) rows.push(cells);
    });
    const token = `mdtotable${tables.length}`;
    tables.push(rows.length ? rowsToMdTable(rows) : '');
    const ph = document.createElement('p');
    ph.textContent = token;
    if (t.parentNode) t.parentNode.replaceChild(ph, t);
  });

  const td = makeTurndown(opts);
  let md = td.turndown(dom.innerHTML);

  if (tables.length) {
    md = md.replace(/mdtotable(\d+)/g, (_, i) => {
      const tbl = tables[Number(i)];
      return tbl ? '\n\n' + tbl + '\n\n' : '';
    });
  }

  // 标题里的整段加粗去掉（Word 导出的标题常带 strong）
  md = md.replace(/^(#{1,6})\s+(.*)$/gm, (line, hashes, text) => {
    const stripped = text.replace(/^\*\*(.+)\*\*$/, '$1').replace(/^\*(.+)\*$/, '$1');
    return hashes + ' ' + stripped;
  });

  // 任务列表的方括号不要转义
  md = md.replace(/^(\s*[-*+]\s+)\\\[([ xX])\\\]/gm, '$1[$2]');

  md = md.replace(/\n{3,}/g, '\n\n').trim() + '\n';
  return md;
}

async function docxToMarkdown(base64, opts = {}) {
  const { ipcRenderer } = require('electron');
  const r = await ipcRenderer.invoke('docx:extract', { base64 });
  if (!r.ok) throw new Error(r.error || 'Word 解析失败');
  return {
    markdown: htmlToMarkdown(r.html, opts),
    warnings: r.warnings || []
  };
}

/**
 * pdf 页面文本项 → Markdown
 * pages: [{ page, width, height, items:[{str,x,y,w,size}] }]
 */
function pdfToMarkdown(pages, opts = {}) {
  if (!pages || !pages.length) throw new Error('PDF 没有可提取的文本');

  /* 正文字号：按字符数加权取众数 */
  const sizeWeight = new Map();
  pages.forEach((p) => p.items.forEach((it) => {
    const k = Math.round(it.size * 2) / 2;
    sizeWeight.set(k, (sizeWeight.get(k) || 0) + it.str.length);
  }));
  let bodySize = 10, best = -1;
  sizeWeight.forEach((w, k) => { if (w > best) { best = w; bodySize = k; } });

  /* 按字号分级：比正文大的字号从大到小依次对应 h1/h2/h3 */
  const headingSizes = [...sizeWeight.keys()]
    .filter((k) => k > bodySize * 1.06)
    .sort((a, b) => b - a)
    .slice(0, 3);
  const levelOf = (size) => {
    const i = headingSizes.findIndex((k) => Math.abs(k - size) < 0.6);
    return i >= 0 ? i + 1 : 0;
  };

  const blocks = [];
  const isAsciiWord = (ch) => /[A-Za-z0-9@#$_&+\-*/\\<>[\]{}()"'`]/.test(ch || '');
  const clean = (s) => String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  pages.forEach((p, pi) => {
    const items = p.items.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const lines = [];
    items.forEach((it) => {
      const last = lines[lines.length - 1];
      const tol = Math.max(2, it.size * 0.45);
      if (last && Math.abs(it.y - last.y) <= tol) {
        last.items.push(it);
        last.size = Math.max(last.size, it.size);
        last.y = (last.y * (last.items.length - 1) + it.y) / last.items.length;
      } else {
        lines.push({ y: it.y, size: it.size, items: [it] });
      }
    });

    lines.forEach((ln) => {
      const sorted = ln.items.sort((a, b) => a.x - b.x);
      const raw = sorted.reduce((s, it, i, arr) => {
        if (i === 0) return it.str;
        const prev = arr[i - 1];
        const gap = it.x - (prev.x + prev.w);
        const prevCh = s.slice(-1);
        const nextCh = it.str.slice(0, 1);
        // 只有两侧至少一个是西文字符时才补空格，避免中文被拆开
        const needSpace = gap > Math.max(1.2, it.size * 0.17) &&
          !/\s$/.test(s) &&
          !/^[\s，。、；：！？）】》,.;:!?)]/.test(nextCh) &&
          (isAsciiWord(prevCh) || isAsciiWord(nextCh));
        return s + (needSpace ? ' ' : '') + it.str;
      }, '');

      let txt = clean(raw);
      try { txt = clean(txt.normalize('NFKC')); } catch (_) {}
      if (!txt) return;
      // 过滤纯页码行
      if (/^\d{1,3}\s*(\/|of|共)\s*\d{1,3}\s*(页)?$/i.test(txt)) return;

      const left = sorted[0].x;
      const lastIt = sorted[sorted.length - 1];
      blocks.push({
        page: pi + 1,
        y: ln.y,
        size: ln.size,
        text: txt,
        left,
        right: lastIt.x + lastIt.w,
        pageWidth: p.width
      });
    });
  });

  const out = [];
  let prev = null;
  let para = [];
  let listMode = null;

  const flushPara = () => {
    if (para.length) {
      out.push(joinLines(para, opts), '');
      para = [];
    }
  };

  for (const b of blocks) {
    if (prev && b.page !== prev.page) {
      flushPara();
      listMode = null;
      if (opts.pageMarkers) out.push(`<!-- page ${b.page} -->`, '');
    }

    const level = levelOf(b.size);
    const bullet = /^([•·▪◦‣∙o]|-\s)\s*/.exec(b.text);
    const ordered = /^(\d{1,2}[.)])\s+/.exec(b.text);

    // 上一行是否写满整行（写满才可能是同一段落的折行）
    const fullLine = prev && prev.page === b.page &&
      prev.right > (prev.pageWidth || 595) * 0.80 &&
      (b.y - prev.y) < b.size * 2.2;

    if (level) {
      flushPara();
      listMode = null;
      out.push('#'.repeat(Math.min(6, level)) + ' ' + b.text.replace(/\s+/g, ' ').trim(), '');
    } else if (bullet) {
      flushPara();
      listMode = 'ul';
      out.push('- ' + b.text.replace(bullet[0], '').trim());
    } else if (ordered) {
      flushPara();
      listMode = 'ol';
      out.push(b.text.trim());
    } else if (fullLine && !listMode) {
      para.push(b.text);
    } else {
      flushPara();
      listMode = null;
      para.push(b.text);
    }
    prev = b;
  }
  flushPara();

  let md = out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  if (opts.dehyphenate) {
    md = md.replace(/(\w)-\n(\w)/g, '$1$2');
  }
  return md;
}

function joinLines(lines, opts = {}) {
  const cjk = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/;
  let s = '';
  lines.forEach((l, i) => {
    if (i === 0) { s = l; return; }
    const prevCh = s.slice(-1);
    const nextCh = l.slice(0, 1);
    if (cjk.test(prevCh) || cjk.test(nextCh)) s += l;
    else s += (opts.joinWith === 'newline' ? '  \n' : ' ') + l;
  });
  return s;
}

/* ------------------------------------------------------------------ *
 *  Markdown → HTML 独立文件
 * ------------------------------------------------------------------ */

function mdToStandaloneHtml(src, theme, opts = {}) {
  const Theme = require('./theme');
  const bodyHtml = MD.renderMarkdown(src);
  const toc = opts.toc ? MD.buildToc(src) : '';
  return Theme.buildDocument({
    bodyHtml,
    theme,
    mode: opts.mode || 'preview',
    title: opts.title || 'Document',
    pageSize: opts.pageSize || 'A4',
    margins: { top: 0, left: 0, right: 0, bottom: 0 },
    toc,
    numbered: !!opts.numbered,
    pageWidth: opts.pageWidth
  });
}

/* ------------------------------------------------------------------ *
 *  统计
 * ------------------------------------------------------------------ */

function stats(src) {
  const text = String(src || '');
  const words = (text.match(/[\u4e00-\u9fa5]/g) || []).length +
    (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9_'-]+/g) || []).length;
  const chars = text.replace(/\s/g, '').length;
  const lines = text.split('\n').length;
  const tables = (text.match(/^\s*\|.*\|\s*$/gm) || []).length;
  return { words, chars, lines, tables, readingMin: Math.max(1, Math.round(words / 350)) };
}

module.exports = {
  rowsToMdTable, tableToRows, mdTables, tablesForExcel,
  mdToCsv, csvToMdTable, jsonToMdTable,
  htmlToMarkdown, docxToMarkdown, pdfToMarkdown,
  mdToStandaloneHtml, stats, makeTurndown
};
