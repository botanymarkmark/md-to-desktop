'use strict';

/* ------------------------------------------------------------------ *
 *  工具定义（18 个功能，对应 md-to.com 全部转换能力）
 * ------------------------------------------------------------------ */

const SAMPLE_MD = `# Markdown 转换器 · 示例文档

这是一份用来测试排版的示例文件。左边随便改，右边实时预览。

## 一、文字样式

**加粗**、*斜体*、~~删除线~~、\`行内代码\`、[超链接](https://md-to.com/)。
支持中文排版：标点挤压、行高、段间距都可调。

> 引用块用于强调结论。
> 第二行会自然合并。

## 二、列表

- 无序列表项一
- 无序列表项二
  - 嵌套项 A
  - 嵌套项 B
- [x] 已完成的任务
- [ ] 待办事项

1. 第一步：写 Markdown
2. 第二步：选模板
3. 第三步：导出

## 三、代码

\`\`\`javascript
// 语法高亮在这台机器上本地完成
const convert = async (md) => {
  const html = render(md);
  return await exportPdf(html, { pageSize: 'A4' });
};
\`\`\`

\`\`\`python
def fib(n: int) -> int:
    """斐波那契数列"""
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
\`\`\`

## 四、表格

| 格式 | 用途 | 是否可编辑 |
| --- | --- | :---: |
| PDF | 打印、投稿 | 否 |
| Word | 协作、批注 | 是 |
| HTML | 网页发布 | 是 |
| Excel | 数据处理 | 是 |

## 五、公式与分割线

行内公式 $E = mc^2$ 直接保留原样，导出 LaTeX 时不会丢。

---

## 六、结语

一份文档的排版质量，往往决定了读者愿不愿意读下去。
`;

const SAMPLE_TABLE = `| 季度 | 收入 | 同比 | 状态 |
| --- | ---: | ---: | :---: |
| Q1 2024 | ¥1,200,000 | +8% | 达成 |
| Q2 2024 | ¥1,400,000 | +17% | 达成 |
| Q3 2024 | ¥1,600,000 | +14% | 达成 |
| Q4 2024 | ¥1,900,000 | +19% | 超额 |
`;

const SAMPLE_CSV = `姓名,部门,职级,入职日期
张伟,研发中心,P6,2021-03-15
李娜,产品设计,P5,2022-07-01
王强,数据平台,P7,2019-11-20
陈静,市场运营,P5,2023-02-08
`;

const SAMPLE_JSON = `[
  { "name": "Markdown", "ext": ".md", "type": "标记语言", "since": 2004 },
  { "name": "PDF", "ext": ".pdf", "type": "版式文档", "since": 1993 },
  { "name": "Word", "ext": ".docx", "type": "富文本", "since": 1983 },
  { "name": "reStructuredText", "ext": ".rst", "type": "标记语言", "since": 2002 }
]`;

const SAMPLE_HTML = `<h1>网页转 Markdown</h1>
<p>把任意 <strong>HTML</strong> 粘进来，立刻变成干净的 <code>Markdown</code>。</p>
<h2>支持的标签</h2>
<ul>
  <li>标题、段落、<em>强调</em></li>
  <li>列表、引用、代码块</li>
  <li>表格（GFM 语法）</li>
</ul>
<table>
  <thead><tr><th>标签</th><th>转成</th></tr></thead>
  <tbody>
    <tr><td>&lt;h1&gt;</td><td># 标题</td></tr>
    <tr><td>&lt;strong&gt;</td><td>**加粗**</td></tr>
  </tbody>
</table>
<blockquote><p>只保留结构，不保留样式。</p></blockquote>
`;

/* ---------------- 可复用选项 ---------------- */

const OPT_THEME = { id: 'preset', label: '文档模板', type: 'preset', group: '外观' };
const OPT_DENSITY = {
  id: 'density', label: '排版密度', type: 'segmented', default: 'standard', group: '外观',
  choices: [
    { v: 'compact', l: '紧凑' },
    { v: 'standard', l: '标准' },
    { v: 'relaxed', l: '宽松' }
  ]
};
const OPT_CUSTOM = { id: 'customOpen', label: '自定义颜色 / 字体 / 字号', type: 'appearance', group: '外观' };

const OPT_PAGESIZE = {
  id: 'pageSize', label: '纸张', type: 'select', default: 'A4', group: '页面',
  choices: [
    { v: 'A4', l: 'A4 · 210×297mm' },
    { v: 'Letter', l: 'Letter · 8.5×11in' },
    { v: 'A5', l: 'A5 · 148×210mm' },
    { v: 'A3', l: 'A3 · 297×420mm' },
    { v: 'Legal', l: 'Legal · 8.5×14in' }
  ]
};
const OPT_ORIENT = {
  id: 'landscape', label: '方向', type: 'segmented', default: 'portrait', group: '页面',
  choices: [{ v: 'portrait', l: '纵向' }, { v: 'landscape', l: '横向' }]
};
const OPT_MARGIN = { id: 'margins', label: '页边距（mm）', type: 'margins', default: [22, 22, 20, 20], group: '页面' };
const OPT_PAGENUM = { id: 'pageNumbers', label: '页脚页码', type: 'toggle', default: true, group: '页面' };
const OPT_TOC = { id: 'toc', label: '自动生成目录', type: 'toggle', default: false, group: '页面' };
const OPT_NUMBERED = { id: 'numbered', label: '标题自动编号', type: 'toggle', default: false, group: '页面' };

module.exports = {
  groups: [
    { id: 'export', name: 'Markdown 导出' },
    { id: 'markup', name: '标记语言转换' },
    { id: 'table', name: '表格工具' },
    { id: 'reverse', name: '反向转换' },
    { id: 'write', name: '写作' }
  ],

  tools: [
    /* ------------------------- Markdown 导出 ------------------------- */
    {
      id: 'pdf', name: 'Markdown → PDF', badge: 'PDF', group: 'export', kind: 'pdf',
      desc: '按模板排版并输出分页精确的 PDF，代码块、表格、标题不会撕裂。',
      input: 'markdown', preview: 'doc', ext: 'pdf',
      primary: '导出 PDF', exportLabel: 'PDF',
      filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
      sample: SAMPLE_MD,
      options: [OPT_THEME, OPT_DENSITY, OPT_PAGESIZE, OPT_ORIENT, OPT_MARGIN, OPT_PAGENUM, OPT_TOC, OPT_NUMBERED, OPT_CUSTOM]
    },
    {
      id: 'docx', name: 'Markdown → Word', badge: 'DOC', group: 'export', kind: 'docx',
      desc: '生成原生 .docx，标题用 Word 内置样式，表格与图片都可继续编辑。',
      input: 'markdown', preview: 'doc', ext: 'docx',
      primary: '导出 Word', exportLabel: 'Word',
      filters: [{ name: 'Word 文档', extensions: ['docx'] }],
      sample: SAMPLE_MD,
      options: [OPT_THEME, OPT_DENSITY, OPT_PAGESIZE, OPT_ORIENT, OPT_MARGIN, OPT_PAGENUM, OPT_TOC, OPT_CUSTOM]
    },
    {
      id: 'html', name: 'Markdown → HTML', badge: 'HTML', group: 'export', kind: 'html',
      desc: '带完整样式的单文件 HTML，可直接部署，也可只取正文片段。',
      input: 'markdown', preview: 'doc', ext: 'html',
      primary: '导出 HTML', exportLabel: 'HTML',
      filters: [{ name: 'HTML 文件', extensions: ['html', 'htm'] }],
      sample: SAMPLE_MD,
      options: [
        OPT_THEME, OPT_DENSITY,
        { id: 'standalone', label: '完整 HTML 文档', type: 'toggle', default: true, group: '输出',
          hint: '关闭则只导出一段可嵌入的正文 HTML' },
        OPT_TOC
      ]
    },
    {
      id: 'image', name: 'Markdown → 图片', badge: 'PNG', group: 'export', kind: 'image',
      desc: '整篇渲染成一张长图，适合发公众号、社群、PPT。',
      input: 'markdown', preview: 'doc', ext: 'png',
      primary: '导出图片', exportLabel: '图片',
      filters: [{ name: 'PNG 图片', extensions: ['png'] }, { name: 'JPEG 图片', extensions: ['jpg', 'jpeg'] }],
      sample: SAMPLE_MD,
      options: [
        OPT_THEME, OPT_DENSITY,
        { id: 'imgWidth', label: '画布宽度', type: 'range', default: 900, min: 640, max: 1600, step: 20, unit: 'px', group: '输出' },
        { id: 'imgScale', label: '清晰度', type: 'segmented', default: '2', group: '输出',
          choices: [{ v: '1', l: '1x' }, { v: '2', l: '2x' }, { v: '3', l: '3x' }] },
        { id: 'imgFormat', label: '格式', type: 'segmented', default: 'png', group: '输出',
          choices: [{ v: 'png', l: 'PNG' }, { v: 'jpeg', l: 'JPEG' }] },
        { id: 'imgPad', label: '内边距', type: 'range', default: 36, min: 0, max: 80, step: 2, unit: 'px', group: '输出' }
      ]
    },

    /* ------------------------ 标记语言转换 ------------------------ */
    {
      id: 'latex', name: 'Markdown → LaTeX', badge: 'TEX', group: 'markup', kind: 'latex',
      desc: '转换成可编译的 LaTeX 源码，标题、列表、表格、代码、公式都有对应写法。',
      input: 'markdown', preview: 'code', ext: 'tex',
      primary: '导出 .tex', exportLabel: 'LaTeX',
      filters: [{ name: 'LaTeX 源码', extensions: ['tex'] }],
      sample: SAMPLE_MD,
      options: [
        { id: 'docClass', label: '文档类', type: 'select', default: 'article', group: 'LaTeX',
          choices: [{ v: 'article', l: 'article' }, { v: 'report', l: 'report' }, { v: 'book', l: 'book' }] },
        { id: 'fontSize', label: '字号', type: 'select', default: '11pt', group: 'LaTeX',
          choices: [{ v: '10pt', l: '10pt' }, { v: '11pt', l: '11pt' }, { v: '12pt', l: '12pt' }] },
        { id: 'topLevel', label: '一级标题映射', type: 'select', default: 'section', group: 'LaTeX',
          choices: [{ v: 'section', l: '\\section' }, { v: 'chapter', l: '\\chapter' }] },
        { id: 'codeEnv', label: '代码块环境', type: 'select', default: 'lstlisting', group: 'LaTeX',
          choices: [{ v: 'lstlisting', l: 'lstlisting（带高亮）' }, { v: 'verbatim', l: 'verbatim（最简）' }] },
        { id: 'addPreamble', label: '附带导言区（可直接编译）', type: 'toggle', default: true, group: 'LaTeX' },
        { id: 'texTitle', label: '文档标题', type: 'text', default: '', placeholder: '留空则不生成 \\title', group: 'LaTeX' },
        { id: 'texAuthor', label: '作者', type: 'text', default: '', placeholder: '可选', group: 'LaTeX' }
      ]
    },
    {
      id: 'rst', name: 'Markdown → RST', badge: 'RST', group: 'markup', kind: 'rst',
      desc: 'reStructuredText，Sphinx 文档站的标准输入格式。',
      input: 'markdown', preview: 'code', ext: 'rst',
      primary: '导出 .rst', exportLabel: 'RST',
      filters: [{ name: 'reStructuredText', extensions: ['rst'] }],
      sample: SAMPLE_MD,
      options: [
        { id: 'rstHeader', label: '顶部加文档标题', type: 'toggle', default: false, group: 'RST' },
        { id: 'rstTitle', label: '标题文字', type: 'text', default: '', placeholder: '例如：项目文档', group: 'RST' }
      ]
    },
    {
      id: 'confluence', name: 'Markdown → Confluence', badge: 'CNF', group: 'markup', kind: 'confluence',
      desc: 'Confluence Wiki Markup，粘贴到旧版编辑器即可还原格式。',
      input: 'markdown', preview: 'code', ext: 'txt',
      primary: '复制 / 保存', exportLabel: 'Confluence',
      filters: [{ name: '文本文件', extensions: ['txt', 'wiki'] }],
      sample: SAMPLE_MD,
      options: [
        { id: 'cnfCode', label: '代码块用 {code} 宏', type: 'toggle', default: true, group: 'Confluence',
          hint: '关闭后使用 {noformat}，适合纯文本' },
        { id: 'cnfTable', label: '表格首行作表头', type: 'toggle', default: true, group: 'Confluence' }
      ]
    },
    {
      id: 'text', name: 'Markdown → 纯文本', badge: 'TXT', group: 'markup', kind: 'text',
      desc: '剥掉所有标记，只留文字，链接可选保留 URL。',
      input: 'markdown', preview: 'code', ext: 'txt',
      primary: '导出 .txt', exportLabel: '纯文本',
      filters: [{ name: '文本文件', extensions: ['txt'] }],
      sample: SAMPLE_MD,
      options: [
        { id: 'headingStyle', label: '标题处理', type: 'select', default: 'plain', group: '输出',
          choices: [{ v: 'plain', l: '只留文字' }, { v: 'underline', l: '下划线（类 RST）' }, { v: 'prefix', l: '# 前缀' }] },
        { id: 'keepUrls', label: '保留链接 URL', type: 'toggle', default: false, group: '输出' },
        { id: 'codeStyle', label: '代码块', type: 'select', default: 'fence', group: '输出',
          choices: [{ v: 'fence', l: '保留 ``` 围栏' }, { v: 'indent', l: '四空格缩进' }] },
        { id: 'wrapWidth', label: '每行宽度', type: 'range', default: 0, min: 0, max: 120, step: 4, unit: '字符', group: '输出', hint: '0 表示不换行' }
      ]
    },

    /* --------------------------- 表格 --------------------------- */
    {
      id: 'excel', name: 'Markdown → Excel', badge: 'XLSX', group: 'table', kind: 'excel',
      desc: '把文档里的每个表格变成 .xlsx 工作表，列宽自动适配。',
      input: 'markdown', preview: 'table', ext: 'xlsx',
      primary: '导出 Excel', exportLabel: 'Excel',
      filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }],
      sample: SAMPLE_MD,
      options: [
        { id: 'sheetMode', label: '工作表划分', type: 'segmented', default: 'each', group: 'Excel',
          choices: [{ v: 'each', l: '每个表一页' }, { v: 'single', l: '全部放一页' }] },
        { id: 'freezeHeader', label: '冻结首行', type: 'toggle', default: true, group: 'Excel' }
      ]
    },
    {
      id: 'table-csv', name: 'Markdown 表格 → CSV', badge: 'CSV', group: 'table', kind: 'csv',
      desc: '只取表格数据，输出标准 CSV，分隔符与引号规则可选。',
      input: 'markdown', preview: 'table', ext: 'csv',
      primary: '导出 CSV', exportLabel: 'CSV',
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
      sample: SAMPLE_TABLE,
      options: [
        { id: 'delimiter', label: '分隔符', type: 'segmented', default: ',', group: 'CSV',
          choices: [{ v: ',', l: '逗号' }, { v: ';', l: '分号' }, { v: 'tab', l: 'Tab' }, { v: '|', l: '竖线' }] },
        { id: 'allTables', label: '导出全部表格', type: 'toggle', default: false, group: 'CSV' },
        { id: 'quoteAll', label: '所有字段加引号', type: 'toggle', default: false, group: 'CSV' }
      ]
    },
    {
      id: 'table-pdf', name: 'Markdown 表格 → PDF', badge: 'PDF', group: 'table', kind: 'table-pdf',
      desc: '只导出表格，宽表自动适配，跨页时表头重复。',
      input: 'markdown', preview: 'table', ext: 'pdf',
      primary: '导出 PDF', exportLabel: 'PDF',
      filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
      sample: SAMPLE_TABLE,
      options: [OPT_THEME, OPT_PAGESIZE, OPT_ORIENT, OPT_MARGIN, OPT_PAGENUM,
        { id: 'tableTitle', label: '表格标题', type: 'text', default: '', placeholder: '可选，显示在表格上方', group: '输出' }]
    },
    {
      id: 'table-image', name: 'Markdown 表格 → 图片', badge: 'PNG', group: 'table', kind: 'table-image',
      desc: '把表格截成一张干净的图片，贴到 PPT 或聊天窗口。',
      input: 'markdown', preview: 'table', ext: 'png',
      primary: '导出图片', exportLabel: '图片',
      filters: [{ name: 'PNG 图片', extensions: ['png'] }, { name: 'JPEG 图片', extensions: ['jpg', 'jpeg'] }],
      sample: SAMPLE_TABLE,
      options: [
        OPT_THEME,
        { id: 'imgWidth', label: '画布宽度', type: 'range', default: 900, min: 480, max: 1600, step: 20, unit: 'px', group: '输出' },
        { id: 'imgScale', label: '清晰度', type: 'segmented', default: '2', group: '输出',
          choices: [{ v: '1', l: '1x' }, { v: '2', l: '2x' }, { v: '3', l: '3x' }] },
        { id: 'imgFormat', label: '格式', type: 'segmented', default: 'png', group: '输出',
          choices: [{ v: 'png', l: 'PNG' }, { v: 'jpeg', l: 'JPEG' }] },
        { id: 'imgPad', label: '内边距', type: 'range', default: 36, min: 0, max: 80, step: 2, unit: 'px', group: '输出' }
      ]
    },
    {
      id: 'csv-to-md', name: 'CSV → Markdown 表格', badge: 'MD', group: 'table', kind: 'csv2md',
      desc: 'CSV / TSV 一键转成对齐的 Markdown 表格，管道符自动转义。',
      input: 'csv', preview: 'table', ext: 'md',
      primary: '导出 .md', exportLabel: 'Markdown',
      filters: [{ name: 'Markdown 文件', extensions: ['md', 'markdown'] }],
      sample: SAMPLE_CSV,
      options: [
        { id: 'csvDelim', label: '分隔符', type: 'select', default: 'auto', group: 'CSV',
          choices: [{ v: 'auto', l: '自动识别' }, { v: ',', l: '逗号 ,' }, { v: ';', l: '分号 ;' }, { v: '\t', l: 'Tab' }, { v: '|', l: '竖线 |' }] },
        { id: 'align', label: '对齐', type: 'segmented', default: 'left', group: '输出',
          choices: [{ v: 'left', l: '左' }, { v: 'center', l: '中' }, { v: 'right', l: '右' }] },
        { id: 'firstRowHeader', label: '首行作为表头', type: 'toggle', default: true, group: '输出' },
        { id: 'skipEmpty', label: '跳过空行', type: 'toggle', default: true, group: 'CSV' }
      ]
    },
    {
      id: 'json-to-md', name: 'JSON → Markdown 表格', badge: 'MD', group: 'table', kind: 'json2md',
      desc: '对象数组直接摊平成表格，嵌套字段自动拼成一行。',
      input: 'json', preview: 'table', ext: 'md',
      primary: '导出 .md', exportLabel: 'Markdown',
      filters: [{ name: 'Markdown 文件', extensions: ['md', 'markdown'] }],
      sample: SAMPLE_JSON,
      options: [
        { id: 'nested', label: '嵌套字段', type: 'segmented', default: 'flatten', group: '输出',
          choices: [{ v: 'flatten', l: '拼接成一行' }, { v: 'json', l: '保留 JSON' }] },
        { id: 'rootKey', label: '取哪个数组', type: 'text', default: '', placeholder: '留空自动识别，如 data', group: '输出' },
        { id: 'align', label: '对齐', type: 'segmented', default: 'left', group: '输出',
          choices: [{ v: 'left', l: '左' }, { v: 'center', l: '中' }, { v: 'right', l: '右' }] }
      ]
    },

    /* -------------------------- 反向转换 -------------------------- */
    {
      id: 'docx-to-md', name: 'Word → Markdown', badge: 'MD', group: 'reverse', kind: 'docx2md',
      desc: '读取 .docx，标题、列表、表格、图片全部还原成 Markdown。',
      input: 'file', accept: ['docx'], acceptExts: ['docx'],
      preview: 'code', ext: 'md', dropHint: '拖入 .docx 文件，或点击选择',
      primary: '导出 .md', exportLabel: 'Markdown',
      filters: [{ name: 'Word 文档', extensions: ['docx'] }],
      sample: '',
      options: [
        { id: 'headingStyle', label: '标题语法', type: 'segmented', default: 'atx', group: '输出',
          choices: [{ v: 'atx', l: '# 号' }, { v: 'setext', l: '下划线' }] },
        { id: 'bullet', label: '列表符号', type: 'segmented', default: '-', group: '输出',
          choices: [{ v: '-', l: '-' }, { v: '*', l: '*' }, { v: '+', l: '+' }] },
        { id: 'codeBlockStyle', label: '代码块', type: 'segmented', default: 'fenced', group: '输出',
          choices: [{ v: 'fenced', l: '``` 围栏' }, { v: 'indented', l: '缩进' }] }
      ]
    },
    {
      id: 'pdf-to-md', name: 'PDF → Markdown', badge: 'MD', group: 'reverse', kind: 'pdf2md',
      desc: '抽取 PDF 文字层，按字号推断标题层级，重建成结构化 Markdown。',
      input: 'file', accept: ['pdf'], acceptExts: ['pdf'],
      preview: 'code', ext: 'md', dropHint: '拖入 .pdf 文件，或点击选择',
      primary: '导出 .md', exportLabel: 'Markdown',
      filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
      sample: '',
      options: [
        { id: 'pageMarkers', label: '标记分页位置', type: 'toggle', default: false, group: '输出' },
        { id: 'dehyphenate', label: '修复断词连字符', type: 'toggle', default: true, group: '输出' },
        { id: 'joinWith', label: '段落内换行合并', type: 'segmented', default: 'space', group: '输出',
          choices: [{ v: 'space', l: '合成一行' }, { v: 'newline', l: '保留换行' }] }
      ]
    },
    {
      id: 'html-to-md', name: 'HTML → Markdown', badge: 'MD', group: 'reverse', kind: 'html2md',
      desc: '粘贴网页源码或整段 HTML，转成干净可读的 Markdown。',
      input: 'html', preview: 'code', ext: 'md',
      primary: '导出 .md', exportLabel: 'Markdown',
      filters: [{ name: 'Markdown 文件', extensions: ['md', 'markdown'] }],
      sample: SAMPLE_HTML,
      options: [
        { id: 'headingStyle', label: '标题语法', type: 'segmented', default: 'atx', group: '输出',
          choices: [{ v: 'atx', l: '# 号' }, { v: 'setext', l: '下划线' }] },
        { id: 'keepTags', label: '保留这些 HTML 标签', type: 'text', default: 'iframe,video,audio', placeholder: '逗号分隔，如 iframe,video', group: '输出' },
        { id: 'brAsSpace', label: '<br> 转成空格', type: 'toggle', default: false, group: '输出' }
      ]
    },

    /* ---------------------------- 编辑器 ---------------------------- */
    {
      id: 'editor', name: 'Markdown 编辑器', badge: 'MD', group: 'write', kind: 'editor',
      desc: '边写边看，随时导出 PDF / Word / HTML / 图片，也可直接存成 .md。',
      input: 'markdown', preview: 'doc', ext: 'md',
      primary: '导出 PDF', exportLabel: 'PDF',
      filters: [{ name: 'Markdown 文件', extensions: ['md', 'markdown'] }],
      sample: SAMPLE_MD,
      options: [OPT_THEME, OPT_DENSITY, OPT_PAGESIZE, OPT_ORIENT, OPT_MARGIN, OPT_PAGENUM, OPT_TOC, OPT_NUMBERED,
        { id: 'editorFormat', label: '导出格式', type: 'segmented', default: 'pdf', group: '输出',
          choices: [{ v: 'pdf', l: 'PDF' }, { v: 'docx', l: 'Word' }, { v: 'html', l: 'HTML' }, { v: 'image', l: '图片' }] },
        OPT_CUSTOM]
    }
  ]
};
