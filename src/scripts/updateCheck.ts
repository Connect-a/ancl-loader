import { browser } from 'wxt/browser';

const PACKAGE_JSON_URL = 'https://raw.githubusercontent.com/Connect-a/ancl-loader/master/package.json';
const RELEASE_URL = 'https://github.com/Connect-a/ancl-loader/releases/latest';

export type UpdateInfo = { latestVersion: string; releaseUrl: string };

const compareSemver = (a: string, b: string): number => {
  const pa = a.split('.').map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

export const checkForUpdate = async (): Promise<UpdateInfo | null> => {
  try {
    const res = await fetch(PACKAGE_JSON_URL, { cache: 'no-cache' });
    if (!res.ok) return null;
    const json = (await res.json()) as { version?: string };
    const latestVersion = json.version;
    if (!latestVersion) return null;

    const current = browser.runtime.getManifest().version;
    return compareSemver(latestVersion, current) > 0 ? { latestVersion, releaseUrl: RELEASE_URL } : null;
  } catch (e: unknown) {
    console.error('ancl: checkForUpdate failed', e);
    return null;
  }
};
