import { computed, ref, shallowRef } from 'vue';
import { Unzipper, type IUnzipper } from '@/scripts/zip';
import { homeDirHandle } from '@/scripts/directoryHandleStore';
import { scanFolder, collectCharaIds } from '@/components/folderPlayer/utils/folderScanner';
import { bulkDownloadStateItem, isBulkDownloadActive, bulkDownloadStats } from '@/scripts/bulkDownloadState';
import type { ZipEntry } from '@/components/folderPlayer/types';

type PermState = 'granted' | 'prompt' | 'denied' | 'unsupported';

const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
const _handle = shallowRef<FileSystemDirectoryHandle | null>(null);
const permission = ref<PermState>(supported ? 'prompt' : 'unsupported');
const dirName = computed(() => _handle.value?.name ?? '');

const charaIds = ref<Set<string>>(new Set());
const entries = ref<Array<ZipEntry>>([]);
const sharedZip = shallowRef<IUnzipper | null>(null);
const charaHandleMap = shallowRef<Map<string, FileSystemFileHandle>>(new Map());
const isScanning = ref(false);
const error = ref('');

let _entriesLoaded = false;

const refreshPermission = async () => {
  permission.value = _handle.value ? await _handle.value.queryPermission({ mode: 'readwrite' }) : supported ? 'prompt' : 'unsupported';
};

const usableRoot = computed(() => (_handle.value && permission.value === 'granted' ? _handle.value : null));

// presenceのみの軽量スキャン（getFileしない）。安いので毎回走らせる。
const scanIndex = async (): Promise<void> => {
  const root = usableRoot.value;
  if (!root) {
    charaIds.value = new Set();
    return;
  }
  try {
    charaIds.value = await collectCharaIds(root);
  } catch {
    charaIds.value = new Set();
  }
};

const rescan = () => {
  _entriesLoaded = false;
  void scanIndex();
};

let _loadHandleOnce: Promise<void> | null = null;
const loadHandle = () => {
  _loadHandleOnce ??= (async () => {
    try {
      _handle.value = await homeDirHandle.get();
      await refreshPermission();
    } catch {
      /* IndexedDB利用不可 */
    }
    void scanIndex();
  })();
  return _loadHandleOnce;
};

const buildResolvers = async (scan: Awaited<ReturnType<typeof scanFolder>>) => {
  sharedZip.value = null;
  if (scan.sharedResourceHandle) {
    try {
      sharedZip.value = await Unzipper.open(await scan.sharedResourceHandle.getFile());
    } catch {
      /* 共有リソースなしで続行 */
    }
  }
  const map = new Map<string, FileSystemFileHandle>();
  for (const e of scan.entries) if (e.charaId) map.set(e.charaId, e.fileHandle);
  charaHandleMap.value = map;
};

const loadEntries = async (): Promise<void> => {
  await loadHandle();
  const root = usableRoot.value;
  if (!root) {
    entries.value = [];
    return;
  }
  if (_entriesLoaded) return;
  isScanning.value = true;
  error.value = '';
  try {
    const scan = await scanFolder(root);
    if (usableRoot.value !== root) return; // スキャン中に_handleが変わったら結果を捨てる
    entries.value = scan.entries;
    _entriesLoaded = true;
    await buildResolvers(scan);
    if (!scan.entries.length) error.value = 'エンクリのダウンロードZIPが見つかりませんでした';
  } catch (e) {
    error.value = `フォルダ読み込みに失敗しました: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    isScanning.value = false;
  }
};

const reload = async (): Promise<void> => {
  _entriesLoaded = false;
  await loadEntries();
};

const pickDirectory = async (): Promise<FileSystemDirectoryHandle | null> => {
  if (!supported) return null;
  try {
    return await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch {
    return null;
  }
};

const select = async (): Promise<boolean> => {
  const picked = await pickDirectory();
  if (!picked) return false;
  _handle.value = picked;
  permission.value = await picked.queryPermission({ mode: 'readwrite' });
  await homeDirHandle.save(picked);
  rescan();
  return true;
};

const requestPermission = async (): Promise<boolean> => {
  if (!_handle.value) return false;
  permission.value = await _handle.value.requestPermission({ mode: 'readwrite' });
  if (permission.value === 'granted') rescan();
  return permission.value === 'granted';
};

const clear = async () => {
  try {
    await homeDirHandle.clear();
  } catch {
    /* noop */
  }
  _handle.value = null;
  permission.value = supported ? 'prompt' : 'unsupported';
  charaIds.value = new Set();
  entries.value = [];
  sharedZip.value = null;
  charaHandleMap.value = new Map();
  isScanning.value = false;
  error.value = '';
  _entriesLoaded = false;
};

let prevActive = false;
let prevDone = 0;
bulkDownloadStateItem.watch((s) => {
  const active = s ? isBulkDownloadActive(s.phase) : false;
  const done = s ? bulkDownloadStats(s.items).done : 0;
  if ((prevActive && !active) || done > prevDone) rescan();
  prevActive = active;
  prevDone = done;
});

export function useHomeDir() {
  void loadHandle();
  return {
    supported,
    permission,
    dirName,
    usableRoot,
    charaIds,
    entries,
    sharedZip,
    charaHandleMap,
    isScanning,
    error,
    pickDirectory,
    select,
    requestPermission,
    clear,
    loadEntries,
    reload,
  };
}
