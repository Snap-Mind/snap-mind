// Staple notarization ticket to built artifacts (DMG/ZIP and .app) - CommonJS
// Runs as electron-builder afterAllArtifactBuild hook.
// Requires NOTARIZE=true to run; otherwise it skips.

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function staple(targetPath) {
  try {
    execFileSync('xcrun', ['stapler', 'staple', '-v', targetPath], { stdio: 'inherit' });
  } catch (e) {
    console.error('[staple] Stapling failed for', targetPath, e.message);
    throw e;
  }
}

module.exports = async function stapleHook(context) {
  if (process.platform !== 'darwin') return;
  if (process.env.NOTARIZE !== 'true') {
    console.log('[staple] Skipping stapling (NOTARIZE != true).');
    return;
  }

  const { appOutDir, electronPlatformName, packager } = context;
  if (electronPlatformName !== 'darwin') return;

  // Staple the .app first
  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  if (fs.existsSync(appPath)) {
    // console.log('[staple] Stapling app:', appPath);
    staple(appPath);
  }

  // Then staple artifacts (dmg/zip)
  const { outDir } = packager;
  const files = fs.readdirSync(outDir);
  for (const f of files) {
    const full = path.join(outDir, f);
    if (f.endsWith('.dmg') || f.endsWith('.zip')) {
      // console.log('[staple] Stapling artifact:', full);
      staple(full);
    }
  }
};
