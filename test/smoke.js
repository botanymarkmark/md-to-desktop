'use strict';

/* 快速自检：在真实 Electron 渲染环境里跑一遍全部转换管线 */

require('../main.js'); // 注册 IPC（file:save / render:pdf / render:image / pdf:extract / net:fetch）

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'out');
const RESULT = path.join(__dirname, 'results.json');
fs.mkdirSync(OUT, { recursive: true });

const LOG = path.join(__dirname, 'run.log');
try { fs.unlinkSync(LOG); } catch (_) {}
function log() {
  const line = Array.from(arguments).join(' ');
  try { fs.appendFileSync(LOG, line + '\n'); } catch (_) {}
  console.log(line);
}
log('smoke start', process.versions.electron);

// 覆盖 file:save，测试时直接落盘到 test/out
ipcMain.removeHandler('file:save');
ipcMain.handle('file:save', async (_e, opts = {}) => {
  const p = path.join(OUT, opts.defaultName || 'out.bin');
  const data = opts.text != null ? Buffer.from(opts.text, 'utf8') : Buffer.from(opts.base64 || '', 'base64');
  fs.writeFileSync(p, data);
  return { canceled: false, path: p, size: data.length };
});

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  log('app ready');
  const win = new BrowserWindow({
    show: false,
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  });

  win.webContents.on('console-message', (_e, level, message) => {
    log('[renderer]', level, message);
  });
  win.webContents.on('render-process-gone', (_e, d) => log('[crash]', JSON.stringify(d)));
  win.webContents.on('did-fail-load', (_e, code, desc) => log('[fail-load]', code, desc));
  win.on('closed', () => log('[window closed]'));

  const hb = setInterval(() => {
    try {
      const alive = !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed();
      log('[hb]', alive ? 'alive' : 'dead');
    } catch (e) { log('[hb] err', e.message); }
  }, 5000);

  const done = new Promise((resolve) => {
    ipcMain.once('test:done', (_ev, payload) => resolve(payload));
    setTimeout(() => resolve(null), 180000);
  });

  try {
    await win.loadFile(path.join(__dirname, 'test.html'));
    log('test.html loaded');
  } catch (e) {
    log('load error', String(e && e.message || e));
    app.exit(2);
    return;
  }

  const res = await done;
  if (res) {
    fs.writeFileSync(RESULT, JSON.stringify(res, null, 2), 'utf8');
    log('SUMMARY', JSON.stringify(res.summary));
  } else {
    log('FATAL', '测试超时，没有收到结果');
  }
  clearInterval(hb);
  log('smoke end');
  app.exit(0);
}).catch((e) => log('BOOT ERROR', String(e && e.stack || e)));
