import { homeLayout } from '@/repository/download/homeLayout';
import type { ZipEntry, EntryCategory } from '../types';

const isCharaId = (segment: string): boolean => /^[A-Za-z0-9]{6}$/.test(segment);

const classifyEntry = (segment: string): EntryCategory => {
  // 000000=主人公 / N始まり=ストーリーキャラ（NPC）は別グループ。それ以外の6桁IDはプレイアブル
  if (isCharaId(segment)) return segment === '000000' || segment.startsWith('N') ? 'ストーリーキャラ' : 'キャラクター';
  if (segment.startsWith('イベントストーリー')) return 'イベント';
  if (segment.startsWith('メインストーリー')) return 'メインストーリー';
  if (segment.startsWith('ASMR')) return 'ASMR';
  return 'その他';
};

const createEntry = async (fileHandle: FileSystemFileHandle): Promise<ZipEntry | null> => {
  const parsed = homeLayout.parseZip(fileHandle.name);
  if (!parsed) return null;
  let file: File;
  try {
    file = await fileHandle.getFile();
  } catch {
    return null;
  }
  const { segment, name: rawName } = parsed;
  const category = classifyEntry(segment);
  return {
    id: fileHandle.name,
    name: category === 'メインストーリー' ? `${segment.slice('メインストーリー'.length)}_${rawName}` : rawName,
    incomplete: homeLayout.isIncomplete(fileHandle.name),
    category,
    // キャラ立ち絵解決（CharaResolver）用にNPC（ストーリーキャラ）も含め全6桁IDをcharaIdに保持する
    charaId: isCharaId(segment) ? segment : null,
    fileHandle,
    fileDate: new Date(file.lastModified),
  };
};

/** フォルダ全体（再帰）を走査し、`エンクリ_{charaId}_*.zip` のcharaId集合を返す（ファイル名のみ＝軽量・getFileしない） */
export const collectCharaIds = async (root: FileSystemDirectoryHandle): Promise<Set<string>> => {
  const ids = new Set<string>();
  const walk = async (dir: FileSystemDirectoryHandle) => {
    for await (const entry of dir.values()) {
      if (entry.kind === 'directory') await walk(entry as FileSystemDirectoryHandle);
      else if (entry.name.endsWith('.zip')) {
        const parsed = homeLayout.parseZip(entry.name);
        if (parsed && isCharaId(parsed.segment)) ids.add(parsed.segment);
      }
    }
  };
  await walk(root);
  return ids;
};

export const collectExistingZipNames = async (root: FileSystemDirectoryHandle): Promise<Set<string>> => {
  const names = new Set<string>();
  const walk = async (dir: FileSystemDirectoryHandle) => {
    for await (const entry of dir.values()) {
      if (entry.kind === 'directory') await walk(entry as FileSystemDirectoryHandle);
      else if (entry.name.endsWith('.zip')) names.add(entry.name);
    }
  };
  await walk(root);
  return names;
};

export const scanFolder = async (
  dir: FileSystemDirectoryHandle,
): Promise<{ entries: Array<ZipEntry>; sharedResourceHandle: FileSystemFileHandle | null }> => {
  const fileHandles: Array<FileSystemFileHandle> = [];
  const subdirs: Array<FileSystemDirectoryHandle> = [];
  let sharedResourceHandle: FileSystemFileHandle | null = null;

  for await (const handle of dir.values()) {
    if (handle.kind === 'directory') {
      if (handle.name !== homeLayout.thumbnailDir) subdirs.push(handle as FileSystemDirectoryHandle); // サムネキャッシュは走査しない
    } else {
      const fileHandle = handle as FileSystemFileHandle;
      if (homeLayout.isSharedZip(fileHandle.name)) sharedResourceHandle = fileHandle;
      else fileHandles.push(fileHandle);
    }
  }

  // getFile（createEntry）とサブディレクトリ走査を並走させ、直列awaitの積み上がりを解消
  const [made, subs] = await Promise.all([Promise.all(fileHandles.map(createEntry)), Promise.all(subdirs.map(scanFolder))]);

  const entries = made.filter((e): e is ZipEntry => e !== null);
  for (const sub of subs) {
    entries.push(...sub.entries);
    sharedResourceHandle ??= sub.sharedResourceHandle;
  }

  return { entries, sharedResourceHandle };
};
