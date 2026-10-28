'use strict';

const MarkdownIt = require('markdown-it');

/* 按需注册常用语言（避免加载 highlight.js 全量包） */
const hljs = require('highlight.js/lib/core');
const LANG_MODULES = {
  bash: 'bash', c: 'c', cpp: 'cpp', csharp: 'csharp', css: 'css', dart: 'dart',
  diff: 'diff', dockerfile: 'dockerfile', go: 'go', graphql: 'graphql', groovy: 'groovy',
  haskell: 'haskell', ini: 'ini', java: 'java', javascript: 'javascript',
  json: 'json', julia: 'julia', kotlin: 'kotlin', latex: 'latex', less: 'less',
  lua: 'lua', makefile: 'makefile', markdown: 'markdown', matlab: 'matlab',
  nginx: 'nginx', objectivec: 'objectivec', perl: 'perl', php: 'php',
  powershell: 'powershell', protobuf: 'protobuf', python: 'python', r: 'r',
  ruby: 'ruby', rust: 'rust', scala: 'scala', scss: 'scss', shell: 'shell',
  sql: 'sql', swift: 'swift', typescript: 'typescript', vim: 'vim',
  wasm: 'wasm', xml: 'xml', yaml: 'yaml'
};
Object.keys(LANG_MODULES).forEach((name) => {
  try {
    hljs.registerLanguage(name, require('highlight.js/lib/languages/' + LANG_MODULES[name]));
  } catch (_) {}
});
hljs.registerAliases(['html', 'xhtml', 'svg'], { languageName: 'xml' });
hljs.registerAliases(['js', 'jsx'], { languageName: 'javascript' });
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });
hljs.registerAliases(['py'], { languageName: 'python' });
hljs.registerAliases(['sh', 'zsh', 'console'], { languageName: 'bash' });
hljs.registerAliases(['yml'], { languageName: 'yaml' });
hljs.registerAliases(['c++', 'cc', 'h'], { languageName: 'cpp' });
hljs.registerAliases(['cs'], { languageName: 'csharp' });
hljs.registerAliases(['tex'], { languageName: 'latex' });
hljs.registerAliases(['ps1'], { languageName: 'powershell' });

/* ------------------------------------------------------------------ *
 *  Markdown 渲染
 * ------------------------------------------------------------------ */

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[\s\u3000]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5\-]/g, '')
    .replace(/-+/g, '-') || 'section';
}

function createMd() {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false,
    highlight(str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return '<pre class="hljs"><code>' +
            hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
            '</code></pre>';
        } catch (_) {}
      }
      return '<pre class="hljs"><code>' +
        md.utils.escapeHtml(str) + '</code></pre>';
    }
  });

  // 标题 id（供目录锚点使用）
  md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
    if (!env.usedIds) env.usedIds = new Map();
    const used = env.usedIds;
    const inline = tokens[idx + 1];
    const text = inline && inline.content ? inline.content : '';
    let id = slugify(text);
    if (used.has(id)) {
      const n = used.get(id) + 1;
      used.set(id, n);
      id = id + '-' + n;
    } else {
      used.set(id, 0);
    }
    tokens[idx].attrSet('id', id);
    return self.renderToken(tokens, idx, options);
  };

  // 任务列表
  md.core.ruler.after('inline', 'task_lists', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'inline') continue;
      const paraOpen = tokens[i - 1];
      if (!paraOpen || paraOpen.type !== 'paragraph_open') continue;
      const li = tokens[i - 2];
      if (!li || li.type !== 'list_item_open') continue;
      const m = /^\[([ xX])\]\s+/.exec(tokens[i].content);
      if (!m) continue;
      const checked = m[1].toLowerCase() === 'x';
      tokens[i].content = tokens[i].content.slice(m[0].length);
      const kids = tokens[i].children || [];
      if (kids.length && kids[0].type === 'text') {
        kids[0].content = kids[0].content.replace(/^\[([ xX])\]\s+/, '');
      }
      const box = `<input type="checkbox" disabled${checked ? ' checked' : ''}> `;
      const t = new state.Token('html_inline', '', 0);
      t.content = box;
      kids.unshift(t);
      li.attrJoin('class', 'task-list-item');
      tokens[i].children = kids;
    }
  });

  // 表格外包一层容器，便于横向滚动
  const oldTableOpen = md.renderer.rules.table_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };
  md.renderer.rules.table_open = function (tokens, idx, options, env, self) {
    return '<div class="table-wrap">' + oldTableOpen(tokens, idx, options, env, self);
  };
  const oldTableClose = md.renderer.rules.table_close || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };
  md.renderer.rules.table_close = function (tokens, idx, options, env, self) {
    return oldTableClose(tokens, idx, options, env, self) + '</div>';
  };

  return md;
}

const md = createMd();

/** 渲染 markdown → html */
function renderMarkdown(src) {
  const env = {};
  return md.render(src || '', env);
}

/** 抽取标题，生成 TOC HTML */
function buildToc(src) {
  const tokens = md.parse(src || '', {});
  const items = [];
  const used = new Map();
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'heading_open') {
      const level = Number(tokens[i].tag.slice(1));
      if (level > 3) continue;
      const inline = tokens[i + 1];
      const raw = inline && inline.content ? inline.content : '';
      let id = slugify(raw);
      if (used.has(id)) {
        const n = used.get(id) + 1;
        used.set(id, n);
        id = id + '-' + n;
      } else {
        used.set(id, 0);
      }
      items.push({ level, text: raw.replace(/[*_`~]/g, ''), id });
    }
  }
  if (!items.length) return '';
  const lis = items.map((it) =>
    `<li class="toc-l${it.level}"><a href="#${escapeAttr(it.id)}">${escapeHtml(it.text)}</a></li>`
  ).join('');
  return `<nav class="toc"><div class="toc-title">目录</div><ol>${lis}</ol></nav>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

/* ------------------------------------------------------------------ *
 *  DOM 工具
 * ------------------------------------------------------------------ */

function domFromHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return div;
}

function mdToDom(src) {
  return domFromHtml(renderMarkdown(src));
}

function textOf(node) {
  return (node.textContent || '').replace(/\u00a0/g, ' ');
}

/* 表格提取（Excel / CSV / 表格预览用） */
function extractTables(root) {
  const tables = [];
  root.querySelectorAll('table').forEach((t, i) => {
    const rows = [];
    t.querySelectorAll('tr').forEach((tr) => {
      const cells = [];
      tr.querySelectorAll('th,td').forEach((c) => {
        cells.push(textOf(c).replace(/\s+/g, ' ').trim());
      });
      if (cells.length) rows.push(cells);
    });
    if (rows.length) {
      // 表头：优先取 thead 里的行
      let headerRows = 0;
      const thead = t.querySelector('thead');
      if (thead) headerRows = thead.querySelectorAll('tr').length;
      tables.push({ index: i + 1, rows, headerRows: Math.max(1, headerRows) });
    }
  });
  return tables;
}

/* ------------------------------------------------------------------ *
 *  Markdown → 纯文本
 * ------------------------------------------------------------------ */

function htmlToPlainText(root, opts = {}) {
  const keepUrls = !!opts.keepUrls;
  const bullet = opts.bullet || '- ';
  const out = [];
  let indent = 0;

  const pad = (n) => ' '.repeat(Math.max(0, n));

  function inline(node) {
    let s = '';
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) { s += c.nodeValue.replace(/\s+/g, ' '); return; }
      if (c.nodeType !== 1) return;
      const tag = c.tagName.toLowerCase();
      switch (tag) {
        case 'br': s += '\n'; break;
        case 'strong': case 'b': s += inline(c); break;
        case 'em': case 'i': s += inline(c); break;
        case 'code': s += textOf(c); break;
        case 'a': {
          const txt = inline(c) || c.getAttribute('href') || '';
          const href = c.getAttribute('href') || '';
          s += keepUrls && href && href !== txt ? `${txt.trim()} (${href})` : txt;
          break;
        }
        case 'img': s += c.getAttribute('alt') ? `[${c.getAttribute('alt')}]` : ''; break;
        case 'del': case 's': s += inline(c); break;
        case 'input': break;
        default: s += inline(c);
      }
    });
    return s;
  }

  function blockWrap(text, level) {
    const t = text.trim();
    if (!t) return;
    const lines = t.split('\n');
    lines.forEach((ln, i) => {
      if (i === 0) out.push(pad(level) + ln.trim());
      else out.push(ln.trim() ? pad(level) + ln.trim() : '');
    });
  }

  function walk(node, level) {
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) {
        const t = c.nodeValue.replace(/\s+/g, ' ').trim();
        if (t) out.push(pad(level) + t);
        return;
      }
      if (c.nodeType !== 1) return;
      const tag = c.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        const lv = Number(tag[1]);
        const txt = inline(c).replace(/\s+/g, ' ').trim();
        if (!txt) return;
        if (out.length) out.push('');
        if (opts.headingStyle === 'underline' && lv <= 2) {
          out.push(txt);
          out.push((lv === 1 ? '=' : '-').repeat(Math.min(60, Math.max(6, txt.length))));
        } else if (opts.headingStyle === 'prefix') {
          out.push('#'.repeat(lv) + ' ' + txt);
        } else {
          out.push(txt);
        }
        out.push('');
        return;
      }
      switch (tag) {
        case 'p': {
          const txt = inline(c).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
          if (txt) { out.push(pad(level) + txt); out.push(''); }
          break;
        }
        case 'ul': case 'ol': {
          let n = 1;
          const items = Array.from(c.querySelectorAll(':scope > li'));
          items.forEach((li) => {
            const marker = tag === 'ol' ? `${n++}. ` : bullet;
            // 取 li 中非列表的部分作为文本
            let txt = '';
            const sub = [];
            li.childNodes.forEach((ch) => {
              if (ch.nodeType === 1 && ['ul', 'ol'].includes(ch.tagName.toLowerCase())) {
                sub.push(ch);
              } else if (ch.nodeType === 1 && ch.tagName.toLowerCase() === 'p') {
                txt += inline(ch).replace(/\s+/g, ' ').trim() + ' ';
              } else if (ch.nodeType === 1) {
                txt += inline(ch);
              } else if (ch.nodeType === 3) {
                txt += ch.nodeValue.replace(/\s+/g, ' ');
              }
            });
            txt = txt.replace(/\s+/g, ' ').trim();
            out.push(pad(level + 2) + marker + txt);
            sub.forEach((s) => walk(s, level + 2 + marker.length));
          });
          out.push('');
          break;
        }
        case 'pre': {
          const code = textOf(c).replace(/\n$/, '');
          out.push('');
          if (opts.codeStyle === 'fence') {
            const langEl = c.querySelector('code');
            const cls = langEl ? (langEl.className || '') : '';
            const lm = /language-([\w+-]+)/.exec(cls);
            out.push('```' + (lm ? lm[1] : ''));
            code.split('\n').forEach((l) => out.push(l));
            out.push('```');
          } else {
            code.split('\n').forEach((l) => out.push('    ' + l));
          }
          out.push('');
          break;
        }
        case 'blockquote': {
          const inner = [];
          const save = out.length;
          walk(c, level + 2);
          const chunk = out.splice(save);
          chunk.forEach((l) => out.push(l ? '> ' + l.replace(/^ +/, '') : '>'));
          out.push('');
          break;
        }
        case 'table': {
          const tabs = extractTables(c.parentElement || c);
          // 单表直接排版
          const t = extractTables(wrapSingle(c))[0];
          if (t) {
            const widths = [];
            t.rows.forEach((r) => r.forEach((cell, i) => {
              widths[i] = Math.max(widths[i] || 0, cell.length);
            }));
            out.push('');
            t.rows.forEach((r, ri) => {
              out.push(r.map((cell, i) => cell.padEnd(widths[i])).join('  ').trimEnd());
              if (ri === 0) out.push(widths.map((w) => '-'.repeat(Math.max(3, w))).join('  '));
            });
            out.push('');
          }
          break;
        }
        case 'hr': out.push(''); out.push('—'.repeat(30)); out.push(''); break;
        case 'div': case 'section': case 'article': case 'main': case 'body':
          walk(c, level); break;
        case 'script': case 'style': break;
        default: {
          const txt = inline(c).replace(/\s+/g, ' ').trim();
          if (txt) out.push(pad(level) + txt);
        }
      }
    });
  }

  function wrapSingle(node) {
    const d = document.createElement('div');
    d.appendChild(node.cloneNode(true));
    return d;
  }

  walk(root, 0);

  let text = out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '');
  if (opts.wrap) {
    text = wrapText(text, opts.wrap);
  }
  return text.trim() + '\n';
}

function wrapText(text, width) {
  return text.split('\n').map((line) => {
    if (line.length <= width) return line;
    const indent = (/^\s*/.exec(line) || [''])[0];
    let rest = line.slice(indent.length);
    const lines = [];
    while (rest.length > width - indent.length) {
      let cut = rest.lastIndexOf(' ', width - indent.length);
      if (cut <= 0) cut = width - indent.length;
      lines.push(indent + rest.slice(0, cut));
      rest = rest.slice(cut).replace(/^\s+/, '');
    }
    lines.push(indent + rest);
    return lines.join('\n');
  }).join('\n');
}

/* ------------------------------------------------------------------ *
 *  Markdown → LaTeX
 * ------------------------------------------------------------------ */

function escapeLatex(s) {
  return String(s)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

function htmlToLatex(root, opts = {}) {
  const top = opts.topLevel === 'chapter' ? 'chapter' : 'section';
  const levels = {
    h1: top,
    h2: top === 'chapter' ? 'section' : 'subsection',
    h3: top === 'chapter' ? 'subsection' : 'subsubsection',
    h4: top === 'chapter' ? 'subsubsection' : 'paragraph',
    h5: 'paragraph',
    h6: 'subparagraph'
  };
  const out = [];

  function inline(node) {
    let s = '';
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) { s += escapeLatex(c.nodeValue.replace(/\s+/g, ' ')); return; }
      if (c.nodeType !== 1) return;
      const tag = c.tagName.toLowerCase();
      switch (tag) {
        case 'br': s += '\\\\\n'; break;
        case 'strong': case 'b': s += `\\textbf{${inline(c)}}`; break;
        case 'em': case 'i': s += `\\textit{${inline(c)}}`; break;
        case 'del': case 's': s += `\\sout{${inline(c)}}`; break;
        case 'code': s += `\\texttt{${escapeLatex(textOf(c).replace(/\s+/g, ' '))}}`; break;
        case 'a': {
          const href = c.getAttribute('href') || '';
          const txt = inline(c) || escapeLatex(href);
          s += href ? `\\href{${href}}{${txt}}` : txt;
          break;
        }
        case 'img': {
          const src = c.getAttribute('src') || '';
          const alt = c.getAttribute('alt') || '';
          s += `\\begin{figure}[H]\n\\centering\n\\includegraphics[width=0.85\\linewidth]{${src}}\n` +
               (alt ? `\\caption{${escapeLatex(alt)}}\n` : '') + `\\end{figure}`;
          break;
        }
        case 'input': break;
        default: s += inline(c);
      }
    });
    return s;
  }

  function walk(node, depth) {
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) return;
      if (c.nodeType !== 1) return;
      const tag = c.tagName.toLowerCase();
      if (levels[tag]) {
        const txt = inline(c).trim();
        if (txt) out.push(`\n\\${levels[tag]}*{${stripInlineLatex(txt)}}\n`);
        return;
      }
      switch (tag) {
        case 'p': {
          const txt = inline(c).trim();
          if (txt) out.push(txt + '\n');
          break;
        }
        case 'ul': {
          const items = Array.from(c.querySelectorAll(':scope > li'));
          const body = items.map((li) => {
            const sub = li.querySelectorAll(':scope > ul, :scope > ol');
            const clone = li.cloneNode(true);
            clone.querySelectorAll(':scope > ul, :scope > ol').forEach((n) => n.remove());
            const txt = inline(clone).trim();
            let item = `  \\item ${txt}\n`;
            if (sub.length) {
              const tmp = document.createElement('div');
              sub.forEach((s) => tmp.appendChild(s.cloneNode(true)));
              const subLatex = capture(() => walk(tmp, depth + 1));
              item += indentLatex(subLatex, '    ');
            }
            return item;
          }).join('');
          out.push(`\\begin{itemize}\n${body}\\end{itemize}\n`);
          break;
        }
        case 'ol': {
          const items = Array.from(c.querySelectorAll(':scope > li'));
          const body = items.map((li) => {
            const sub = li.querySelectorAll(':scope > ul, :scope > ol');
            const clone = li.cloneNode(true);
            clone.querySelectorAll(':scope > ul, :scope > ol').forEach((n) => n.remove());
            const txt = inline(clone).trim();
            let item = `  \\item ${txt}\n`;
            if (sub.length) {
              const tmp = document.createElement('div');
              sub.forEach((s) => tmp.appendChild(s.cloneNode(true)));
              const subLatex = capture(() => walk(tmp, depth + 1));
              item += indentLatex(subLatex, '    ');
            }
            return item;
          }).join('');
          out.push(`\\begin{enumerate}\n${body}\\end{enumerate}\n`);
          break;
        }
        case 'blockquote': {
          const inner = capture(() => walk(c, depth + 1));
          out.push(`\\begin{quote}\n${inner.trim()}\n\\end{quote}\n`);
          break;
        }
        case 'pre': {
          const codeEl = c.querySelector('code');
          const cls = codeEl ? (codeEl.className || '') : '';
          const lm = /language-([\w+-]+)/.exec(cls);
          const lang = lm ? lm[1] : '';
          const code = textOf(c).replace(/\n$/, '');
          if (opts.codeEnv === 'verbatim') {
            out.push(`\\begin{verbatim}\n${code}\n\\end{verbatim}\n`);
          } else {
            out.push(`\\begin{lstlisting}${lang ? `[language=${lang}]` : ''}\n${code}\n\\end{lstlisting}\n`);
          }
          break;
        }
        case 'table': {
          const t = extractTables(wrapSingle(c))[0];
          if (t) {
            const cols = Math.max(...t.rows.map((r) => r.length));
            const spec = '|' + Array(cols).fill('l').join('|') + '|';
            const body = t.rows.map((r, ri) => {
              const cells = Array.from({ length: cols }, (_, i) => r[i] != null ? escapeLatex(r[i]) : '');
              const line = cells.join(' & ') + ' \\\\';
              return ri === 0 ? `\\hline\n${line}\n\\hline` : line;
            }).join('\n');
            out.push(`\\begin{table}[H]\n\\centering\n\\begin{tabular}{${spec}}\n${body}\n\\end{tabular}\n\\end{table}\n`);
          }
          break;
        }
        case 'hr': out.push('\\noindent\\rule{\\linewidth}{0.4pt}\n'); break;
        case 'img': out.push(`\\begin{figure}[H]\n\\centering\n\\includegraphics[width=0.85\\linewidth]{${c.getAttribute('src') || ''}}\n\\end{figure}\n`); break;
        case 'div': case 'section': case 'article': case 'main':
          walk(c, depth); break;
        case 'script': case 'style': break;
        default: {
          const txt = inline(c).trim();
          if (txt) out.push(txt + '\n');
        }
      }
    });
  }

  function capture(fn) {
    const save = out.length;
    fn();
    return out.splice(save).join('');
  }
  function indentLatex(s, pad) {
    return s.split('\n').map((l) => l ? pad + l : l).join('\n');
  }
  function stripInlineLatex(s) {
    return s.replace(/\\textbf\{|\\textit\{|\\sout\{|\\texttt\{/g, '').replace(/\}/g, '');
  }
  function wrapSingle(node) {
    const d = document.createElement('div');
    d.appendChild(node.cloneNode(true));
    return d;
  }

  walk(root, 0);
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function latexPreamble(opts = {}) {
  const docClass = opts.docClass || 'article';
  const fontSize = opts.fontSize || '11pt';
  const pkgs = [
    '[utf8]{inputenc}', 'T1]{fontenc}', 'lmodern', 'geometry]{geometry}',
    'graphicx', 'xcolor', 'hyperref', 'array', 'longtable', 'booktabs',
    'float', 'ulem', 'listings', 'amsmath', 'amssymb'
  ];
  const pkgLines = [
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage[T1]{fontenc}',
    '\\usepackage{lmodern}',
    '\\usepackage[margin=2.5cm]{geometry}',
    '\\usepackage{graphicx}',
    '\\usepackage{xcolor}',
    '\\usepackage[hidelinks]{hyperref}',
    '\\usepackage{array}',
    '\\usepackage{longtable}',
    '\\usepackage{booktabs}',
    '\\usepackage{float}',
    '\\usepackage[normalem]{ulem}',
    '\\usepackage{listings}',
    '\\usepackage{amsmath,amssymb}',
    '\\lstset{basicstyle=\\ttfamily\\small,breaklines=true,frame=single,numbers=none,showstringspaces=false}'
  ];
  return `\\documentclass[${fontSize}]{${docClass}}
${pkgLines.join('\n')}
${opts.title ? `\\title{${escapeLatex(opts.title)}}` : ''}
${opts.author ? `\\author{${escapeLatex(opts.author)}}` : ''}
\\date{${opts.date || '\\today'}}
\\begin{document}
${opts.title ? '\\maketitle\n' : ''}`;
}

function latexPostamble() {
  return '\n\\end{document}\n';
}

/* ------------------------------------------------------------------ *
 *  Markdown → reStructuredText
 * ------------------------------------------------------------------ */

const RST_UNDERLINE = ['=', '-', '~', '^', '"', "'"];

function htmlToRst(root) {
  const out = [];

  function inline(node) {
    let s = '';
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) { s += c.nodeValue.replace(/\s+/g, ' '); return; }
      if (c.nodeType !== 1) return;
      const tag = c.tagName.toLowerCase();
      switch (tag) {
        case 'br': s += '\n'; break;
        case 'strong': case 'b': s += `**${inline(c).trim()}**`; break;
        case 'em': case 'i': s += `*${inline(c).trim()}*`; break;
        case 'del': case 's': s += `[删除线:${inline(c).trim()}]`; break;
        case 'code': {
          const t = textOf(c).replace(/\s+/g, ' ').trim();
          s += t.includes('`') ? `\`\`${t}\`\`` : `\`${t}\``;
          break;
        }
        case 'a': {
          const href = c.getAttribute('href') || '';
          const txt = inline(c).trim();
          s += href ? `\`${txt} <${href}>\`_` : txt;
          break;
        }
        case 'img': {
          const alt = c.getAttribute('alt') || 'image';
          s += `\n\n.. image:: ${c.getAttribute('src') || ''}\n   :alt: ${alt}\n\n`;
          break;
        }
        case 'input': break;
        default: s += inline(c);
      }
    });
    return s;
  }

  function walk(node, depth) {
    const ind = '    '.repeat(depth);
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) return;
      if (c.nodeType !== 1) return;
      const tag = c.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        const lv = Math.min(6, Number(tag[1]));
        const txt = inline(c).replace(/\s+/g, ' ').trim();
        if (!txt) return;
        const ch = RST_UNDERLINE[lv - 1];
        out.push('', txt, ch.repeat(Math.max(4, Math.min(80, txt.length * (ch === '=' ? 1 : 1)))), '');
        return;
      }
      switch (tag) {
        case 'p': {
          const txt = inline(c).replace(/[ \t]+/g, ' ').trim();
          if (txt) out.push(ind + txt, '');
          break;
        }
        case 'ul': case 'ol': {
          let n = 1;
          c.querySelectorAll(':scope > li').forEach((li) => {
            const sub = li.querySelectorAll(':scope > ul, :scope > ol');
            const clone = li.cloneNode(true);
            clone.querySelectorAll(':scope > ul, :scope > ol').forEach((x) => x.remove());
            const txt = inline(clone).replace(/\s+/g, ' ').trim();
            const marker = tag === 'ol' ? `${n++}. ` : '- ';
            out.push(ind + marker + txt);
            sub.forEach((s) => walk(wrap(s), depth + 1));
          });
          out.push('');
          break;
        }
        case 'blockquote': {
          const tmp = document.createElement('div');
          Array.from(c.childNodes).forEach((n) => tmp.appendChild(n.cloneNode(true)));
          const sub = capture(() => walk(tmp, 0));
          sub.trim().split('\n').forEach((l) => out.push('   ' + l));
          out.push('');
          break;
        }
        case 'pre': {
          const codeEl = c.querySelector('code');
          const cls = codeEl ? (codeEl.className || '') : '';
          const lm = /language-([\w+-]+)/.exec(cls);
          out.push(`.. code-block:: ${lm ? lm[1] : 'text'}`, '');
          textOf(c).replace(/\n$/, '').split('\n').forEach((l) => out.push('   ' + l));
          out.push('');
          break;
        }
        case 'table': {
          const t = extractTables(wrapSingle(c))[0];
          if (t) {
            const cols = Math.max(...t.rows.map((r) => r.length));
            const widths = Array.from({ length: cols }, (_, i) =>
              Math.max(3, ...t.rows.map((r) => (r[i] || '').length)));
            const sep = '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
            out.push(sep);
            t.rows.forEach((r, ri) => {
              const line = '|' + widths.map((w, i) => ' ' + (r[i] || '').padEnd(w) + ' ').join('|') + '|';
              out.push(line);
              out.push(sep.replace(/-/g, ri === 0 ? '=' : '-'));
            });
            out.push('');
          }
          break;
        }
        case 'hr': out.push('', '----', ''); break;
        case 'div': case 'section': case 'article': case 'main': walk(c, depth); break;
        case 'script': case 'style': break;
        default: {
          const txt = inline(c).replace(/\s+/g, ' ').trim();
          if (txt) out.push(ind + txt, '');
        }
      }
    });
  }

  function wrap(node) {
    const d = document.createElement('div');
    d.appendChild(node.cloneNode(true));
    return d;
  }
  function wrapSingle(node) {
    const d = document.createElement('div');
    d.appendChild(node.cloneNode(true));
    return d;
  }
  function capture(fn) {
    const save = out.length;
    fn();
    return out.splice(save).join('\n');
  }

  walk(root, 0);
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/* ------------------------------------------------------------------ *
 *  Markdown → Confluence Wiki Markup
 * ------------------------------------------------------------------ */

function htmlToConfluence(root, opts = {}) {
  const out = [];

  function inline(node) {
    let s = '';
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) { s += c.nodeValue.replace(/\s+/g, ' '); return; }
      if (c.nodeType !== 1) return;
      const tag = c.tagName.toLowerCase();
      switch (tag) {
        case 'br': s += '\\\\\n'; break;
        case 'strong': case 'b': s += `*${inline(c).trim()}*`; break;
        case 'em': case 'i': s += `_${inline(c).trim()}_`; break;
        case 'del': case 's': s += `-${inline(c).trim()}-`; break;
        case 'code': s += `{{${textOf(c).replace(/\s+/g, ' ').trim()}}}`; break;
        case 'a': {
          const href = c.getAttribute('href') || '';
          const txt = inline(c).trim();
          s += href ? `[${txt}|${href}]` : txt;
          break;
        }
        case 'img': {
          const src = c.getAttribute('src') || '';
          s += `!${src}!`;
          break;
        }
        case 'input': break;
        default: s += inline(c);
      }
    });
    return s;
  }

  function walk(node, depth) {
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) return;
      if (c.nodeType !== 1) return;
      const tag = c.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        const lv = Number(tag[1]);
        const txt = inline(c).replace(/\s+/g, ' ').trim();
        if (txt) out.push(`h${lv}. ${txt}`, '');
        return;
      }
      switch (tag) {
        case 'p': {
          const txt = inline(c).replace(/[ \t]+/g, ' ').trim();
          if (txt) out.push(txt, '');
          break;
        }
        case 'ul': case 'ol': {
          let n = 1;
          c.querySelectorAll(':scope > li').forEach((li) => {
            const sub = li.querySelectorAll(':scope > ul, :scope > ol');
            const clone = li.cloneNode(true);
            clone.querySelectorAll(':scope > ul, :scope > ol').forEach((x) => x.remove());
            const txt = inline(clone).replace(/\s+/g, ' ').trim();
            const marker = tag === 'ol' ? `${n++}. ` : '* ';
            out.push(marker + txt);
            sub.forEach((s) => {
              const d = document.createElement('div');
              d.appendChild(s.cloneNode(true));
              walk(d, depth + 1);
            });
          });
          out.push('');
          break;
        }
        case 'blockquote': {
          const d = document.createElement('div');
          Array.from(c.childNodes).forEach((n) => d.appendChild(n.cloneNode(true)));
          const chunk = capture(() => walk(d, depth));
          chunk.trim().split('\n').forEach((l) => out.push('{quote}', l));
          out.push('{quote}', '');
          break;
        }
        case 'pre': {
          const codeEl = c.querySelector('code');
          const cls = codeEl ? (codeEl.className || '') : '';
          const lm = /language-([\w+-]+)/.exec(cls);
          if (opts.cnfCode === false) {
            out.push('{noformat}');
            out.push(textOf(c).replace(/\n$/, ''));
            out.push('{noformat}', '');
          } else {
            out.push(`{code${lm ? `:language=${lm[1]}` : ''}}`);
            out.push(textOf(c).replace(/\n$/, ''));
            out.push('{code}', '');
          }
          break;
        }
        case 'table': {
          const t = extractTables(wrapSingle(c))[0];
          if (t) {
            const rows = t.rows;
            if (rows.length) {
              if (opts.cnfTable === false) {
                rows.forEach((r) => out.push('|' + r.map((x) => x || ' ').join('|') + '|'));
              } else {
                out.push('||' + rows[0].map((x) => x || ' ').join('||') + '||');
                rows.slice(1).forEach((r) => out.push('|' + r.map((x) => x || ' ').join('|') + '|'));
              }
              out.push('');
            }
          }
          break;
        }
        case 'hr': out.push('----', ''); break;
        case 'div': case 'section': case 'article': case 'main': walk(c, depth); break;
        case 'script': case 'style': break;
        default: {
          const txt = inline(c).replace(/\s+/g, ' ').trim();
          if (txt) out.push(txt, '');
        }
      }
    });
  }

  function wrapSingle(node) {
    const d = document.createElement('div');
    d.appendChild(node.cloneNode(true));
    return d;
  }
  function capture(fn) {
    const save = out.length;
    fn();
    return out.splice(save).join('\n');
  }

  walk(root, 0);
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

module.exports = {
  md, renderMarkdown, buildToc, mdToDom, domFromHtml, extractTables, textOf,
  htmlToPlainText, htmlToLatex, htmlToRst, htmlToConfluence,
  latexPreamble, latexPostamble, escapeLatex, slugify, escapeHtml
};
