'use strict';

/**
 * 打包成免安装的绿色版：
 *   dist/MD-To Desktop/MD-To Desktop.exe
 * 做法是把 electron 运行时复制一份，应用代码放进 resources/app。
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ELECTRON_DIR = path.join(ROOT, 'node_modules', 'electron', 'dist');
const OUT = path.join(ROOT, 'dist', 'MD-To Desktop');
const APP = path.join(OUT, 'resources', 'app');

function rm(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest, filter) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (filter && !filter(s, entry)) continue;
    if (entry.isDirectory()) copyDir(s, d, filter);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

console.log('1/4 准备输出目录 …');
// 不删除已有目录，直接覆盖写入（避免误删）
fs.mkdirSync(OUT, { recursive: true });

console.log('2/4 复制 Electron 运行时 …');
const EXCLUDE_RUNTIME = new Set(['resources', 'electron.exe']);
copyDir(ELECTRON_DIR, OUT, (s, e) => !(e.isDirectory() && EXCLUDE_RUNTIME.has(e.name)) &&
  !(e.isFile() && e.name === 'electron.exe'));

// electron.exe 改名为应用名
fs.copyFileSync(path.join(ELECTRON_DIR, 'electron.exe'), path.join(OUT, 'MD-To Desktop.exe'));

console.log('3/4 复制应用代码 …');
fs.mkdirSync(APP, { recursive: true });
for (const item of ['main.js', 'package.json', 'lib', 'renderer', 'assets']) {
  const s = path.join(ROOT, item);
  const d = path.join(APP, item);
  const st = fs.statSync(s);
  if (st.isDirectory()) copyDir(s, d);
  else fs.copyFileSync(s, d);
}

// 只带运行期依赖，去掉 electron 与测试产物
const KEEP = ['docx', 'xlsx', 'mammoth', 'pdfjs-dist', 'turndown', 'turndown-plugin-gfm',
  'papaparse', 'markdown-it', 'highlight.js'];
const nmSrc = path.join(ROOT, 'node_modules');
const nmDst = path.join(APP, 'node_modules');
fs.mkdirSync(nmDst, { recursive: true });

// package.json 里声明的依赖 + 它们的传递依赖
const seen = new Set();
function copyPkg(name) {
  if (seen.has(name)) return;
  seen.add(name);
  const src = path.join(nmSrc, name);
  if (!fs.existsSync(src)) return;
  copyDir(src, path.join(nmDst, name));
  let pkg = {};
  try { pkg = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8')); } catch (_) {}
  Object.keys(pkg.dependencies || {}).forEach(copyPkg);
}
KEEP.forEach(copyPkg);

// 隐藏的 .bin 与缓存不需要
rm(path.join(APP, 'node_modules', '.bin'));

console.log('4/4 写入启动说明 …');
fs.writeFileSync(path.join(OUT, '使用说明.txt'),
`MD-To Desktop — Markdown 转换桌面工具

启动：双击 “MD-To Desktop.exe”
所有转换都在本机完成，不联网、不上传。

包含 18 个功能：
  Markdown → PDF / Word / HTML / 图片 / LaTeX / RST / Confluence / 纯文本 / Excel
  表格 → CSV / PDF / 图片；CSV、JSON → Markdown 表格
  Word → Markdown；PDF → Markdown；HTML → Markdown
  Markdown 编辑器（实时预览 + 多格式导出）

快捷操作：
  Ctrl+O 打开文件    Ctrl+S 导出    Ctrl+Shift+C 复制结果
`, 'utf8');

const size = (dir) => {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += size(p);
    else total += fs.statSync(p).size;
  }
  return total;
};
console.log('完成：' + OUT);
console.log('体积：' + (size(OUT) / 1024 / 1024).toFixed(1) + ' MB');
