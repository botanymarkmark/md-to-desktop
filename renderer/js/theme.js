'use strict';

/* ------------------------------------------------------------------ *
 *  模板 / 主题系统
 *  22 套内置文档模板 + 可自定义颜色、字体、字号、间距、密度
 * ------------------------------------------------------------------ */

const FONT_STACKS = {
  sans: "'Segoe UI','Microsoft YaHei','PingFang SC','Hiragino Sans GB','Source Han Sans SC',Arial,sans-serif",
  cjkSans: "'Noto Sans SC','Source Han Sans SC','Microsoft YaHei','PingFang SC','Segoe UI',sans-serif",
  yahei: "'Microsoft YaHei','PingFang SC','Hiragino Sans GB',sans-serif",
  serif: "Georgia,'Times New Roman','Songti SC','Noto Serif SC',SimSun,serif",
  cjkSerif: "'Noto Serif SC','Source Han Serif SC','Songti SC',SimSun,Georgia,serif",
  inter: "Inter,'Segoe UI','Microsoft YaHei',Arial,sans-serif",
  playfair: "'Playfair Display',Georgia,'Songti SC','Noto Serif SC',serif",
  mono: "'Cascadia Code','JetBrains Mono',Consolas,'SF Mono','Fira Code','Courier New',monospace"
};

const FONT_OPTIONS = [
  { id: 'cjkSans', label: '思源黑体 / 无衬线' },
  { id: 'yahei', label: '微软雅黑' },
  { id: 'sans', label: 'Segoe UI' },
  { id: 'inter', label: 'Inter' },
  { id: 'cjkSerif', label: '思源宋体 / 衬线' },
  { id: 'serif', label: 'Georgia / 宋体' },
  { id: 'playfair', label: 'Playfair Display' },
  { id: 'mono', label: '等宽字体' }
];

/* 每套模板：colors / fonts / sizes / spacing */
const PRESETS = [
  {
    id: 'classic', name: 'Classic', group: 'Business', desc: '报告与提案的稳妥选择',
    colors: {
      bg: '#ffffff', heading: '#111827', text: '#24292f', link: '#1a5fb4',
      quoteBorder: '#d0d7de', quoteText: '#57606a',
      codeBg: '#f6f8fa', codeText: '#24292f', codeBorder: '#e1e4e8',
      tableHeader: '#f2f4f7', tableHeaderText: '#111827', rowOdd: '#ffffff', rowEven: '#fafbfc',
      tableBorder: '#d8dee4', accent: '#1a5fb4'
    },
    fonts: { heading: 'cjkSans', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 24, h2: 19, h3: 15.5, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.72, headingBefore: 18, paraAfter: 10 }
  },
  {
    id: 'modern', name: 'Modern', group: 'Tech', desc: '面向开发者的干净排版',
    colors: {
      bg: '#ffffff', heading: '#0f172a', text: '#334155', link: '#2563eb',
      quoteBorder: '#93c5fd', quoteText: '#475569',
      codeBg: '#0f172a', codeText: '#e2e8f0', codeBorder: '#1e293b',
      tableHeader: '#eff6ff', tableHeaderText: '#0f172a', rowOdd: '#ffffff', rowEven: '#f8fbff',
      tableBorder: '#e2e8f0', accent: '#2563eb'
    },
    fonts: { heading: 'inter', body: 'inter', code: 'mono' },
    sizes: { h1: 25, h2: 19.5, h3: 15.5, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.7, headingBefore: 20, paraAfter: 10 }
  },
  {
    id: 'minimal', name: 'Minimal', group: 'Minimal', desc: '极简，只留内容',
    colors: {
      bg: '#ffffff', heading: '#111111', text: '#333333', link: '#111111',
      quoteBorder: '#e5e5e5', quoteText: '#666666',
      codeBg: '#f5f5f5', codeText: '#222222', codeBorder: '#ebebeb',
      tableHeader: '#ffffff', tableHeaderText: '#111111', rowOdd: '#ffffff', rowEven: '#fcfcfc',
      tableBorder: '#e8e8e8', accent: '#111111'
    },
    fonts: { heading: 'cjkSans', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 23, h2: 18, h3: 15, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.78, headingBefore: 22, paraAfter: 11 }
  },
  {
    id: 'ocean-blue', name: 'Ocean Blue', group: 'Business', desc: '深蓝标题 + 冷色正文',
    colors: {
      bg: '#ffffff', heading: '#0b3a66', text: '#2c3e50', link: '#0b72b9',
      quoteBorder: '#9cc9e8', quoteText: '#44637d',
      codeBg: '#f0f6fb', codeText: '#123a5c', codeBorder: '#d8e7f3',
      tableHeader: '#0b3a66', tableHeaderText: '#ffffff', rowOdd: '#ffffff', rowEven: '#f5f9fd',
      tableBorder: '#cfe0ee', accent: '#0b72b9'
    },
    fonts: { heading: 'cjkSans', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 24, h2: 19, h3: 15.5, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.74, headingBefore: 19, paraAfter: 10 }
  },
  {
    id: 'corporate-gray', name: 'Corporate Gray', group: 'Business', desc: '中性灰，适合内部文档',
    colors: {
      bg: '#ffffff', heading: '#374151', text: '#4b5563', link: '#4f46e5',
      quoteBorder: '#d1d5db', quoteText: '#6b7280',
      codeBg: '#f3f4f6', codeText: '#374151', codeBorder: '#e5e7eb',
      tableHeader: '#374151', tableHeaderText: '#ffffff', rowOdd: '#ffffff', rowEven: '#f9fafb',
      tableBorder: '#e5e7eb', accent: '#4f46e5'
    },
    fonts: { heading: 'cjkSans', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 23.5, h2: 18.5, h3: 15, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.72, headingBefore: 18, paraAfter: 10 }
  },
  {
    id: 'navy-gold', name: 'Navy Gold', group: 'Business', desc: '藏青配金，正式场合',
    colors: {
      bg: '#ffffff', heading: '#12284c', text: '#333c4a', link: '#a67c00',
      quoteBorder: '#d9c07a', quoteText: '#5c5238',
      codeBg: '#fbf7ec', codeText: '#3a3220', codeBorder: '#efe3c2',
      tableHeader: '#12284c', tableHeaderText: '#f3e3b3', rowOdd: '#ffffff', rowEven: '#fbf9f2',
      tableBorder: '#e6ddc4', accent: '#a67c00'
    },
    fonts: { heading: 'cjkSerif', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 24, h2: 19, h3: 15.5, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.76, headingBefore: 20, paraAfter: 10 }
  },
  {
    id: 'warm-gray', name: 'Warm Gray', group: 'Minimal', desc: '暖灰底，久读不累',
    colors: {
      bg: '#fbfaf8', heading: '#3f3a36', text: '#4a4441', link: '#8a6d3b',
      quoteBorder: '#ddd5cc', quoteText: '#6b625b',
      codeBg: '#f2efea', codeText: '#3f3a36', codeBorder: '#e6e0d8',
      tableHeader: '#efeae3', tableHeaderText: '#3f3a36', rowOdd: '#fbfaf8', rowEven: '#f6f3ee',
      tableBorder: '#e4ddd4', accent: '#8a6d3b'
    },
    fonts: { heading: 'cjkSerif', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 23.5, h2: 18.5, h3: 15, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.78, headingBefore: 19, paraAfter: 10.5 }
  },
  {
    id: 'soft-ink', name: 'Soft Ink', group: 'Minimal', desc: '墨色柔和，正式但不生硬',
    colors: {
      bg: '#ffffff', heading: '#1f2933', text: '#3e4c59', link: '#52606d',
      quoteBorder: '#cbd2d9', quoteText: '#616e7c',
      codeBg: '#f5f7fa', codeText: '#323f4b', codeBorder: '#e4e7eb',
      tableHeader: '#f0f4f8', tableHeaderText: '#1f2933', rowOdd: '#ffffff', rowEven: '#f8fafc',
      tableBorder: '#e4e7eb', accent: '#52606d'
    },
    fonts: { heading: 'cjkSans', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 24, h2: 19, h3: 15.5, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.74, headingBefore: 18, paraAfter: 10 }
  },
  {
    id: 'academic-green', name: 'Academic Green', group: 'Academic', desc: '论文与研究文档',
    colors: {
      bg: '#ffffff', heading: '#1f3d2b', text: '#2f3a33', link: '#2f6b4f',
      quoteBorder: '#a7c4b1', quoteText: '#4a5c50',
      codeBg: '#f4f8f5', codeText: '#243b2c', codeBorder: '#dceade',
      tableHeader: '#eef5f0', tableHeaderText: '#1f3d2b', rowOdd: '#ffffff', rowEven: '#f7fbf8',
      tableBorder: '#d7e5da', accent: '#2f6b4f'
    },
    fonts: { heading: 'cjkSerif', body: 'cjkSerif', code: 'mono' },
    sizes: { h1: 22.5, h2: 18, h3: 15, body: 11.5, code: 9.5 },
    spacing: { lineHeight: 1.82, headingBefore: 20, paraAfter: 11 }
  },
  {
    id: 'classic-sepia', name: 'Classic Sepia', group: 'Academic', desc: '旧书纸感',
    colors: {
      bg: '#fdfaf3', heading: '#4a3b2a', text: '#4a3f31', link: '#8b5e34',
      quoteBorder: '#d8c7a8', quoteText: '#6b5844',
      codeBg: '#f4ecdc', codeText: '#4a3b2a', codeBorder: '#e6d8bf',
      tableHeader: '#f0e6d3', tableHeaderText: '#4a3b2a', rowOdd: '#fdfaf3', rowEven: '#f8f2e7',
      tableBorder: '#e3d5bb', accent: '#8b5e34'
    },
    fonts: { heading: 'cjkSerif', body: 'cjkSerif', code: 'mono' },
    sizes: { h1: 22.5, h2: 18, h3: 15, body: 11.5, code: 9.5 },
    spacing: { lineHeight: 1.84, headingBefore: 21, paraAfter: 11 }
  },
  {
    id: 'scholarly-wine', name: 'Scholarly Wine', group: 'Academic', desc: '酒红标题，庄重',
    colors: {
      bg: '#ffffff', heading: '#4a1d2b', text: '#3d3338', link: '#7b2d43',
      quoteBorder: '#c9a3ad', quoteText: '#5c4a51',
      codeBg: '#faf5f6', codeText: '#3d2a30', codeBorder: '#eadde0',
      tableHeader: '#f7eef0', tableHeaderText: '#4a1d2b', rowOdd: '#ffffff', rowEven: '#fcf7f8',
      tableBorder: '#e8d9dd', accent: '#7b2d43'
    },
    fonts: { heading: 'cjkSerif', body: 'cjkSerif', code: 'mono' },
    sizes: { h1: 22.5, h2: 18, h3: 15, body: 11.5, code: 9.5 },
    spacing: { lineHeight: 1.82, headingBefore: 20, paraAfter: 11 }
  },
  {
    id: 'github', name: 'GitHub Style', group: 'Tech', desc: 'README 的熟悉味道',
    colors: {
      bg: '#ffffff', heading: '#1f2328', text: '#1f2328', link: '#0969da',
      quoteBorder: '#d0d7de', quoteText: '#59636e',
      codeBg: '#f6f8fa', codeText: '#1f2328', codeBorder: '#d8dee4',
      tableHeader: '#f6f8fa', tableHeaderText: '#1f2328', rowOdd: '#ffffff', rowEven: '#f6f8fa',
      tableBorder: '#d0d7de', accent: '#0969da'
    },
    fonts: { heading: 'sans', body: 'sans', code: 'mono' },
    sizes: { h1: 24, h2: 19, h3: 15.5, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.68, headingBefore: 20, paraAfter: 10 }
  },
  {
    id: 'vscode-blue', name: 'VS Code Blue', group: 'Tech', desc: '编辑器蓝 + 深色代码块',
    colors: {
      bg: '#ffffff', heading: '#0451a5', text: '#1f1f1f', link: '#0451a5',
      quoteBorder: '#b8d4f0', quoteText: '#4a5568',
      codeBg: '#1e1e1e', codeText: '#d4d4d4', codeBorder: '#1e1e1e',
      tableHeader: '#eaf2fb', tableHeaderText: '#0451a5', rowOdd: '#ffffff', rowEven: '#f6faff',
      tableBorder: '#d6e4f2', accent: '#0451a5'
    },
    fonts: { heading: 'cjkSans', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 24, h2: 19, h3: 15.5, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.7, headingBefore: 19, paraAfter: 10 }
  },
  {
    id: 'terminal-green', name: 'Terminal Green', group: 'Tech', desc: '终端绿，暗色代码',
    colors: {
      bg: '#ffffff', heading: '#0b3d2e', text: '#22312b', link: '#15803d',
      quoteBorder: '#9dd5b4', quoteText: '#3f5b4b',
      codeBg: '#0d1117', codeText: '#7ee787', codeBorder: '#0d1117',
      tableHeader: '#eef7f1', tableHeaderText: '#0b3d2e', rowOdd: '#ffffff', rowEven: '#f5fbf7',
      tableBorder: '#cfe6d7', accent: '#15803d'
    },
    fonts: { heading: 'mono', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 23, h2: 18.5, h3: 15, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.72, headingBefore: 19, paraAfter: 10 }
  },
  {
    id: 'dracula-purple', name: 'Dracula Purple', group: 'Tech', desc: '紫色强调 + Dracula 代码',
    colors: {
      bg: '#ffffff', heading: '#6d28d9', text: '#2c2c3a', link: '#7c3aed',
      quoteBorder: '#c4b5fd', quoteText: '#4c4a63',
      codeBg: '#282a36', codeText: '#f8f8f2', codeBorder: '#282a36',
      tableHeader: '#f3efff', tableHeaderText: '#6d28d9', rowOdd: '#ffffff', rowEven: '#faf8ff',
      tableBorder: '#ddd4f5', accent: '#6d28d9'
    },
    fonts: { heading: 'cjkSans', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 24, h2: 19, h3: 15.5, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.72, headingBefore: 19, paraAfter: 10 }
  },
  {
    id: 'sakura-pink', name: 'Sakura Pink', group: 'Creative', desc: '樱粉，柔和有个性',
    colors: {
      bg: '#fffafb', heading: '#b03a63', text: '#4a3a3f', link: '#d2406f',
      quoteBorder: '#f2c2cf', quoteText: '#6d5259',
      codeBg: '#fdf1f4', codeText: '#7a2b46', codeBorder: '#f7dde4',
      tableHeader: '#fdeef2', tableHeaderText: '#b03a63', rowOdd: '#fffafb', rowEven: '#fdf5f7',
      tableBorder: '#f4dde3', accent: '#d2406f'
    },
    fonts: { heading: 'playfair', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 25, h2: 19.5, h3: 15.5, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.76, headingBefore: 20, paraAfter: 10 }
  },
  {
    id: 'lavender-dream', name: 'Lavender Dream', group: 'Creative', desc: '薰衣草紫，轻盈',
    colors: {
      bg: '#fbfaff', heading: '#5b4b8a', text: '#413d52', link: '#7c6bb0',
      quoteBorder: '#d5cdf0', quoteText: '#5f5878',
      codeBg: '#f3f0fc', codeText: '#413a5c', codeBorder: '#e6e0f7',
      tableHeader: '#f0ecfb', tableHeaderText: '#5b4b8a', rowOdd: '#fbfaff', rowEven: '#f7f5fd',
      tableBorder: '#e4def5', accent: '#7c6bb0'
    },
    fonts: { heading: 'cjkSerif', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 24.5, h2: 19, h3: 15.5, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.78, headingBefore: 20, paraAfter: 10.5 }
  },
  {
    id: 'ocean-teal', name: 'Ocean Teal', group: 'Creative', desc: '青绿，清爽',
    colors: {
      bg: '#ffffff', heading: '#0f766e', text: '#294b47', link: '#0d9488',
      quoteBorder: '#99e0d6', quoteText: '#3f625d',
      codeBg: '#effbf9', codeText: '#0f4d47', codeBorder: '#d3f0eb',
      tableHeader: '#e8f8f5', tableHeaderText: '#0f766e', rowOdd: '#ffffff', rowEven: '#f5fcfa',
      tableBorder: '#cfeae5', accent: '#0d9488'
    },
    fonts: { heading: 'cjkSans', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 24, h2: 19, h3: 15.5, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.74, headingBefore: 20, paraAfter: 10 }
  },
  {
    id: 'sunset-orange', name: 'Sunset Orange', group: 'Creative', desc: '暖橙，表达力强',
    colors: {
      bg: '#fffbf7', heading: '#9a3412', text: '#4a3b32', link: '#ea580c',
      quoteBorder: '#fbc9a8', quoteText: '#6d5445',
      codeBg: '#fdf2e8', codeText: '#7a3410', codeBorder: '#f7e0cd',
      tableHeader: '#fdeee2', tableHeaderText: '#9a3412', rowOdd: '#fffbf7', rowEven: '#fdf6f0',
      tableBorder: '#f4ddc9', accent: '#ea580c'
    },
    fonts: { heading: 'cjkSans', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 25, h2: 19.5, h3: 15.5, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.74, headingBefore: 20, paraAfter: 10 }
  },
  {
    id: 'forest-moss', name: 'Forest Moss', group: 'Creative', desc: '森林苔绿',
    colors: {
      bg: '#fcfdfa', heading: '#29452f', text: '#37453b', link: '#4a7c59',
      quoteBorder: '#b9cfb8', quoteText: '#4f6253',
      codeBg: '#f2f6ef', codeText: '#2b3d31', codeBorder: '#dfe9d9',
      tableHeader: '#eef4ea', tableHeaderText: '#29452f', rowOdd: '#fcfdfa', rowEven: '#f7faf4',
      tableBorder: '#dbe6d5', accent: '#4a7c59'
    },
    fonts: { heading: 'cjkSerif', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 24, h2: 19, h3: 15.5, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.76, headingBefore: 20, paraAfter: 10.5 }
  },
  {
    id: 'pure-mono', name: 'Pure Mono', group: 'Minimal', desc: '全等宽，极客风',
    colors: {
      bg: '#ffffff', heading: '#111111', text: '#222222', link: '#000000',
      quoteBorder: '#dddddd', quoteText: '#555555',
      codeBg: '#f4f4f4', codeText: '#111111', codeBorder: '#e6e6e6',
      tableHeader: '#f2f2f2', tableHeaderText: '#111111', rowOdd: '#ffffff', rowEven: '#fafafa',
      tableBorder: '#e0e0e0', accent: '#111111'
    },
    fonts: { heading: 'mono', body: 'mono', code: 'mono' },
    sizes: { h1: 21, h2: 17, h3: 14, body: 10, code: 9.5 },
    spacing: { lineHeight: 1.66, headingBefore: 18, paraAfter: 9 }
  },
  {
    id: 'midnight', name: 'Midnight', group: 'Dark', desc: '深色页面，适合图片导出',
    dark: true,
    colors: {
      bg: '#0f172a', heading: '#f1f5f9', text: '#cbd5e1', link: '#60a5fa',
      quoteBorder: '#334155', quoteText: '#94a3b8',
      codeBg: '#020617', codeText: '#e2e8f0', codeBorder: '#1e293b',
      tableHeader: '#1e293b', tableHeaderText: '#e2e8f0', rowOdd: '#0f172a', rowEven: '#131f36',
      tableBorder: '#243044', accent: '#60a5fa'
    },
    fonts: { heading: 'cjkSans', body: 'cjkSans', code: 'mono' },
    sizes: { h1: 24, h2: 19, h3: 15.5, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.74, headingBefore: 20, paraAfter: 10 }
  },
  {
    id: 'carbon', name: 'Carbon', group: 'Dark', desc: '碳灰底色，演示友好',
    dark: true,
    colors: {
      bg: '#18181b', heading: '#fafafa', text: '#d4d4d8', link: '#a78bfa',
      quoteBorder: '#3f3f46', quoteText: '#a1a1aa',
      codeBg: '#09090b', codeText: '#e4e4e7', codeBorder: '#27272a',
      tableHeader: '#27272a', tableHeaderText: '#fafafa', rowOdd: '#18181b', rowEven: '#1f1f23',
      tableBorder: '#2e2e33', accent: '#a78bfa'
    },
    fonts: { heading: 'inter', body: 'inter', code: 'mono' },
    sizes: { h1: 24, h2: 19, h3: 15.5, body: 11, code: 9.5 },
    spacing: { lineHeight: 1.74, headingBefore: 20, paraAfter: 10 }
  }
];

const DENSITY = {
  standard: { label: '标准', line: 1.0, pad: 1.0 },
  compact: { label: '紧凑', line: 0.88, pad: 0.7 },
  relaxed: { label: '宽松', line: 1.12, pad: 1.3 }
};

function getPreset(id) {
  return PRESETS.find((p) => p.id === id) || PRESETS[0];
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

/**
 * 合并模板 + 用户覆盖 + 密度，得到最终 theme 对象
 */
function resolveTheme(presetId, overrides, density) {
  const base = clone(getPreset(presetId));
  const d = DENSITY[density] || DENSITY.standard;

  const t = {
    id: base.id,
    name: base.name,
    dark: !!base.dark,
    colors: Object.assign({}, base.colors, (overrides && overrides.colors) || {}),
    fonts: Object.assign({}, base.fonts, (overrides && overrides.fonts) || {}),
    sizes: Object.assign({}, base.sizes, (overrides && overrides.sizes) || {}),
    spacing: Object.assign({}, base.spacing, (overrides && overrides.spacing) || {})
  };

  t.spacing.lineHeight = +(t.spacing.lineHeight * d.line).toFixed(3);
  t.spacing.headingBefore = +(t.spacing.headingBefore * d.pad).toFixed(2);
  t.spacing.paraAfter = +(t.spacing.paraAfter * d.pad).toFixed(2);

  t.fontStacks = {
    heading: FONT_STACKS[t.fonts.heading] || FONT_STACKS.cjkSans,
    body: FONT_STACKS[t.fonts.body] || FONT_STACKS.cjkSans,
    code: FONT_STACKS[t.fonts.code] || FONT_STACKS.mono
  };
  return t;
}

function luminance(hex) {
  const h = String(hex || '#ffffff').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6) || 'ffffff', 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/* 代码高亮配色：根据代码块背景亮度自动切换 */
function codeTokens(dark) {
  if (dark) {
    return {
      comment: '#7d8590', keyword: '#ff7b72', string: '#a5d6ff', number: '#79c0ff',
      func: '#d2a8ff', type: '#ffa657', var: '#ffa657', punct: '#c9d1d9', builtin: '#79c0ff'
    };
  }
  return {
    comment: '#6a737d', keyword: '#d73a49', string: '#032f62', number: '#005cc5',
    func: '#6f42c1', type: '#b31d28', var: '#e36209', punct: '#24292e', builtin: '#005cc5'
  };
}

/**
 * 生成文档 CSS（同时用于预览与导出）
 */
function buildDocCSS(theme, opts = {}) {
  const c = theme.colors;
  const s = theme.sizes;
  const sp = theme.spacing;
  const f = theme.fontStacks;
  const tok = codeTokens(luminance(c.codeBg) < 0.5);
  const pageW = opts.pageWidth || 794;

  return `
:root{
  --bg:${c.bg}; --fg:${c.text}; --heading:${c.heading}; --link:${c.link};
  --quote-border:${c.quoteBorder}; --quote-text:${c.quoteText};
  --code-bg:${c.codeBg}; --code-fg:${c.codeText}; --code-border:${c.codeBorder};
  --th-bg:${c.tableHeader}; --th-fg:${c.tableHeaderText};
  --row-odd:${c.rowOdd}; --row-even:${c.rowEven}; --table-border:${c.tableBorder};
  --accent:${c.accent};
}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:${c.bg};}
body{
  font-family:${f.body};
  font-size:${s.body}pt;
  line-height:${sp.lineHeight};
  color:${c.text};
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
  ${opts.fluid ? '' : `width:${pageW}px;max-width:${pageW}px;`}
  padding:${opts.fluid ? 0 : '0'}px;
}
.doc{padding:0;}
.doc > *:first-child{margin-top:0 !important;}

h1,h2,h3,h4,h5,h6{
  font-family:${f.heading};
  color:${c.heading};
  line-height:1.32;
  margin:${sp.headingBefore}pt 0 ${Math.max(6, sp.paraAfter * 0.8)}pt;
  font-weight:700;
  page-break-after:avoid;
  break-after:avoid;
}
h1{font-size:${s.h1}pt;letter-spacing:-0.01em;}
h2{font-size:${s.h2}pt;padding-bottom:0.22em;border-bottom:1px solid ${c.tableBorder};}
h3{font-size:${s.h3}pt;}
h4{font-size:${(s.body * 1.14).toFixed(2)}pt;}
h5{font-size:${(s.body * 1.05).toFixed(2)}pt;color:${c.quoteText};}
h6{font-size:${(s.body * 0.98).toFixed(2)}pt;color:${c.quoteText};text-transform:uppercase;letter-spacing:.04em;}

p{margin:0 0 ${sp.paraAfter}pt;orphans:3;widows:3;}
a{color:${c.link};text-decoration:none;border-bottom:1px solid ${c.link}55;word-break:break-word;}
a:hover{border-bottom-color:${c.link};}
strong{font-weight:700;color:${c.heading};}
em{font-style:italic;}
del{color:${c.quoteText};}
mark{background:${c.accent}22;color:inherit;padding:0 .12em;border-radius:2px;}
hr{border:0;border-top:1px solid ${c.tableBorder};margin:${sp.headingBefore * 0.9}pt 0;}

ul,ol{margin:0 0 ${sp.paraAfter}pt;padding-left:1.55em;}
li{margin:0 0 ${(sp.paraAfter * 0.35).toFixed(2)}pt;}
li > ul,li > ol{margin-top:${(sp.paraAfter * 0.35).toFixed(2)}pt;margin-bottom:0;}
li::marker{color:${c.accent};}
li.task-list-item{list-style:none;margin-left:-1.2em;}
li.task-list-item input{margin-right:.45em;vertical-align:middle;}

blockquote{
  margin:${sp.paraAfter}pt 0 ${sp.headingBefore * 0.8}pt;
  padding:.55em 0 .55em 1em;
  border-left:3px solid ${c.quoteBorder};
  color:${c.quoteText};
  background:${c.quoteBorder}14;
  border-radius:0 4px 4px 0;
  page-break-inside:avoid;break-inside:avoid;
}
blockquote p:last-child{margin-bottom:0;}

code{
  font-family:${f.code};
  font-size:${s.code}pt;
  background:${c.codeBg};
  color:${c.codeText};
  padding:.15em .38em;
  border-radius:3px;
  border:1px solid ${c.codeBorder};
}
pre{
  background:${c.codeBg};
  color:${c.codeText};
  border:1px solid ${c.codeBorder};
  border-radius:6px;
  padding:${(s.body * 0.95).toFixed(1)}pt ${(s.body * 1.1).toFixed(1)}pt;
  overflow:auto;
  margin:${(sp.paraAfter * 1.1).toFixed(1)}pt 0 ${(sp.headingBefore * 0.85).toFixed(1)}pt;
  page-break-inside:avoid;break-inside:avoid;
  line-height:1.55;
}
pre code{
  background:transparent;border:0;padding:0;color:inherit;font-size:${s.code}pt;white-space:pre;
}

/* 语法高亮 */
.hljs-comment,.hljs-quote{color:${tok.comment};font-style:italic;}
.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-doctag,.hljs-name{color:${tok.keyword};}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta-string{color:${tok.string};}
.hljs-number,.hljs-symbol,.hljs-bullet{color:${tok.number};}
.hljs-title,.hljs-section,.hljs-title.function_,.hljs-function .hljs-title{color:${tok.func};}
.hljs-type,.hljs-class .hljs-title,.hljs-built_in,.hljs-builtin-name{color:${tok.builtin};}
.hljs-variable,.hljs-template-variable,.hljs-attr,.hljs-property{color:${tok.var};}
.hljs-punctuation,.hljs-operator{color:${tok.punct};}
.hljs-meta,.hljs-tag{color:${tok.comment};}
.hljs-deletion{color:${tok.keyword};}
.hljs-emphasis{font-style:italic;}
.hljs-strong{font-weight:700;}

table{
  border-collapse:collapse;
  width:100%;
  margin:${sp.paraAfter}pt 0 ${sp.headingBefore * 0.8}pt;
  font-size:${(s.body * 0.95).toFixed(2)}pt;
  page-break-inside:auto;
}
thead{display:table-header-group;}
tr{page-break-inside:avoid;break-inside:avoid;}
th,td{
  border:1px solid ${c.tableBorder};
  padding:${(s.body * 0.42).toFixed(1)}pt ${(s.body * 0.62).toFixed(1)}pt;
  text-align:left;
  vertical-align:top;
}
th{background:${c.tableHeader};color:${c.tableHeaderText};font-weight:700;}
tbody tr:nth-child(odd){background:${c.rowOdd};}
tbody tr:nth-child(even){background:${c.rowEven};}

img{max-width:100%;height:auto;border-radius:4px;page-break-inside:avoid;break-inside:avoid;}

/* 目录 */
.toc{
  margin:0 0 ${sp.headingBefore}pt;
  padding:${(s.body * 0.9).toFixed(1)}pt ${(s.body * 1.1).toFixed(1)}pt;
  background:${c.tableHeader}88;
  border:1px solid ${c.tableBorder};
  border-radius:6px;
  page-break-inside:avoid;break-inside:avoid;
}
.toc-title{font-family:${f.heading};font-weight:700;color:${c.heading};font-size:${(s.body * 1.12).toFixed(2)}pt;margin:0 0 .5em;}
.toc ol{list-style:none;margin:0;padding:0;}
.toc li{margin:.18em 0;font-size:${(s.body * 0.95).toFixed(2)}pt;}
.toc li.toc-l2{padding-left:1.2em;}
.toc li.toc-l3{padding-left:2.4em;font-size:${(s.body * 0.9).toFixed(2)}pt;color:${c.quoteText};}
.toc a{border:0;color:${c.text};}

/* 标题编号 */
.doc.numbered{counter-reset:h2;}
.doc.numbered h2{counter-increment:h2;counter-reset:h3;}
.doc.numbered h2::before{content:counter(h2) ". ";color:${c.accent};}
.doc.numbered h3{counter-increment:h3;}
.doc.numbered h3::before{content:counter(h2) "." counter(h3) " ";color:${c.accent};}

${opts.forPrint ? `
@page{size:${opts.pageSize || 'A4'} ${opts.landscape ? 'landscape' : 'portrait'};margin:0;}
` : ''}
`;
}

/**
 * 生成完整 HTML 文档（预览 / PDF / 图片共用）
 */
function buildDocument(opts) {
  const {
    bodyHtml, theme, mode = 'preview', title = 'Document',
    pageSize = 'A4', margins = {}, toc = '', numbered = false, forReady = false
  } = opts;

  const mm = (v) => `${v}mm`;
  const pageW = opts.pageWidth || 794; // A4 96dpi 内容宽度基准
  const css = buildDocCSS(theme, {
    forPrint: mode !== 'image',
    pageSize,
    landscape: !!opts.landscape,
    pageWidth: mode === 'image' ? (opts.imageWidth || pageW) : pageW
  });

  const readyScript = forReady ? `
<script>
(function(){
  function paint(){
    var de = document.documentElement;
    var w = Math.ceil(Math.max(de.scrollWidth, document.body.scrollWidth, document.body.offsetWidth));
    var h = Math.ceil(Math.max(de.scrollHeight, document.body.scrollHeight, document.body.offsetHeight));
    document.title = 'mdto:' + w + 'x' + h;
    window.__MDTO_READY__ = true;
  }
  function done(){
    var imgs = Array.prototype.slice.call(document.images || []);
    var pending = imgs.filter(function(i){ return !i.complete; });
    if (pending.length) {
      var left = pending.length;
      pending.forEach(function(i){
        var fin = function(){ if (--left <= 0) setTimeout(paint, 60); };
        i.addEventListener('load', fin); i.addEventListener('error', fin);
      });
      setTimeout(paint, 4000);
    } else { setTimeout(paint, 60); }
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function(){ setTimeout(done, 30); });
  } else { setTimeout(done, 150); }
})();
</script>` : '';

  const zoom = Number(opts.zoom) > 1 ? Number(opts.zoom) : 1;
  const bodyPad = mode === 'image'
    ? `padding:${margins.top || 28}px ${margins.right || 34}px ${margins.bottom || 28}px ${margins.left || 34}px;`
    : 'padding:0;';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
${css}
${mode === 'image' ? `html{zoom:${zoom};}body{width:${opts.imageWidth || pageW}px;${bodyPad}` : ''}
</style>
</head>
<body class="${mode === 'image' ? 'image-mode' : 'print-mode'}">
<div class="doc${numbered ? ' numbered' : ''}">${toc}${bodyHtml}</div>
${readyScript}
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

module.exports = {
  PRESETS, DENSITY, FONT_OPTIONS, FONT_STACKS,
  resolveTheme, getPreset, buildDocCSS, buildDocument, escapeHtml, luminance
};
