#!/usr/bin/env node
/*
 Merge macOS electron-builder update manifests from separate architecture builds
 into a single latest-mac.yml that electron-updater (MacUpdater) expects.

 Usage:
   node scripts/merge-latest-mac.cjs \
     --x64 macos-artifacts-x64/latest-mac-x64.yml \
     --arm64 macos-artifacts-arm64/latest-mac-arm64.yml \
     --out combined/latest-mac.yml
*/

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      opts[key] = val;
    }
  }
  return opts;
}

function parseManifest(text) {
  const o = { files: [] };
  let current = null;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (/^version: /.test(line)) o.version = line.replace(/^version:\s*/, '').trim();
    else if (/^files:/.test(line)) continue;
    else if (/^\s*-\s+url: /.test(line)) {
      current = {};
      current.url = line.replace(/^\s*-\s+url:\s*/, '').trim();
      o.files.push(current);
    } else if (current && /^\s{2,}(sha512|size|blockMapSize): /.test(line)) {
      const m = line.trim().match(/^(sha512|size|blockMapSize):\s*(.*)$/);
      if (m) current[m[1]] = m[2].trim();
    } else if (/^path: /.test(line)) {
      o.path = line.replace(/^path:\s*/, '').trim();
    } else if (/^sha512: /.test(line) && !o.sha512) {
      o.sha512 = line.replace(/^sha512:\s*/, '').trim();
    } else if (/^releaseDate: /.test(line)) {
      o.releaseDate = line.replace(/^releaseDate:\s*/, '').trim();
    }
  }
  return o;
}

function toYAML(o) {
  let out = `version: ${o.version}\nfiles:\n`;
  for (const f of o.files) {
    out += `  - url: ${f.url}\n`;
    if (f.sha512) out += `    sha512: ${f.sha512}\n`;
    if (f.size) out += `    size: ${f.size}\n`;
    if (f.blockMapSize) out += `    blockMapSize: ${f.blockMapSize}\n`;
  }
  out += `path: ${o.path}\nsha512: ${o.sha512}\nreleaseDate: ${o.releaseDate}\n`;
  return out;
}

function main() {
  const { x64, arm64, out } = parseArgs();
  if (!x64 && !arm64) {
    console.error('No --x64 or --arm64 manifest paths supplied.');
    process.exit(1);
  }
  const x64Exists = x64 && fs.existsSync(x64);
  const arm64Exists = arm64 && fs.existsSync(arm64);
  if (!x64Exists && !arm64Exists) {
    console.error('Neither manifest exists. Nothing to merge.');
    process.exit(1);
  }

  const x64Data = x64Exists ? parseManifest(fs.readFileSync(x64, 'utf8')) : null;
  const arm64Data = arm64Exists ? parseManifest(fs.readFileSync(arm64, 'utf8')) : null;

  const merged = {
    version: (x64Data || arm64Data).version,
    files: [],
    path: '',
    sha512: '',
    releaseDate: ''
  };

  const addFiles = (m) => {
    if (!m) return;
    for (const f of m.files) {
      if (!merged.files.find(e => e.url === f.url)) {
        merged.files.push(f);
      }
    }
  };
  addFiles(x64Data);
  addFiles(arm64Data);

  const primary = x64Data || arm64Data;
  merged.path = primary.path;
  merged.sha512 = primary.sha512;
  const dates = [x64Data?.releaseDate, arm64Data?.releaseDate].filter(Boolean).sort();
  merged.releaseDate = dates[dates.length - 1];
  merged.files.sort((a, b) => a.url.localeCompare(b.url));

  const yaml = toYAML(merged);
  if (out) {
    const outDir = path.dirname(out);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(out, yaml);
    console.log(`Merged manifest written to ${out}\n---\n${yaml}`);
  } else {
    process.stdout.write(yaml);
  }
}

main();
