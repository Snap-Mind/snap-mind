import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure target directory exists
const targetDir = path.join(__dirname, '../dist-electron/electron/assets');

fs.mkdirSync(targetDir, { recursive: true });

const sourceDir = path.join(__dirname, '../electron/assets');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((item) => {
      copyRecursive(path.join(src, item), path.join(dest, item));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

fs.readdirSync(sourceDir).forEach((item) => {
  copyRecursive(path.join(sourceDir, item), path.join(targetDir, item));
});

console.log('✓ Assets copied successfully!');
