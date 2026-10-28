'use strict';

/* 生成应用图标 assets/icon.png（512×512，透明背景圆角方块） */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('disable-gpu');

const SIZE = 512;

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:transparent;width:${SIZE}px;height:${SIZE}px;}
  .wrap{width:${SIZE}px;height:${SIZE}px;display:grid;place-items:center;}
  .box{
    width:${SIZE - 40}px;height:${SIZE - 40}px;border-radius:118px;
    background:linear-gradient(145deg,#7c9cff 0%,#5566e8 52%,#3b3fd0 100%);
    box-shadow:inset 0 2px 18px rgba(255,255,255,.35);
    display:grid;place-items:center;position:relative;overflow:hidden;
  }
  .box::after{
    content:'';position:absolute;inset:-40% -20% 55% -20%;
    background:radial-gradient(120% 90% at 50% 0%,rgba(255,255,255,.42),rgba(255,255,255,0) 70%);
  }
  .mark{
    font-family:'Segoe UI Black','Segoe UI','Microsoft YaHei',sans-serif;
    font-weight:800;font-size:232px;color:#fff;letter-spacing:-10px;
    line-height:1;transform:translate(-34px,-26px);position:relative;z-index:2;
    text-shadow:0 6px 18px rgba(20,20,60,.28);
  }
  .arrow{position:absolute;right:74px;bottom:58px;z-index:3;}
</style></head><body>
<div class="wrap"><div class="box">
  <div class="mark">M</div>
  <svg class="arrow" width="96" height="96" viewBox="0 0 24 24" fill="none"
       stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 4v13"/><path d="M6.5 12l5.5 5.5L17.5 12"/><path d="M5 21h14"/>
  </svg>
</div></div>
</body></html>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE, height: SIZE, show: false, transparent: true, frame: false,
    webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true }
  });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 700));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE });
  const out = path.join(__dirname, '..', 'assets', 'icon.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, img.toPNG());
  console.log('icon written', img.getSize());
  app.exit(0);
});
