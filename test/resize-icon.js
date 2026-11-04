'use strict';

/* 用 Electron 的 nativeImage 把 icon.png 缩到 256×256，供 .ico 使用 */

const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');

app.whenReady().then(() => {
  const src = path.join(__dirname, '..', 'assets', 'icon.png');
  const img = nativeImage.createFromPath(src);
  const small = img.resize({ width: 256, height: 256, quality: 'best' });
  const out = path.join(__dirname, '..', 'assets', 'icon-256.png');
  fs.writeFileSync(out, small.toPNG());
  fs.writeFileSync(path.join(__dirname, 'icon-size.txt'), img.getSize().width + ' -> ' + small.getSize().width);
  app.exit(0);
});
