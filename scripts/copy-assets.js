import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure target directory exists
const targetDir = path.join(__dirname, '../dist-electron/electron/assets');
fs.mkdirSync(targetDir, { recursive: true });

// Copy all files from electron/assets to dist-electron/electron/assets
const sourceDir = path.join(__dirname, '../electron/assets');
fs.readdirSync(sourceDir).forEach((file) => {
  fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
});

console.log('✓ Assets copied successfully!');
