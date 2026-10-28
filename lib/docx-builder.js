'use strict';

/**
 * 主进程侧的 .docx 生成器。
 * 不依赖 DOM：直接从 markdown-it 的 token 流构建 docx。
 */

const MarkdownIt = require('markdown-it');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun,
  ExternalHyperlink, Footer, PageNumber, TableOfContents,
  ShadingType, convertMillimetersToTwip
} = require('docx');

const md = new MarkdownIt({ html: true, linkify: true });

const FONT_FACE = {
  cjkSans: { ascii: 'Segoe UI', eastAsia: 'Microsoft YaHei', hAnsi: 'Segoe UI' },
  yahei: { ascii: 'Microsoft YaHei', eastAsia: 'Microsoft YaHei', hAnsi: 'Microsoft YaHei' },
  sans: { ascii: 'Segoe UI', eastAsia: 'Microsoft YaHei', hAnsi: 'Segoe UI' },
  inter: { ascii: 'Inter', eastAsia: 'Microsoft YaHei', hAnsi: 'Inter' },
  cjkSerif: { ascii: 'Georgia', eastAsia: 'SimSun', hAnsi: 'Georgia' },
  serif: { ascii: 'Georgia', eastAsia: 'SimSun', hAnsi: 'Georgia' },
  playfair: { ascii: 'Georgia', eastAsia: 'SimSun', hAnsi: 'Georgia' },
  mono: { ascii: 'Consolas', eastAsia: 'Microsoft YaHei', hAnsi: 'Consolas' }
};

const PAGE_SIZES = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 }
};

const hex = (c) => String(c || '#000000').replace('#', '').toUpperCase();

/* ---------------- 图片尺寸嗅探 ---------------- */

function imageSize(buf) {
  try {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: 'png' };
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let o = 2;
      while (o < buf.length - 9) {
        if (buf[o] !== 0xff) { o++; continue; }
        const marker = buf[o + 1];
        const len = buf.readUInt16BE(o + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { w: buf.readUInt16BE(o + 7), h: buf.readUInt16BE(o + 5), type: 'jpg' };
        }
        o += 2 + len;
      }
    }
    if (buf.slice(0, 3).toString() === 'GIF') {
      return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8), type: 'gif' };
    }
    if (buf.slice(8, 12).toString() === 'WEBP') {
      return { w: 600, h: 400, type: 'webp' };
    }
  } catch (_) {}
  return { w: 600, h: 400, type: 'png' };
}

async function fetchImage(src) {
  try {
    if (/^data:/i.test(src)) {
      const m = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(src);
      if (!m) return null;
      const mime = m[1] || 'image/png';
      const data = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
      const s = imageSize(data);
      return { data, width: s.w, height: s.h, type: s.type };
    }
    if (/^https?:/i.test(src)) {
      const r = await fetch(src, { redirect: 'follow' });
      if (!r.ok) return null;
      const ab = Buffer.from(await r.arrayBuffer());
      const s = imageSize(ab);
      return { data: ab, width: s.w, height: s.h, type: s.type };
    }
    if (src.startsWith('file://')) {
      const fs = require('fs');
      const { fileURLToPath } = require('url');
      const p = fileURLToPath(src);
      const ab = fs.readFileSync(p);
      const s = imageSize(ab);
      return { data: ab, width: s.w, height: s.h, type: s.type };
    }
  } catch (_) {}
  return null;
}

/* ---------------- 构建 ---------------- */

async function buildDocx(src, opts = {}) {
  const theme = opts.theme || {};
  const c = theme.colors || {};
  const s = theme.sizes || { h1: 24, h2: 19, h3: 15.5, body: 11, code: 9.5 };
  const sp = theme.spacing || { lineHeight: 1.7, headingBefore: 18, paraAfter: 10 };
  const hf = FONT_FACE[(theme.fonts || {}).heading] || FONT_FACE.cjkSans;
  const bf = FONT_FACE[(theme.fonts || {}).body] || FONT_FACE.cjkSans;
  const cf = FONT_FACE.mono;

  const bodySize = Math.round(s.body * 2);
  const lineTwips = Math.round(sp.lineHeight * 240);

  const tokens = md.parse(src || '', {});

  // 先抓所有图片，避免构建过程中断
  const imageMap = new Map();
  for (const t of tokens) {
    if (t.type === 'image') imageMap.set(t.attrGet('src'), null);
    if (t.type === 'inline' && t.children) {
      t.children.forEach((ch) => {
        if (ch.type === 'image') imageMap.set(ch.attrGet('src'), null);
      });
    }
  }
  await Promise.all([...imageMap.keys()].filter(Boolean).map(async (u) => {
    imageMap.set(u, await fetchImage(u));
  }));

  const children = [];
  let olInstance = 0;

  const quoteStyle = {
    border: { left: { color: hex(c.quoteBorder), size: 12, space: 8, style: BorderStyle.SINGLE } },
    indent: { left: 260 }
  };

  function inlineRuns(childrenTokens, base = {}, ctx = {}) {
    const runs = [];
    const stack = [{ bold: !!base.bold, italic: !!base.italic, strike: false, link: null }];
    const top = () => stack[stack.length - 1];

    const pushText = (text) => {
      if (!text) return;
      const st = top();
      const runOpts = {
        text,
        font: st.code ? cf : (base.font || bf),
        size: st.code ? Math.round(s.code * 2) : (base.size || bodySize),
        bold: st.bold || undefined,
        italics: st.italic || undefined,
        strike: st.strike || undefined,
        color: st.color || base.color
      };
      if (st.code) {
        runOpts.shading = { type: ShadingType.CLEAR, fill: hex(c.codeBg), color: 'auto' };
      }
      runs.push(new TextRun(runOpts));
    };

    for (let i = 0; i < childrenTokens.length; i++) {
      const t = childrenTokens[i];
      switch (t.type) {
        case 'text': pushText(t.content); break;
        case 'code_inline': {
          const st = top();
          runs.push(new TextRun({
            text: t.content,
            font: cf,
            size: Math.round(s.code * 2),
            color: hex(c.codeText),
            shading: { type: ShadingType.CLEAR, fill: hex(c.codeBg), color: 'auto' }
          }));
          break;
        }
        case 'strong_open': stack.push({ ...top(), bold: true, color: hex(c.heading) }); break;
        case 'em_open': stack.push({ ...top(), italic: true }); break;
        case 's_open': stack.push({ ...top(), strike: true }); break;
        case 'strong_close': case 'em_close': case 's_close': stack.pop(); break;
        case 'link_open': stack.push({ ...top(), color: hex(c.link) }); break;
        case 'link_close': {
          const st = stack.pop();
          break;
        }
        case 'softbreak': pushText(' '); break;
        case 'hardbreak': runs.push(new TextRun({ break: 1 })); break;
        case 'image': {
          const src2 = t.attrGet('src');
          const img = imageMap.get(src2);
          if (img) {
            const maxW = 560;
            const ratio = img.height / img.width || 0.66;
            const w = Math.min(maxW, img.width);
            runs.push(new ImageRun({
              data: img.data,
              type: img.type,
              transformation: { width: Math.round(w), height: Math.round(w * ratio) }
            }));
          } else {
            runs.push(new TextRun({ text: `[${t.content || 'image'}]`, italics: true }));
          }
          break;
        }
        case 'html_inline': {
          const raw = t.content || '';
          const m = /<img[^>]*src=["']([^"']+)["']/i.exec(raw);
          if (m) {
            const img = imageMap.get(m[1]);
            if (img) {
              const ratio = img.height / img.width || 0.66;
              const w = Math.min(560, img.width);
              runs.push(new ImageRun({
                data: img.data, type: img.type,
                transformation: { width: Math.round(w), height: Math.round(w * ratio) }
              }));
              break;
            }
          }
          const txt = raw.replace(/<[^>]+>/g, '');
          if (txt) pushText(txt);
          break;
        }
        default:
          if (t.content) pushText(t.content);
      }
    }
    return runs;
  }

  function para(runs, extra = {}) {
    if (!runs || !runs.length) return null;
    return new Paragraph({
      children: runs,
      spacing: { after: Math.round(sp.paraAfter * 20), line: lineTwips, ...(extra.spacing || {}) },
      ...extra
    });
  }

  const headingLevels = {
    1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4, 5: HeadingLevel.HEADING_5, 6: HeadingLevel.HEADING_6
  };
  const headingSizes = {
    1: Math.round(s.h1 * 2), 2: Math.round(s.h2 * 2), 3: Math.round(s.h3 * 2),
    4: Math.round(s.body * 1.14 * 2), 5: Math.round(s.body * 1.05 * 2), 6: Math.round(s.body * 2)
  };

  // 状态机
  const listStack = [];   // {ordered, instance, depth}
  let inQuote = false;
  let pendingTable = null;
  let currentRow = null;
  let currentCell = null;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    switch (t.type) {
      case 'heading_open': {
        const lv = Number(t.tag.slice(1));
        const inline = tokens[i + 1];
        const runs = inlineRuns(inline.children || [], {
          bold: true, font: hf, size: headingSizes[lv], color: hex(c.heading)
        });
        children.push(new Paragraph({
          children: runs,
          heading: headingLevels[lv],
          spacing: {
            before: Math.round(sp.headingBefore * 24),
            after: Math.round(sp.paraAfter * 18),
            line: lineTwips
          },
          border: lv === 2 ? { bottom: { color: hex(c.tableBorder), size: 6, space: 2, style: BorderStyle.SINGLE } } : undefined
        }));
        i++; // skip inline
        break;
      }

      case 'paragraph_open': {
        const inline = tokens[i + 1];
        const runs = inlineRuns(inline.children || [], {
          font: bf, size: bodySize, color: hex(c.text)
        });

        const prevTok = tokens[i - 1];
        const inListItem = prevTok && prevTok.type === 'list_item_open' && listStack.length;
        const li = inListItem ? listStack[listStack.length - 1] : null;

        const extra = {};
        if (li) {
          extra.numbering = li.ordered
            ? { reference: 'md-ol', level: Math.min(4, li.depth), instance: li.instance }
            : { reference: 'md-ul', level: Math.min(4, li.depth) };
          extra.spacing = { after: Math.round(sp.paraAfter * 8), line: lineTwips };
        }
        if (inQuote) Object.assign(extra, quoteStyle);

        const p = para(runs, extra);
        if (p) children.push(p);
        i++;
        break;
      }

      case 'fence': {
        const lines = String(t.content || '').replace(/\n$/, '').split('\n');
        lines.forEach((line) => {
          children.push(new Paragraph({
            children: [new TextRun({
              text: line || ' ',
              font: cf,
              size: Math.round(s.code * 2),
              color: hex(c.codeText)
            })],
            shading: { type: ShadingType.CLEAR, fill: hex(c.codeBg), color: 'auto' },
            spacing: { before: 0, after: 0, line: 240 },
            indent: { left: 180, right: 120 }
          }));
        });
        children.push(new Paragraph({ children: [], spacing: { after: Math.round(sp.paraAfter * 12) } }));
        break;
      }

      case 'code_block': {
        String(t.content || '').split('\n').forEach((line) => {
          children.push(new Paragraph({
            children: [new TextRun({ text: line || ' ', font: cf, size: Math.round(s.code * 2), color: hex(c.codeText) })],
            shading: { type: ShadingType.CLEAR, fill: hex(c.codeBg), color: 'auto' },
            spacing: { before: 0, after: 0, line: 240 }
          }));
        });
        break;
      }

      case 'bullet_list_open':
        listStack.push({ ordered: false, depth: listStack.length, instance: 0 });
        break;
      case 'ordered_list_open':
        olInstance++;
        listStack.push({ ordered: true, depth: listStack.length, instance: olInstance });
        break;
      case 'bullet_list_close': case 'ordered_list_close':
        listStack.pop();
        break;

      case 'list_item_open': {
        // 找到本项内联内容（可能有多段）
        break;
      }

      case 'blockquote_open': inQuote = true; break;
      case 'blockquote_close': inQuote = false; break;

      case 'table_open': pendingTable = []; break;
      case 'tr_open': currentRow = []; break;
      case 'th_open': case 'td_open': {
        const isHead = t.type === 'th_open';
        const inline = tokens[i + 1];
        currentCell = { isHead, runs: inlineRuns((inline && inline.children) || [], { font: bf, size: bodySize, color: hex(c.text) }) };
        i++;
        break;
      }
      case 'th_close': case 'td_close': {
        if (currentRow && currentCell) currentRow.push(currentCell);
        currentCell = null;
        break;
      }
      case 'tr_close': {
        if (pendingTable && currentRow) pendingTable.push(currentRow);
        currentRow = null;
        break;
      }
      case 'table_close': {
        if (pendingTable && pendingTable.length) {
          const rows = pendingTable.map((row) => new TableRow({
            tableHeader: row.some((cell) => cell.isHead),
            children: row.map((cell) => new TableCell({
              children: [new Paragraph({
                children: cell.runs,
                spacing: { after: 40, line: 240 }
              })],
              shading: cell.isHead
                ? { type: ShadingType.CLEAR, fill: hex(c.tableHeader), color: 'auto' }
                : undefined,
              margins: { top: 60, bottom: 60, left: 100, right: 100 }
            }))
          }));
          children.push(new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: hex(c.tableBorder) },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: hex(c.tableBorder) },
              left: { style: BorderStyle.SINGLE, size: 4, color: hex(c.tableBorder) },
              right: { style: BorderStyle.SINGLE, size: 4, color: hex(c.tableBorder) },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: hex(c.tableBorder) },
              insideVertical: { style: BorderStyle.SINGLE, size: 4, color: hex(c.tableBorder) }
            }
          }));
          children.push(new Paragraph({ children: [], spacing: { after: 140 } }));
        }
        pendingTable = null;
        break;
      }

      case 'hr':
        children.push(new Paragraph({
          children: [],
          border: { bottom: { color: hex(c.tableBorder), size: 6, space: 1, style: BorderStyle.SINGLE } },
          spacing: { before: 120, after: 200 }
        }));
        break;

      case 'html_block': {
        const raw = t.content || '';
        const imgM = /<img[^>]*src=["']([^"']+)["']/i.exec(raw);
        if (imgM && imageMap.get(imgM[1])) {
          const img = imageMap.get(imgM[1]);
          const ratio = img.height / img.width || 0.66;
          const w = Math.min(560, img.width);
          children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 160 },
            children: [new ImageRun({
              data: img.data, type: img.type,
              transformation: { width: Math.round(w), height: Math.round(w * ratio) }
            })]
          }));
        } else {
          const txt = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (txt) {
            children.push(new Paragraph({
              children: [new TextRun({ text: txt, font: bf, size: bodySize, color: hex(c.text) })],
              spacing: { after: Math.round(sp.paraAfter * 20), line: lineTwips }
            }));
          }
        }
        break;
      }
    }
  }

  if (opts.toc) {
    children.unshift(new TableOfContents('目录', { hyperlink: true, headingStyleRange: '1-3' }));
    children.splice(1, 0, new Paragraph({ children: [], pageBreakBefore: true }));
  }

  const size = PAGE_SIZES[opts.pageSize] || PAGE_SIZES.A4;
  const portrait = !opts.landscape;
  const m = opts.margins || { top: 22, bottom: 22, left: 20, right: 20 };

  const doc = new Document({
    creator: 'MD-To Desktop',
    title: opts.title || 'Document',
    description: '由 MD-To Desktop 生成',
    styles: {
      default: {
        document: {
          run: { font: bf, size: bodySize, color: hex(c.text) },
          paragraph: { spacing: { line: lineTwips, after: Math.round(sp.paraAfter * 20) } }
        },
        heading1: { run: { font: hf, size: Math.round(s.h1 * 2), bold: true, color: hex(c.heading) } },
        heading2: { run: { font: hf, size: Math.round(s.h2 * 2), bold: true, color: hex(c.heading) } },
        heading3: { run: { font: hf, size: Math.round(s.h3 * 2), bold: true, color: hex(c.heading) } }
      }
    },
    numbering: {
      config: [
        {
          reference: 'md-ol',
          levels: [0, 1, 2, 3, 4].map((l) => ({
            level: l,
            format: 'decimal',
            text: `%${l + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 + l * 360, hanging: 360 } } }
          }))
        },
        {
          reference: 'md-ul',
          levels: [0, 1, 2, 3, 4].map((l) => ({
            level: l,
            format: 'bullet',
            text: '•',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720 + l * 360, hanging: 360 } } }
          }))
        }
      ]
    },
    sections: [{
      properties: {
        page: {
          size: {
            width: convertMillimetersToTwip(portrait ? size.width : size.height),
            height: convertMillimetersToTwip(portrait ? size.height : size.width)
          },
          margin: {
            top: convertMillimetersToTwip(m.top),
            bottom: convertMillimetersToTwip(m.bottom),
            left: convertMillimetersToTwip(m.left),
            right: convertMillimetersToTwip(m.right)
          }
        }
      },
      footers: opts.pageNumbers ? {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({
              children: ['第 ', PageNumber.CURRENT, ' 页 / 共 ', PageNumber.TOTAL_PAGES, ' 页'],
              font: bf, size: 18, color: '888888'
            })]
          })]
        })
      } : undefined,
      children
    }]
  });

  const buf = await Packer.toBuffer(doc);
  return buf.toString('base64');
}

module.exports = { buildDocx };
