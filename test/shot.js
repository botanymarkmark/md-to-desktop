'use strict';
require('../main.js');
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const TOOL = process.env.MDTO_TOOL || 'pdf';
const SIZE = (process.env.MDTO_SIZE || '1560x980').split('x').map(Number);
const LOG = path.join(__dirname, 'shot.log');
fs.writeFileSync(LOG, 'start tool=' + TOOL + ' size=' + SIZE.join('x') + '\n');
const log = (m) => { try { fs.appendFileSync(LOG, m + '\n'); } catch (e) {} };

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE[0], height: SIZE[1], show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false }
  });
  win.webContents.on('console-message', (_e, l, m) => log('[c' + l + '] ' + m));

  await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'), { query: { tool: TOOL } });
  log('loaded ' + JSON.stringify(win.getContentSize()));
  await new Promise((r) => setTimeout(r, 4000));

  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'ui-' + TOOL + '.png'), img.toPNG());
  log('shot ' + img.getSize().width + 'x' + img.getSize().height);
  app.exit(0);
});
