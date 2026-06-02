import { execSync } from 'child_process';

const REGISTRY_KEYS = [
  'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment',
  'HKCU\\Environment',
];

const REG_PATH_PATTERN = /Path\s+REG_(?:EXPAND_)?SZ\s+(.+)/i;

export function readRegistryPath(registryKey: string): string {
  const output = execSync(`reg query "${registryKey}" /v Path`, {
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true,
  });
  const match = output.match(REG_PATH_PATTERN);
  if (!match) return '';
  return match[1].trim().replace(/%([^%]+)%/g, (_, varName: string) =>
    process.env[varName] || `%${varName}%`
  );
}

export default function fixPathWindows(): string[] {
  if (process.platform !== 'win32') return [];

  const registryPaths: string[] = [];
  for (const key of REGISTRY_KEYS) {
    try {
      const value = readRegistryPath(key);
      if (value) {
        registryPaths.push(...value.split(';').filter(Boolean));
      }
    } catch {
      // Individual key read failure is expected in some environments
    }
  }

  if (registryPaths.length === 0) return [];

  const currentPaths = (process.env.PATH || '').split(';').filter(Boolean);
  const seen = new Set(currentPaths.map((p) => p.toLowerCase()));
  const newPaths = registryPaths.filter((p) => {
    const lower = p.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  if (newPaths.length > 0) {
    process.env.PATH = [...currentPaths, ...newPaths].join(';');
  }

  return newPaths;
}
