// 先頭 `_` でファイラのソート上位に固定する
const ZIP_PREFIX = 'エンクリ_';
const INCOMPLETE_MARK = '_(未完)';
const SHARED_ZIP = `${ZIP_PREFIX}共有リソース.zip`;
const ZIP_PATTERN = new RegExp(`^${ZIP_PREFIX}([^_]+)_(.+?)(?:${INCOMPLETE_MARK.replace(/[()]/g, '\\$&')})?\\.zip$`);

export const homeLayout = {
  charaDir: (complete: boolean): string => (complete ? '_キャラ' : '_キャラ（未開放あり）'),
  sharedDir: '_共有リソース',
  storyCharaDir: '_ストーリーキャラ',
  eventDir: '_イベント',
  mainDir: '_メイン',
  asmrDir: '_ASMR',
  thumbnailDir: '.thumbnails',

  charaZip: (charaId: string, name: string, complete: boolean): string => `${ZIP_PREFIX}${charaId}_${name}${complete ? '' : INCOMPLETE_MARK}.zip`,
  sharedZip: SHARED_ZIP,
  eventStoryZip: (name: string, complete: boolean): string => `${ZIP_PREFIX}イベントストーリー_${name}${complete ? '' : INCOMPLETE_MARK}.zip`,
  mainStoryZip: (chapter: string, name: string, complete: boolean): string => `${ZIP_PREFIX}${chapter}_${name}${complete ? '' : INCOMPLETE_MARK}.zip`,
  asmrZip: (name: string): string => `${ZIP_PREFIX}ASMR_${name}.zip`,

  isSharedZip: (filename: string): boolean => filename === SHARED_ZIP,
  isIncomplete: (filename: string): boolean => filename.includes(INCOMPLETE_MARK),
  parseZip: (filename: string): { segment: string; name: string } | null => {
    const m = filename.match(ZIP_PATTERN);
    return m ? { segment: m[1]!, name: m[2]! } : null;
  },
} as const;
