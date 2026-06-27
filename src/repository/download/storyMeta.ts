export type StoryListMeta = {
  order: number;
  chapter: string;
  name: string;
  img: string;
  adult_type: number;
};

/** source.jsonにevent_id等のメタが無いため、フォルダ名がlist.json entryとの照合keyになる */
export const getStoryFolderName = (s: Pick<StoryListMeta, 'order' | 'chapter' | 'name'>) =>
  `${s.order.toString().padStart(2, '0')}_${s.chapter}_${s.name}`;

/** adult_typeの全年齢区分値。1以外はラブシーン含有 (rthumbが存在する) */
export const ALL_AGES = 1;
