import { range } from '@/utils/array';

const ANCL_BASE = 'https://ancl.jp/img/game';

export const eventAssets = {
  image: (eventId: string, file: string) => `${ANCL_BASE}/event/${eventId}/image/${file}`,
  voice: (eventId: string, file: string) => `${ANCL_BASE}/event/${eventId}/voice/${file}`,
  movie: (eventId: string, file: string) => `${ANCL_BASE}/event/${eventId}/movie/${file}`,
  thumb: (eventId: string, file: string) => `${ANCL_BASE}/event/${eventId}/thumb/${file}`,
  // event ID不要
  sectionThumb: (sectionId: string) => `${ANCL_BASE}/event/section/${sectionId}.jpg`,
  shopImage: (sectionId: string) => `${ANCL_BASE}/shop/${sectionId}_mod.jpg`,
  storySource: (eventId: string, storyId: string) => `${ANCL_BASE}/event/${eventId}/${storyId}.json`,
  // chapterIdはeventIdと同等扱い
  asmrHtml: (chapterId: string) => `${ANCL_BASE}/event/${chapterId}/${chapterId.toLowerCase()}.html`,
};

export const eventMetaUrl = (eventId: string, filename: string) => `${ANCL_BASE}/asset/event/${eventId}/${filename}`;

// canonical / ZIP / Web URLが同じfilenameを共有する静的アセット
export type StaticAsset = {
  canonicalPrefix: string;
  zipFolder: string;
  /** Webに存在しなければnull */
  webBase: string | null;
};

export const staticAssets = {
  bg: { canonicalPrefix: 'bg/', zipFolder: 'bg', webBase: `${ANCL_BASE}/asset/bg/story/` },
  bgm: { canonicalPrefix: 'bgm/', zipFolder: 'bgm', webBase: `${ANCL_BASE}/sound/bgm/` },
  se: { canonicalPrefix: 'se/', zipFolder: 'se', webBase: `${ANCL_BASE}/sound/se/` },
  emo: { canonicalPrefix: 'emo/', zipFolder: 'emo', webBase: `${ANCL_BASE}/asset/emo/` },
  // event 004V配下のシーン画像専用。他イベント由来は取れない
  sceneImg004V: { canonicalPrefix: 'scene_img/', zipFolder: 'scene_img', webBase: eventAssets.image('004V', '') },
} as const satisfies Record<string, StaticAsset>;

// ZIPは無接頭辞、Web URLは `{charaId}_` 接頭辞付き
export const charaImage = {
  webUrlOf: (charaId: string, filename: string) => `${ANCL_BASE}/chara/${charaId}/graphic/${charaId}_${filename}`,
};

export const charaVoice = {
  webUrlOf: (charaId: string, voiceId: string) => `${ANCL_BASE}/chara/${charaId}/voice/${voiceId}.m4a`,
};

export const charaSpine = {
  webUrlOf: (charaId: string, kind: 'spine_n' | 'spine_w', file: string) => `${ANCL_BASE}/chara/${charaId}/${kind}/${file}`,
};

// chara/配下とは別空間の `asset/radio/…`
export const radio = {
  spineUrlOf: (id: string, file: string) => `${ANCL_BASE}/asset/radio/spine/${id}/${file}`,
  listUrl: `${ANCL_BASE}/asset/radio/list.jpg`,
  programUrl: (programId: string) => `${ANCL_BASE}/asset/radio/pg/${programId}.m4a`,
};

// 別パスのskeletonが増えたらunionと表に追加すればTSが登録漏れを検出する
export type SkeletonKind = 'radio';
export const skeletonSpineUrlOf: Record<SkeletonKind, (id: string, file: string) => string> = {
  radio: radio.spineUrlOf,
};

// graphicは `{img}_` 接頭辞付き、spineは無接頭辞
export const monster = {
  graphicUrlOf: (img: string, file: string) => `${ANCL_BASE}/monster/${img}/graphic/${img}_${file}`,
  spineUrlOf: (img: string, file: string) => `${ANCL_BASE}/monster/${img}/spine/${file}`,
};

export const SKELETON_EXTS = ['.atlas', '.json', '.png'] as const;

// sd_24〜26はconsumer側でliteral個別probeするため範囲定数は持たない
export const sd01To23Suffixes: ReadonlyArray<string> = range(1, 23).map((i) => `sd_${String(i).padStart(2, '0')}.png`);
export const sd51To56Suffixes: ReadonlyArray<string> = range(51, 56).map((i) => `sd_${String(i).padStart(2, '0')}.png`);
