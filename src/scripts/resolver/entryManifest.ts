import type { IUnzipper } from '@/scripts/zip';
import { ALL_AGES, getStoryFolderName, type StoryListMeta } from '@/repository/download/storyMeta';

export type Episode = {
  /** story/{folderName}/ のフォルダ名 */
  folderName: string;
  sourcePath: string;
  /** エピソード識別コード。event ではweb URLのeventId、charaでは連番コード。story資産解決キー */
  img: string;
  isLoveScene: boolean;
  playable: boolean;
};

/** ダウンロード済みエントリ(ZIP) */
export type EntryManifest = {
  charaId: string | null;
  name: string;
  group: string;
  rootDir: string;
  episodes: ReadonlyArray<Episode>;
  byImg: ReadonlyMap<string, Episode>;
};

/** story/{folderName}/ 配下のアセット種別サブフォルダ */
export type StoryAssetCategory = 'voice' | 'image' | 'movie' | 'bg' | 'bgm';

const isStoryListPath = (path: string): boolean => /(?:^|\/)story\/list\.json$/.test(path);

export async function buildEntryManifest(zip: IUnzipper): Promise<EntryManifest> {
  const files = zip.entries.filter((e) => !e.directory && e.filename).map((e) => e.filename);

  const metaPath = files.find((f) => f.endsWith('meta.json'));
  const meta = metaPath ? await zip.readFileAsJsonAsync<{ id?: string; name?: string; profile?: { group?: string } }>(metaPath) : null;

  const listPath = files.find(isStoryListPath);
  const rootDir = listPath ? listPath.replace(/story\/list\.json$/, '') : '';
  const list = listPath ? ((await zip.readFileAsJsonAsync<Array<StoryListMeta>>(listPath)) ?? []) : [];
  const sourcePaths = files.filter((f) => f.includes('source.json'));

  const fromList = list
    .toSorted((a, b) => a.order - b.order)
    .map((s): Episode => {
      const folderName = getStoryFolderName(s);
      const sourcePath = sourcePaths.find((sp) => sp.endsWith(`${folderName}/source.json`)) ?? '';
      return { folderName, sourcePath, img: s.img, isLoveScene: s.adult_type !== ALL_AGES, playable: !!sourcePath };
    });
  // list.json無し（旧DL等）はsource.json直列挙にフォールバック
  const fromSources = sourcePaths.map((sp): Episode => {
    const folderName =
      sp
        .replace(/\/source\.json$/, '')
        .split('/')
        .pop() ?? '';
    return { folderName, sourcePath: sp, img: '', isLoveScene: false, playable: true };
  });
  const episodes = fromList.length ? fromList : fromSources;

  return {
    charaId: meta?.id ?? null,
    name: meta?.name ?? '',
    group: meta?.profile?.group ?? '',
    rootDir,
    episodes,
    byImg: new Map(episodes.filter((e) => e.img).map((e) => [e.img, e])),
  };
}

/** manifestからstoryアセットのZIP内パスを組む。該当フォルダ無しはnull */
export const storyAssetPath = (m: EntryManifest, img: string, category: StoryAssetCategory, file: string): string | null => {
  const folderName = m.byImg.get(img)?.folderName;
  return folderName ? `${m.rootDir}story/${folderName}/${category}/${file}` : null;
};
