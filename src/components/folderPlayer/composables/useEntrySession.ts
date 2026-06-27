import { onScopeDispose, ref, shallowRef } from 'vue';
import { Unzipper, type IUnzipper } from '@/scripts/zip';
import { BlobUrlRegistry } from '@/scripts/blobUrlRegistry';
import { buildEntryManifest, type Episode, type EntryManifest } from '@/scripts/resolver/entryManifest';
import type { ZipEntry } from '../types';

async function loadStoryThumbnails(
  zip: IUnzipper,
  fileNames: ReadonlyArray<string>,
  episodes: ReadonlyArray<Episode>,
  registry: BlobUrlRegistry,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  await Promise.all(
    episodes.map(async (e) => {
      if (!e.img) return;
      const path = fileNames.find((f) => f.endsWith(`/${e.img}_rthumb.jpg`)) ?? fileNames.find((f) => f.endsWith(`/${e.img}_sthumb.jpg`));
      if (!path) return;
      try {
        const blob = await zip.readFileAsBlobAsync(path);
        if (blob) result.set(e.folderName, registry.create(blob));
      } catch {
        // skip
      }
    }),
  );
  return result;
}

export function useEntrySession() {
  const entryZip = shallowRef<IUnzipper | null>(null);
  const manifest = shallowRef<EntryManifest | null>(null);
  const loading = ref(false);
  const error = ref('');
  const thumbnails = ref<ReadonlyMap<string, string>>(new Map());

  let currentEntryId = '';
  const thumbnailRegistry = new BlobUrlRegistry();

  const clear = () => {
    currentEntryId = '';
    entryZip.value = null;
    manifest.value = null;
    error.value = '';
    thumbnails.value = new Map();
    thumbnailRegistry.revokeAll();
  };

  /** サムネはバックグラウンドで埋める */
  const selectEntry = async (entry: ZipEntry) => {
    if (currentEntryId === entry.id) return;
    clear();
    currentEntryId = entry.id;
    loading.value = true;
    try {
      const zip = await Unzipper.open(await entry.fileHandle.getFile());
      const m = await buildEntryManifest(zip);
      manifest.value = m;
      entryZip.value = zip;
      const fileNames = zip.entries.filter((x) => !x.directory && x.filename).map((x) => x.filename);
      void loadStoryThumbnails(zip, fileNames, m.episodes, thumbnailRegistry).then((thumbs) => {
        if (currentEntryId !== entry.id) return; // 切替後の遅延到着を捨てる
        thumbnails.value = thumbs;
      });
    } catch (e) {
      error.value = `ZIP読み込みエラー: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      loading.value = false;
    }
  };

  onScopeDispose(() => {
    currentEntryId = ''; // 未完了の loadStoryThumbnails .then() を（ガードで）弾く
    thumbnailRegistry.revokeAll();
  });

  return { entryZip, manifest, loading, error, thumbnails, selectEntry, clear };
}
