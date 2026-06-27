import { SLOT_COUNT, defaultSlotSpec, type CharaSlotSpec, type NormalizedStoryElement } from '../types';
import sceneImgsMaster from '@/repository/data/storyResources.json';
import { assets, type Asset } from '@/scripts/resolver/asset';
import { CHARA_TYPE_SD, CHARA_TYPE_HIDE, ZOOM_NONE, SLOT_POS_CENTER, isBgCleared, hasImgId, isCharaDisplaySlot } from './storySource';

export type FrameState = {
  bg: Asset | null;
  /** 拡張子なし。'' は停止 */
  bgmId: string;
  slotSpecs: Array<CharaSlotSpec>;
  zoom: string;
  zoomPos: string;
};

const DEFAULT_FRAME: FrameState = {
  bg: null,
  bgmId: '',
  slotSpecs: Array.from({ length: SLOT_COUNT }, defaultSlotSpec),
  zoom: ZOOM_NONE,
  zoomPos: SLOT_POS_CENTER,
};

const sceneImgSet = new Set(sceneImgsMaster.sceneImgs);

/** 差分エンコードを累積して各フレームの表示状態にする。eventIdはstory-local背景の解決に使う */
export function buildFrameStates(elements: Array<NormalizedStoryElement>, eventId: string): Array<FrameState> {
  const frames = new Array<FrameState>(elements.length);

  let bg: Asset | null = null;
  let bgmId = '';
  let zoom = ZOOM_NONE;
  let zoomPos = SLOT_POS_CENTER;
  const slotSpecs: Array<CharaSlotSpec> = Array.from({ length: SLOT_COUNT }, defaultSlotSpec);

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!;

    // '' / '1' はクリア、他の値で切替、undefinedは前フレーム継続
    if (el.bg_img_text) {
      bg = sceneImgSet.has(el.bg_img_text) ? assets.sceneImg(el.bg_img_text) : assets.storyImage(eventId, el.bg_img_text);
    } else if (isBgCleared(el.bg_img_id)) {
      bg = null;
    } else if (el.bg_img_id) {
      bg = assets.bg(`${el.bg_img_id}.jpg`);
    }

    // '' / '1' は停止、他の値は新規BGM、undefinedは前フレーム継続
    if (isBgCleared(el.bg_bgm)) {
      bgmId = '';
    } else if (el.bg_bgm) {
      bgmId = el.bg_bgm;
    }

    if (el.zoom) zoom = el.zoom;
    if (el.zoom_pos) zoomPos = el.zoom_pos;

    for (let p = 0; p < SLOT_COUNT; p++) {
      const s = el.slots[p]!;
      if (hasImgId(s.imgId) && isCharaDisplaySlot(s.imgType, s.charaType)) {
        const slot = slotSpecs[p]!;
        slot.charaId = s.imgId;
        slot.isSd = s.charaType === CHARA_TYPE_SD;
        if (s.charaEmotion) slot.emotion = s.charaEmotion;
        if (s.charaSize) slot.size = parseFloat(s.charaSize) || 1;
        if (s.charaDirection) slot.direction = s.charaDirection;
        if (s.imgPos) slot.pos = s.imgPos;
        if (s.imgPosX) slot.posX = parseFloat(s.imgPosX) || 0;
        if (s.imgPosY) slot.posY = parseFloat(s.imgPosY) || 0;
        slot.visible = true;
      } else if (s.charaType === CHARA_TYPE_HIDE) {
        slotSpecs[p] = defaultSlotSpec();
      }
    }

    frames[i] = {
      bg,
      bgmId,
      zoom,
      zoomPos,
      slotSpecs: slotSpecs.map((s) => ({ ...s })),
    };
  }

  return frames;
}

export function getFrameState(frames: ReadonlyArray<FrameState>, index: number): FrameState {
  return frames[index] ?? DEFAULT_FRAME;
}
