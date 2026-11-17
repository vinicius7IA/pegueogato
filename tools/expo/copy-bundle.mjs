// Copia o build de arquivo único do jogo para o app Expo (mobile/assets/game.html).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const src = path.join(root, 'dist-single', 'index.html');
const dst = path.join(root, 'mobile', 'assets', 'game.html');
fs.copyFileSync(src, dst);
fs.copyFileSync(path.join(root, 'public', 'icons', 'icon-512.png'), path.join(root, 'mobile', 'assets', 'icon.png'));
console.log(`game.html: ${(fs.statSync(dst).size / 1024 / 1024).toFixed(1)} MB -> mobile/assets/`);
