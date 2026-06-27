import { ref, onScopeDispose } from 'vue';
import { Unzipper } from '@/scripts/zip';
import { homeLayout } from '@/repository/download/homeLayout';
import type { ZipEntry } from '../types';

/** 未登録キー=未要求(idle) */
type ThumbState = { status: 'loading' } | { status: 'loaded'; url: string } | { status: 'none' };

const pickThumbnailFilename = (filenames: ReadonlyArray<string>): string | undefined =>
  filenames.find((f) => f === 'ss.png' || f.endsWith('/ss.png')) ??
  filenames.find((f) => /^[^/]+\/ES[^/]*\.jpg$/i.test(f)) ??
  filenames.find((f) => f === 'logo.png' || f.endsWith('/logo.png')) ??
  filenames.find((f) => /^[^/]+\/[^/]+\.jpg$/i.test(f)) ??
  filenames.find((f) => /_rthumb\.jpg$/i.test(f)) ??
  filenames.find((f) => /_nthumb\.jpg$/i.test(f)) ??
  filenames.find((f) => /_sthumb\.jpg$/i.test(f));

const toWebpThumb = async (blob: Blob): Promise<Blob> => {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, 128 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext('2d')?.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas.convertToBlob({ type: 'image/webp', quality: 0.7 });
};

const extractEntryThumb = async (entry: ZipEntry): Promise<{ blob: Blob; cacheable: boolean } | null> => {
  try {
    const u = await Unzipper.open(await entry.fileHandle.getFile());
    const name = pickThumbnailFilename(u.entries.filter((e) => !e.directory).map((e) => e.filename));
    if (!name) return null;
    const raw = await u.readFileAsBlobAsync(name);
    if (!raw) return null;
    try {
      return { blob: await toWebpThumb(raw), cacheable: true };
    } catch {
      return { blob: raw, cacheable: false };
    }
  } catch {
    return null;
  }
};

const cacheNameOf = (entry: ZipEntry): string => `${entry.id.replace(/\.zip$/i, '')}.webp`;

const writeThumbCache = async (cacheDir: FileSystemDirectoryHandle, name: string, blob: Blob): Promise<void> => {
  try {
    const fh = await cacheDir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
  } catch {
    // 無視
  }
};

const readThumbCache = async (cacheDir: FileSystemDirectoryHandle, name: string): Promise<Blob | null> => {
  try {
    const blob = await (await cacheDir.getFileHandle(name)).getFile();
    if (blob.size >= 100) return blob;
    try {
      await cacheDir.removeEntry(name);
    } catch {
      // 無視
    }
    return null;
  } catch {
    return null;
  }
};

export function createThumbnailLoader() {
  const states = ref(new Map<string, ThumbState>());
  const cacheEnabled = ref(true);

  let lastRoot: FileSystemDirectoryHandle | null = null;
  let cacheDir: FileSystemDirectoryHandle | null = null;
  let cachedNames = new Set<string>();
  let ready: Promise<void> = Promise.resolve();

  // ZIP展開だけ並列制限する計数セマフォ
  const CONCURRENCY = 6;
  let active = 0;
  const waiters = new Array<() => void>();
  const acquire = (): Promise<void> => new Promise((res) => (active < CONCURRENCY ? (active++, res()) : waiters.push(res)));
  const release = (): void => {
    const w = waiters.shift();
    if (w) w();
    else active--;
  };

  const setLoaded = (id: string, blob: Blob) => states.value.set(id, { status: 'loaded', url: URL.createObjectURL(blob) });

  const urlOf = (id: string): string | undefined => {
    const s = states.value.get(id);
    return s?.status === 'loaded' ? s.url : undefined;
  };

  const reset = () => {
    for (const s of states.value.values()) if (s.status === 'loaded') URL.revokeObjectURL(s.url);
    states.value.clear();
  };

  const refreshCacheDir = (): Promise<void> => {
    ready = (async () => {
      cacheDir = null;
      cachedNames = new Set();
      if (cacheEnabled.value && lastRoot) {
        cacheDir = await lastRoot.getDirectoryHandle(homeLayout.thumbnailDir, { create: true });
        for await (const name of cacheDir.keys()) cachedNames.add(name);
      }
    })();
    return ready;
  };

  const prepare = (entries: ReadonlyArray<ZipEntry>, root: FileSystemDirectoryHandle | null): Promise<void> => {
    lastRoot = root;
    const ids = new Set(entries.map((e) => e.id));
    for (const [id, s] of states.value) {
      if (ids.has(id)) continue;
      if (s.status === 'loaded') URL.revokeObjectURL(s.url);
      states.value.delete(id);
    }
    return refreshCacheDir();
  };

  const enableCache = async (): Promise<void> => {
    cacheEnabled.value = true;
    await refreshCacheDir();
  };

  /** 無効化＋.thumbnails削除。表示中サムネ(in-memory)は保持。 */
  const disableCache = async (): Promise<void> => {
    cacheEnabled.value = false;
    if (lastRoot) await lastRoot.removeEntry(homeLayout.thumbnailDir, { recursive: true }).catch(() => {});
    await refreshCacheDir();
  };

  const ensureThumbnail = (entry: ZipEntry): void => {
    if (states.value.has(entry.id)) return;
    states.value.set(entry.id, { status: 'loading' });
    const cacheName = cacheNameOf(entry);
    void (async () => {
      await ready;
      if (cacheDir && cachedNames.has(cacheName)) {
        const blob = await readThumbCache(cacheDir, cacheName);
        if (blob) {
          setLoaded(entry.id, blob);
          return;
        }
      }
      await acquire();
      try {
        const result = await extractEntryThumb(entry);
        if (!result) {
          states.value.set(entry.id, { status: 'none' });
          return;
        }
        if (result.cacheable && cacheDir) await writeThumbCache(cacheDir, cacheName, result.blob);
        setLoaded(entry.id, result.blob);
      } finally {
        release();
      }
    })();
  };

  onScopeDispose(reset);

  return { urlOf, prepare, ensureThumbnail, cacheEnabled, enableCache, disableCache };
}
