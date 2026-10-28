'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, Menu, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

/* 无独显 / 远程桌面 / 容器环境下 GPU 进程容易反复崩溃，
   统一走软件渲染，保证导出稳定。 */
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.commandLine.appendSwitch('disable-features', 'Vulkan');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

let mainWindow = null;
const tmpFiles = new Set();

/* ------------------------------------------------------------------ */
/* 窗口                                                                */
/* ------------------------------------------------------------------ */

function createWindow() {
  const { screen } = require('electron');
  const area = screen.getPrimaryDisplay().workAreaSize;
  const w = Math.max(960, Math.min(1560, Math.round(area.width * 0.92)));
  const h = Math.max(640, Math.min(1000, Math.round(area.height * 0.92)));

  mainWindow = new BrowserWindow({
    width: w,
    height: h,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#0e1014',
    show: false,
    title: 'MD-To Desktop',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0e1014', symbolColor: '#c8d0da', height: 46 },
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      spellcheck: false,
      webviewTag: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.env.MDTO_SHOT) {
      setTimeout(async () => {
        try {
          const img = await mainWindow.webContents.capturePage();
          const out = process.env.MDTO_SHOT_OUT ||
            path.join(__dirname, 'test', 'ui.png');
          fs.mkdirSync(path.dirname(out), { recursive: true });
          fs.writeFileSync(out, img.toPNG());
          console.log('shot saved', out);
        } catch (e) {
          console.log('shot error', e.message);
        }
        app.exit(0);
      }, Number(process.env.MDTO_SHOT) || 3000);
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  // 外部链接用系统浏览器打开，不在应用内导航
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) e.preventDefault();
  });
}

function buildMenu() {
  const send = (ch) => () => mainWindow && mainWindow.webContents.send(ch);
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '打开文件…', accelerator: 'CmdOrCtrl+O', click: send('menu:open') },
        { label: '导出 / 另存为…', accelerator: 'CmdOrCtrl+S', click: send('menu:export') },
        { label: '复制结果', accelerator: 'CmdOrCtrl+Shift+C', click: send('menu:copy') },
        { type: 'separator' },
        { label: '退出', role: 'quit' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '重新载入', role: 'reload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于 MD-To Desktop', click: () => {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: '关于',
            message: 'MD-To Desktop 1.0.0',
            detail: '18 个 Markdown 转换工具的本地桌面版。\n所有转换都在本机完成，不上传任何内容。'
          });
        } }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------------------------------------------------------------------ */
/* 工具函数                                                            */
/* ------------------------------------------------------------------ */

function tmpPath(ext) {
  const p = path.join(os.tmpdir(), 'mdto-' + crypto.randomBytes(8).toString('hex') + ext);
  tmpFiles.add(p);
  return p;
}

function cleanupTmp() {
  for (const p of tmpFiles) { try { fs.unlinkSync(p); } catch (_) {} }
  tmpFiles.clear();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 创建一个隐藏窗口渲染 HTML，用于导出 PDF / 图片。
 * 页面通过 document.title = "mdto:WxH" 回传真实尺寸（不依赖 executeJavaScript，
 * 后者在部分环境下不可靠）。
 */
async function renderWindow(html, width, height) {
  const file = tmpPath('.html');
  fs.writeFileSync(file, html, 'utf8');

  const win = new BrowserWindow({
    show: false,
    width: Math.max(320, Math.round(width)),
    height: Math.max(320, Math.round(height)),
    backgroundColor: '#ffffff',
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      javascript: true,
      images: true,
      webSecurity: false
    }
  });

  const metrics = await new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };

    win.webContents.on('page-title-updated', (_e, title) => {
      const m = /^mdto:(\d+)x(\d+)$/.exec(String(title || '').trim());
      if (m) {
        // 尺寸回传后再等一帧，确保绘制完成
        setTimeout(() => finish({ w: Number(m[1]), h: Number(m[2]) }), 180);
      }
    });

    win.webContents.once('did-finish-load', () => {
      setTimeout(() => finish(null), 1600);
    });

    win.loadFile(file).catch(() => finish(null));
    setTimeout(() => finish(null), 15000);
  });

  return { win, metrics };
}

async function pageMetrics(win) {
  return win.webContents.executeJavaScript(
    `(() => {
      const b = document.body;
      const de = document.documentElement;
      return {
        width: Math.max(b.scrollWidth, de.scrollWidth),
        height: Math.max(b.scrollHeight, de.scrollHeight)
      };
    })()`,
    true
  );
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */

ipcMain.handle('file:pick', async (_e, opts = {}) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: opts.title || '打开文件',
    properties: ['openFile'],
    filters: opts.filters || [{ name: '所有文件', extensions: ['*'] }]
  });
  if (res.canceled || !res.filePaths.length) return { canceled: true };
  const p = res.filePaths[0];
  const buf = fs.readFileSync(p);
  return {
    canceled: false,
    path: p,
    name: path.basename(p),
    ext: path.extname(p).toLowerCase(),
    base64: buf.toString('base64'),
    size: buf.length
  };
});

ipcMain.handle('file:save', async (_e, opts = {}) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: opts.title || '保存文件',
    defaultPath: opts.defaultName || 'untitled',
    filters: opts.filters || [{ name: '所有文件', extensions: ['*'] }]
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  const data = opts.text != null
    ? Buffer.from(opts.text, 'utf8')
    : Buffer.from(opts.base64 || '', 'base64');
  fs.writeFileSync(res.filePath, data);
  return { canceled: false, path: res.filePath, size: data.length };
});

ipcMain.handle('file:openPath', async (_e, p) => {
  if (!p) return false;
  await shell.openPath(p);
  return true;
});

ipcMain.handle('shell:external', async (_e, url) => {
  if (/^https?:/i.test(url)) await shell.openExternal(url);
  return true;
});

ipcMain.handle('clipboard:write', async (_e, payload) => {
  if (payload && payload.html) {
    clipboard.write({ text: payload.text || '', html: payload.html });
  } else {
    clipboard.writeText(payload && payload.text ? payload.text : '');
  }
  return true;
});

/* 远程抓取（绕过渲染进程 CORS），用于把网络图片嵌入 docx */
ipcMain.handle('net:fetch', async (_e, url) => {
  try {
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) return { ok: false, error: 'HTTP ' + r.status };
    const mime = r.headers.get('content-type') || 'application/octet-stream';
    const ab = await r.arrayBuffer();
    return { ok: true, mime, base64: Buffer.from(ab).toString('base64') };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

/* Excel 生成（xlsx 体积大，放主进程） */
const trace = (m) => { if (process.env.MDTO_TRACE) { try { fs.appendFileSync(path.join(__dirname, 'test', 'trace.log'), m + '\n'); } catch (_) {} } };

ipcMain.handle('excel:build', async (_e, payload = {}) => {
  try {
    trace('[excel] start');
    const XLSX = require('xlsx');
    trace('[excel] xlsx loaded');
    const tables = payload.tables || [];
    if (!tables.length) return { ok: false, error: '没有找到表格' };

    const wb = XLSX.utils.book_new();
    const opts = payload.opts || {};
    const groups = opts.singleSheet
      ? [{ name: '表格', rows: tables.reduce((acc, t, i) => {
          if (i > 0) acc.push(['']);
          return acc.concat(t.rows);
        }, []) }]
      : tables.map((t, i) => ({ name: t.name || `Table${i + 1}`, rows: t.rows }));

    groups.forEach((g, i) => {
      const ws = XLSX.utils.aoa_to_sheet(g.rows);
      const widths = [];
      g.rows.forEach((r) => r.forEach((cell, ci) => {
        const str = String(cell == null ? '' : cell);
        const w = Array.from(str).reduce((n, ch) => n + (/[\u4e00-\u9fa5\uff00-\uffef]/.test(ch) ? 2 : 1), 0);
        widths[ci] = Math.min(60, Math.max(widths[ci] || 8, w + 2));
      }));
      ws['!cols'] = widths.map((w) => ({ wch: w }));
      const safe = String(g.name).replace(/[\\/*?:[\]]/g, '_').slice(0, 31) || `Sheet${i + 1}`;
      XLSX.utils.book_append_sheet(wb, ws, safe);
    });

    const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    return { ok: true, base64: b64 };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

/* Word 生成 */
ipcMain.handle('docx:build', async (_e, payload = {}) => {
  try {
    const { buildDocx } = require('./lib/docx-builder');
    const b64 = await buildDocx(payload.markdown || '', payload.opts || {});
    return { ok: true, base64: b64 };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

/* Word 解析：docx → html（mammoth 放主进程） */
ipcMain.handle('docx:extract', async (_e, payload = {}) => {
  try {
    const mammoth = require('mammoth');
    const buf = Buffer.from(payload.base64 || '', 'base64');
    const result = await mammoth.convertToHtml({ buffer: buf }, {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='标题 1'] => h1:fresh",
        "p[style-name='标题 2'] => h2:fresh",
        "p[style-name='标题 3'] => h3:fresh",
        "p[style-name='Quote'] => blockquote:fresh",
        "p[style-name='Intense Quote'] => blockquote:fresh"
      ]
    });
    if (!result.value || !result.value.trim()) {
      return { ok: false, error: '文档里没有可提取的文字（可能是扫描件或纯图片）' };
    }
    return {
      ok: true,
      html: result.value,
      warnings: (result.messages || []).filter((m) => m.type === 'warning').slice(0, 5).map((m) => m.message)
    };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

/* PDF 文本抽取（在主进程做，避开 worker 限制） */
ipcMain.handle('pdf:extract', async (_e, opts = {}) => {  try {
    const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
    const data = new Uint8Array(Buffer.from(opts.base64 || '', 'base64'));
    const doc = await pdfjs.getDocument({
      data,
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      verbosity: 0
    }).promise;

    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      const items = tc.items
        .filter((it) => typeof it.str === 'string' && it.str.trim() !== '')
        .map((it) => ({
          str: it.str,
          x: it.transform[4],
          y: viewport.height - it.transform[5],
          w: it.width || 0,
          size: Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 10,
          font: it.fontName || ''
        }));
      pages.push({ page: p, width: viewport.width, height: viewport.height, items });
      page.cleanup();
    }
    await doc.destroy();
    return { ok: true, pages, numPages: pages.length };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

/* 导出 PDF */
ipcMain.handle('render:pdf', async (_e, opts = {}) => {
  let win = null;
  try {
    const width = opts.viewportWidth || 900;
    const r = await renderWindow(opts.html, width, 1200);
    win = r.win;

    const mm = (v) => Number(v || 0) / 25.4;
    const margins = {
      top: mm(opts.marginTop ?? 18),
      bottom: mm(opts.marginBottom ?? 18),
      left: mm(opts.marginLeft ?? 16),
      right: mm(opts.marginRight ?? 16)
    };

    const pdfOpts = {
      printBackground: true,
      landscape: !!opts.landscape,
      pageSize: opts.pageSize || 'A4',
      preferCSSPageSize: false,
      margins,
      displayHeaderFooter: !!opts.pageNumbers,
      headerTemplate: '<div></div>',
      footerTemplate: opts.pageNumbers
        ? `<div style="width:100%;font-size:9px;color:#9aa3ad;text-align:center;padding:0 10mm;font-family:Segoe UI,Microsoft YaHei,sans-serif;">
             <span class="pageNumber"></span> / <span class="totalPages"></span>
           </div>`
        : '<div></div>'
    };

    if (opts.pageNumbers) {
      pdfOpts.margins.bottom = Math.max(margins.bottom, 0.55);
    }

    const buf = await win.webContents.printToPDF(pdfOpts);
    return { ok: true, base64: buf.toString('base64'), bytes: buf.length };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
  }
});

/* 导出图片 */
ipcMain.handle('render:image', async (_e, opts = {}) => {
  let win = null;
  try {
    const scale = Math.min(4, Math.max(1, Number(opts.scale) || 2));
    const cssWidth = Number(opts.width) || 900;

    const r = await renderWindow(opts.html, cssWidth * scale, 900);
    win = r.win;

    let wantW = Math.ceil(cssWidth * scale);
    let wantH = 1200;
    if (r.metrics) {
      wantW = Math.min(16000, Math.max(200, Math.ceil(r.metrics.w)));
      wantH = Math.min(16000, Math.max(200, Math.ceil(r.metrics.h)));
    }

    win.setContentSize(wantW, wantH);
    await sleep(420);

    let img = await win.webContents.capturePage();
    if (!img || img.isEmpty()) return { ok: false, error: '截图失败（空图像）' };

    const size = img.getSize();
    if (size.height > wantH + 2 || size.width > wantW + 2) {
      img = img.crop({ x: 0, y: 0, width: Math.min(size.width, wantW), height: Math.min(size.height, wantH) });
    }

    const fmt = (opts.format || 'png').toLowerCase();
    const base64 = (fmt === 'jpeg' || fmt === 'jpg')
      ? img.toJPEG(Number(opts.quality) || 92).toString('base64')
      : img.toPNG().toString('base64');

    return { ok: true, base64, width: img.getSize().width, height: img.getSize().height };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
  }
});

ipcMain.handle('app:info', async () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  platform: process.platform,
  tmp: os.tmpdir()
}));

/* ------------------------------------------------------------------ */
/* 生命周期                                                            */
/* ------------------------------------------------------------------ */

function boot() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    buildMenu();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    cleanupTmp();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', cleanupTmp);
}

if (require.main === module) {
  boot();
}

module.exports = { boot };
