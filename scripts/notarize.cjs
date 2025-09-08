// Notarize macOS app after signing using electron-builder's afterSign hook (CommonJS)
// Env vars required:
// - APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID (optional)
// - NOTARIZE=true to enable

const path = require('path');
const { notarize } = require('@electron/notarize');

module.exports = async function notarizeHook(context) {
  const { electronPlatformName, appOutDir, packager } = context;

  if (process.platform !== 'darwin') return;
  if (electronPlatformName !== 'darwin') return;

  if (process.env.NOTARIZE !== 'true') {
    console.log('[notarize] Skipping notarization (NOTARIZE != true).');
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword) {
    console.warn('[notarize] APPLE_ID or APPLE_APP_SPECIFIC_PASSWORD not set; skipping.');
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`[notarize] Notarizing ${appPath}.`);

  try {
    await notarize({
      appBundleId: packager.appInfo.bundleId,
      appPath,
      appleId,
      appleIdPassword,
      teamId,
      tool: 'notarytool',
    });
    console.log('[notarize] Notarization complete.');
  } catch (err) {
    console.error('[notarize] Notarization failed:', err);
    throw err;
  }
};
