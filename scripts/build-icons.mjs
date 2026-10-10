import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('assets', { recursive: true });
await sharp('web/icon.svg').resize(512, 512).png().toFile('assets/icon.png');
await sharp('web/icon.svg').resize(192, 192).png().toFile('web/icon.png');
// ICO supports embedded PNG images. Supply a native icon so packaging does
// not depend on electron-builder's WebAssembly image conversion helper.
const png = await sharp('web/icon.svg').resize(256, 256).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); // ICO type
header.writeUInt16LE(1, 4); // One 256x256 image (dimensions encoded as zero)
header.writeUInt16LE(1, 10); // Color planes
header.writeUInt16LE(32, 12); // Bits per pixel
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await writeFile('assets/icon.ico', Buffer.concat([header, png]));
