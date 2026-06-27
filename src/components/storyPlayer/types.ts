import type { StoryElement } from '@/@types';

export const SLOT_COUNT = 5;

export type StorySlot = {
  imgType: string;
  imgId: string;
  imgText: string;
  imgPos: string;
  imgPosX: string;
  imgPosY: string;
  charaType: string;
  charaEmotion: string;
  charaPos: string;
  charaSize: string;
  charaDirection: string;
  charaVoiceText: string;
  charaVoiceId: string;
  charaEmoticonId: string;
  charaEmoticonPosX: string;
  charaEmoticonPosY: string;
  charaMotionType: string;
  charaMotionTimes: string;
  charaSlideType: string;
  charaSlideDirection: string;
  effectStart: string;
  effectUnder1: string;
  effectUnder2: string;
  soundStart: string;
};

/** 元のp1_*フィールドも残るが、参照はslots[]経由とする */
export type NormalizedStoryElement = StoryElement & {
  slots: StorySlot[];
};

type SlotLayout = {
  isSd: boolean;
  size: number;
  direction: string;
  pos: string;
  posX: number;
  posY: number;
};
/** URL未解決。`CharaSlot`はURL解決済みの最終形 */
export type CharaSlotSpec = SlotLayout & { charaId: string; emotion: string; visible: boolean };
export type CharaSlot = SlotLayout & { url: string | null; visible: boolean };
export type EmoticonInfo = { url: string | null; posX: number; posY: number };

const defaultLayout = (): SlotLayout => ({
  isSd: false,
  size: 1,
  direction: '1',
  pos: '3',
  posX: 0,
  posY: 0,
});
export const defaultSlotSpec = (): CharaSlotSpec => ({ ...defaultLayout(), charaId: '', emotion: '1', visible: false });
export const defaultSlot = (): CharaSlot => ({ ...defaultLayout(), url: null, visible: false });
export const defaultEmoticon = (): EmoticonInfo => ({ url: null, posX: 0, posY: 0 });

const SIDE_TABS = ['sd', 'standing', 'gravure', 'other'] as const;
export type SideTab = (typeof SIDE_TABS)[number];
export const isSideTab = (s: string): s is SideTab => (SIDE_TABS as ReadonlyArray<string>).includes(s);

export type Panel = 'volume' | 'voice' | 'audioControls';

export type FrameResources = {
  bgUrl: string | null;
  movieUrl: string | null;
  charaSlots: Array<CharaSlot>;
  bgmUrl: string | null;
  seUrls: Array<string | null>;
  emoticonSlots: Array<EmoticonInfo>;
};
