import type { IUnzipper } from '@/scripts/zip';

const tryReadBlob = async (zip: IUnzipper, path: string): Promise<Blob | null> => {
  try {
    return (await zip.readFileAsBlobAsync(path)) ?? null;
  } catch {
    return null;
  }
};

const tryReadJson = async <T>(zip: IUnzipper, path: string): Promise<T | null> => {
  try {
    return (await zip.readFileAsJsonAsync<T>(path)) ?? null;
  } catch {
    return null;
  }
};

// ZipDir仕様で先頭 `/` 有無の両方を試す。
export class ZipSource {
  constructor(private zip: IUnzipper) {}
  async read(path: string): Promise<Blob | null> {
    return (await tryReadBlob(this.zip, path)) ?? (await tryReadBlob(this.zip, `/${path}`));
  }
}

export class CharaZipSource {
  private zipCache = new Map<string, Promise<IUnzipper | null>>();
  private rootDirCache = new Map<string, string>();

  constructor(
    private charaFileHandles: ReadonlyMap<string, FileSystemFileHandle>,
    private openZip: (file: File) => Promise<IUnzipper>,
  ) {}

  registerEntry(charaId: string, zip: IUnzipper): void {
    this.zipCache.set(charaId, Promise.resolve(zip));
    this.cacheRootDir(charaId, zip);
  }

  async read(charaId: string, path: string): Promise<Blob | null> {
    const zip = await this.getZip(charaId);
    if (!zip) return null;
    const rootDir = this.rootDirCache.get(charaId) ?? '';
    return tryReadBlob(zip, `${rootDir}${path}`);
  }

  clearCache() {
    this.zipCache.clear();
    this.rootDirCache.clear();
  }

  private getZip(charaId: string): Promise<IUnzipper | null> {
    const cached = this.zipCache.get(charaId);
    if (cached) return cached;
    const fresh = this.openCharaZip(charaId);
    this.zipCache.set(charaId, fresh);
    return fresh;
  }

  private async openCharaZip(charaId: string): Promise<IUnzipper | null> {
    const handle = this.charaFileHandles.get(charaId);
    if (!handle) return null;
    try {
      const file = await handle.getFile();
      const zip = await this.openZip(file);
      this.cacheRootDir(charaId, zip);
      return zip;
    } catch {
      return null;
    }
  }

  private cacheRootDir(charaId: string, zip: IUnzipper): void {
    const metaEntry = zip.entries.find((e) => !e.directory && e.filename.endsWith('meta.json'));
    if (metaEntry) this.rootDirCache.set(charaId, metaEntry.filename.replace('meta.json', ''));
  }
}

// 先頭 `/` 有無の両方を試す。
export class MetaZipSource {
  constructor(private zips: ReadonlyArray<IUnzipper>) {}

  async listFiles(pattern?: RegExp): Promise<Array<string>> {
    const seen = new Set<string>();
    const result = new Array<string>();
    for (const zip of this.zips) {
      for (const e of zip.entries) {
        if (e.directory || !e.filename) continue;
        const f = e.filename.replace(/^\//, '');
        if (pattern && !pattern.test(f)) continue;
        if (!seen.has(f)) {
          seen.add(f);
          result.push(f);
        }
      }
    }
    return result.toSorted();
  }

  async readJson<T>(path: string): Promise<T | null> {
    for (const zip of this.zips) {
      for (const p of [path, `/${path}`]) {
        const r = await tryReadJson<T>(zip, p);
        if (r !== null) return r;
      }
    }
    return null;
  }
}
