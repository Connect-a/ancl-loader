import { storage } from '@wxt-dev/storage';
import { decodeBase64Msgpack } from '@/utils/msgpack';
import type {
  AllStories,
  BattleEvent,
  BattleMain,
  BattleLimited,
  EventInfo,
  Enemy,
  InitData,
  Radio,
  Sections,
  SpecificVoice,
  Stories,
  Story,
  Voice,
} from '@/@types';
import type { Character } from '@/scripts/character';
import eventSectionMapJson from '@/repository/data/eventSectionMap.json';

export const anclDataFieldNames = [
  'token',
  'initData',
  'specificVoice',
  'characters',
  'stories',
  'enemy',
  'battleEvent',
  'battleMain',
  'battleLimited',
  'event',
  'radio',
  'voice',
] as const;

export type AnclDataField = (typeof anclDataFieldNames)[number];

// specificVoiceはbest-effort取得。完了判定に含めると一度も取れないときloadedが永久にfalseとなりナビ無効化・待ち受けカードが固着する。
export const requiredFieldNames = anclDataFieldNames.filter((k) => k !== 'specificVoice');

export interface AnclDataTypeMap {
  initData: InitData;
  specificVoice: Array<SpecificVoice>;
  characters: { chara_data: Record<string, Character> };
  stories: AllStories;
  enemy: Enemy;
  battleEvent: BattleEvent;
  battleMain: BattleMain;
  battleLimited: BattleLimited;
  event: EventInfo;
  radio: Radio;
  voice: Voice;
}

export const buildCharaEnableStidMap = (
  stories: AllStories | undefined,
  initData: InitData | undefined,
  storyAdditionalStids: ReadonlySet<number>,
): Map<number, Story> => {
  if (!stories || !initData) return new Map();
  return new Map(
    Object.entries(stories.chara?.story ?? {}).flatMap(([charaId, charaStories]) =>
      charaStories
        .filter((s) => {
          if (storyAdditionalStids.has(s.st_id)) return true;
          const like = initData.result.player_data.story.chara[charaId];
          if (!like) return false;
          return s.order <= like;
        })
        .map((s): [number, Story] => [s.st_id, s]),
    ),
  );
};

export const buildEventEnableStidMap = (
  storyList: Stories,
  sectionOpened: Record<string, string>,
  additionalStids: ReadonlySet<number>,
): Map<number, Story> =>
  new Map(
    Object.entries(storyList).flatMap(([sectionId, stories]) =>
      stories
        .filter((s) => {
          if (additionalStids.has(s.st_id)) return true;
          const opened = sectionOpened[sectionId];
          if (opened === undefined) return false;
          return s.order <= Number.parseInt(opened.split('-')[1] ?? '0');
        })
        .map((s): [number, Story] => [s.st_id, s]),
    ),
  );

export const buildMainEnableStidMap = (mainStory: Stories, openedMain: Record<string, number>): Map<number, Story> => {
  const first = Object.entries(openedMain)[0];
  if (!first) return new Map();
  const [sectionId, opened] = first;
  return new Map(
    Object.entries(mainStory).flatMap(([section, stories]) =>
      stories
        .filter((s) => {
          if (section.substring(2) < sectionId.substring(2)) return true;
          return section.substring(2) === sectionId.substring(2) && s.order <= opened;
        })
        .map((s): [number, Story] => [s.st_id, s]),
    ),
  );
};

export const isFullyUnlocked = (stories: ReadonlyArray<{ st_id: number }>, enableMap: ReadonlyMap<number, unknown>): boolean =>
  stories.length > 0 && stories.every((s) => enableMap.has(s.st_id));

export const buildSectionEventIdMap = (battleEvent: BattleEvent | undefined): Map<string, string> => {
  const map = new Map<string, string>(Object.entries(eventSectionMapJson));
  for (const v of Object.values(battleEvent ?? {})) {
    const firstDungeon = Object.values(v.dungeons)[0];
    if (firstDungeon) map.set(firstDungeon.story_section, v.event_id);
  }
  return map;
};

export type StoryRecord = { type: 'story' | 'radio'; charaId: string; charaName: string; stid: number; storyId: string };
export type VoiceRecord = { type: 'voice'; sectionId: string; chId: number; chapterId: string };
export type AdditionalRecord = StoryRecord | VoiceRecord;

const additionalKey = (r: AdditionalRecord): string => (r.type === 'voice' ? `voice:${r.chId}` : `${r.type}:${r.stid}`);

const getLocalRecord = async (keys: ReadonlyArray<string>): Promise<Record<string, unknown>> => {
  const entries = await storage.getItems(keys.map((k) => `local:${k}` as const));
  return Object.fromEntries(entries.map((e) => [e.key.slice('local:'.length), e.value]));
};

const decField = <T>(v: unknown): T | undefined => decodeBase64Msgpack<T>(typeof v === 'string' ? v : undefined);

const readStoryAdditional = (raw: unknown): { storyAdditionalData: Array<StoryRecord>; stidSet: Set<number> } => {
  const all = (Array.isArray(raw) ? raw : []) as Array<AdditionalRecord>;
  const storyAdditionalData = all.filter((x): x is StoryRecord => x.type === 'story');
  return { storyAdditionalData, stidSet: new Set(storyAdditionalData.map((x) => x.stid)) };
};

export const addAdditionalData = async (records: ReadonlyArray<AdditionalRecord>): Promise<void> => {
  if (!records.length) return;
  const cur = (await storage.getItem<Array<AdditionalRecord>>('local:additionalData')) ?? [];
  const seen = new Set(cur.map(additionalKey));
  for (const r of records) {
    const k = additionalKey(r);
    if (!seen.has(k)) {
      seen.add(k);
      cur.push(r);
    }
  }
  await storage.setItem('local:additionalData', cur);
};

export type AnclDownloadContext = {
  token: string;
  stories?: AllStories;
  initData?: InitData;
  specificVoice: Array<SpecificVoice>;
  enableStidMap: Map<number, Story>;
  storyAdditionalData: Array<StoryRecord>;
};

export const loadAnclDownloadContext = async (): Promise<AnclDownloadContext> => {
  const d = await getLocalRecord(['token', 'stories', 'initData', 'specificVoice', 'additionalData']);
  const stories = decField<AllStories>(d.stories);
  const initData = decField<InitData>(d.initData);
  const specificVoice = decField<Array<SpecificVoice>>(d.specificVoice) ?? [];
  const { storyAdditionalData, stidSet } = readStoryAdditional(d.additionalData);

  return {
    token: typeof d.token === 'string' ? d.token : '',
    stories,
    initData,
    specificVoice,
    enableStidMap: buildCharaEnableStidMap(stories, initData, stidSet),
    storyAdditionalData,
  };
};

type SectionDomainData = {
  sections: Sections;
  storyList: Stories;
  enableStidMap: Map<number, Story>;
  sectionEventIdMap?: Map<string, string>;
};

export type AnclSectionContext = {
  token: string;
  storyAdditionalData: Array<StoryRecord>;
  event: SectionDomainData;
  main: SectionDomainData;
};

export const loadAnclSectionContext = async (): Promise<AnclSectionContext> => {
  const d = await getLocalRecord(['token', 'stories', 'initData', 'battleEvent', 'additionalData']);
  const stories = decField<AllStories>(d.stories);
  const initData = decField<InitData>(d.initData);
  const battleEvent = decField<BattleEvent>(d.battleEvent);
  const { storyAdditionalData, stidSet } = readStoryAdditional(d.additionalData);

  const eventStoryList: Stories = { ...stories?.event.story, ...stories?.limited.story };
  const eventSections: Sections = { ...stories?.event.section, ...stories?.limited.section };
  const sectionOpened: Record<string, string> = { ...initData?.result.player_data.story.event, ...initData?.result.player_data.story.limited };

  return {
    token: typeof d.token === 'string' ? d.token : '',
    storyAdditionalData,
    event: {
      sections: eventSections,
      storyList: eventStoryList,
      enableStidMap: buildEventEnableStidMap(eventStoryList, sectionOpened, stidSet),
      sectionEventIdMap: buildSectionEventIdMap(battleEvent),
    },
    main: {
      sections: stories?.main.section ?? {},
      storyList: stories?.main.story ?? {},
      enableStidMap: buildMainEnableStidMap(stories?.main.story ?? {}, initData?.result.player_data.story.main ?? {}),
    },
  };
};

export const loadAnclCharacters = async (): Promise<Record<string, Character>> => {
  const raw = await storage.getItem<string>('local:characters');
  const decoded = decodeBase64Msgpack<{ chara_data: Record<string, Character> }>(raw);
  return decoded?.chara_data ?? {};
};

/** ASMR一括DLに必要なデータ一式。SWからも使えるようstorageから直接decodeする。 */
export type AnclAsmrContext = {
  token: string;
  voice?: Voice;
  initData?: InitData;
  voiceAdditional: Array<VoiceRecord>;
};

export const loadAnclAsmrContext = async (): Promise<AnclAsmrContext> => {
  const d = await getLocalRecord(['token', 'voice', 'initData', 'additionalData']);
  const all = (Array.isArray(d.additionalData) ? d.additionalData : []) as Array<AdditionalRecord>;
  return {
    token: typeof d.token === 'string' ? d.token : '',
    voice: decField<Voice>(d.voice),
    initData: decField<InitData>(d.initData),
    voiceAdditional: all.filter((x): x is VoiceRecord => x.type === 'voice'),
  };
};
