'use strict';

/* 把 assets/icon.png 包成 Windows .ico（PNG 压缩格式，Vista+ 支持） */

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'assets');
const pngPath = fs.existsSync(path.join(dir, 'icon-256.png'))
  ? path.join(dir, 'icon-256.png')
  : path.join(dir, 'icon.png');
const png = fs.readFileSync(pngPath);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);   // reserved
header.writeUInt16LE(1, 2);   // type = icon
header.writeUInt16LE(1, 4);   // count

const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0);       // width 256
entry.writeUInt8(0, 1);       // height 256
entry.writeUInt8(0, 2);       // palette
entry.writeUInt8(0, 3);       // reserved
entry.writeUInt16LE(1, 4);    // planes
entry.writeUInt16LE(32, 6);   // bpp
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12);  // offset

fs.writeFileSync(path.join(dir, 'icon.ico'), Buffer.concat([header, entry, png]));
console.log('icon.ico', 22 + png.length, 'bytes');
