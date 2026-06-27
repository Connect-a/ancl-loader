// プレイヤー側のsource.json読解。download側（repository/download）は別系統で独自に解釈する
import type { StoryElement } from '@/@types';
import { SLOT_COUNT, type StorySlot, type NormalizedStoryElement } from '../types';

/** ゲームは数値コード（img_type/chara_type/choice_flg等）をnumberで返すためstring|number混在 */
export type RawStoryElement = { [K in keyof StoryElement]: StoryElement[K] | number };

const stringifyFields = (el: RawStoryElement): StoryElement =>
  Object.fromEntries(Object.entries(el).map(([k, v]) => [k, v == null ? '' : String(v)])) as unknown as StoryElement;

const slotRaw = (el: StoryElement, p: number, name: string): string => el[`p${p + 1}_${name}` as keyof StoryElement] ?? '';

const normalizeSlot = (el: StoryElement, p: number): StorySlot => ({
  imgType: slotRaw(el, p, 'img_type'),
  imgId: slotRaw(el, p, 'img_id'),
  imgText: slotRaw(el, p, 'img_text'),
  imgPos: slotRaw(el, p, 'img_pos'),
  imgPosX: slotRaw(el, p, 'img_pos_x'),
  imgPosY: slotRaw(el, p, 'img_pos_y'),
  charaType: slotRaw(el, p, 'chara_type'),
  charaEmotion: slotRaw(el, p, 'chara_emotion'),
  charaPos: slotRaw(el, p, 'chara_pos'),
  charaSize: slotRaw(el, p, 'chara_size'),
  charaDirection: slotRaw(el, p, 'chara_direction'),
  charaVoiceText: slotRaw(el, p, 'chara_voice_text'),
  charaVoiceId: slotRaw(el, p, 'chara_voice_id'),
  charaEmoticonId: slotRaw(el, p, 'chara_emoticon_id'),
  charaEmoticonPosX: slotRaw(el, p, 'chara_emoticon_pos_x'),
  charaEmoticonPosY: slotRaw(el, p, 'chara_emoticon_pos_y'),
  charaMotionType: slotRaw(el, p, 'chara_motion_type'),
  charaMotionTimes: slotRaw(el, p, 'chara_motion_times'),
  charaSlideType: slotRaw(el, p, 'chara_slide_type'),
  charaSlideDirection: slotRaw(el, p, 'chara_slide_direction'),
  effectStart: slotRaw(el, p, 'effect_start'),
  effectUnder1: slotRaw(el, p, 'effect_under1'),
  effectUnder2: slotRaw(el, p, 'effect_under2'),
  soundStart: slotRaw(el, p, 'sound_start'),
});

export const normalizeElements = (raw: Array<RawStoryElement>): Array<NormalizedStoryElement> =>
  raw.map((rawEl) => {
    const el = stringifyFields(rawEl);
    return { ...el, slots: Array.from({ length: SLOT_COUNT }, (_, p) => normalizeSlot(el, p)) };
  });

// p{n}_img_type
const IMG_TYPE_CHARA = '3';

// p{n}_chara_type
export const CHARA_TYPE_SD = '4';
const CHARA_TYPE_STANDING = '5';
export const CHARA_TYPE_HIDE = '1';

// p{n}_chara_direction（'2' で左右反転）
export const DIRECTION_FLIP = '2';

// zoom（'1' 以下はズームなし）/ zoom_pos・スロット位置の中央
export const ZOOM_NONE = '1';
export const SLOT_POS_CENTER = '3';

// text_size（'3' のみ2倍。'2' は本来縮小だが等倍扱い）
const TEXT_SIZE_LARGE = '3';

// 「なし/クリア」判定。センチネル値がフィールド毎に異なる（'1'/'0'/''）点をここで吸収する
export const isBgCleared = (id: string): boolean => id === '1' || id === ''; // bg_img_id / bg_bgm
export const hasImgId = (imgId: string): boolean => !!imgId && imgId !== '1'; // p{n}_img_id（'1'/空 = 画像なし）
export const isNoSe = (id: string): boolean => !id || id === '1'; // sound_start / bg_sound_start
export const isNoEmoticon = (id: string): boolean => !id || id === '0'; // chara_emoticon_id
export const isNoVoice = (id: string): boolean => !id || id === '0'; // chara_voice_id
export const isNoChoice = (flg: string): boolean => !flg || flg === '0'; // choice_flg

export const isCharaDisplaySlot = (imgType: string, charaType: string): boolean =>
  imgType === IMG_TYPE_CHARA && (charaType === CHARA_TYPE_SD || charaType === CHARA_TYPE_STANDING);

export const textSizeFactor = (textSize: string): number => (textSize === TEXT_SIZE_LARGE ? 2 : 1);
