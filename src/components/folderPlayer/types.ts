export type EntryCategory = 'キャラクター' | 'ストーリーキャラ' | 'イベント' | 'メインストーリー' | 'ASMR' | 'その他';

export type SortMode = 'name' | 'date';

export type ZipEntry = {
  id: string;
  name: string;
  incomplete: boolean;
  category: EntryCategory;
  /** キャラクターZIPの識別ID。meta.jsonのidフィールドと同値であることを前提とする */
  charaId: string | null;
  fileHandle: FileSystemFileHandle;
  fileDate: Date;
};
