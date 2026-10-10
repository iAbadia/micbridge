import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
await mkdir('assets', { recursive: true });
await sharp('web/icon.svg').resize(512, 512).png().toFile('assets/icon.png');
await sharp('web/icon.svg').resize(192, 192).png().toFile('web/icon.png');
