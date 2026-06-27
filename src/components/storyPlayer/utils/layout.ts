import type { CharaSlot, EmoticonInfo } from '../types';
import { DIRECTION_FLIP } from './storySource';

const GAME_W = 1280;
const GAME_H = 720;

const gx = (px: number) => `${(px / GAME_W) * 100}%`;
const gy = (px: number) => `${(px / GAME_H) * 100}%`;

const SLOT_X: Record<string, number> = { '1': 10, '2': 30, '3': 50, '4': 70, '5': 90 };

const STAND_ANCHOR_Y = 80;
const SD_ANCHOR_Y = 60;

export const DEFAULT_ZOOM = { scale: 1, originX: 50, originY: 50 };

export const computeZoom = (zoom: string, zoomPos: string) => {
  const val = parseInt(zoom) || 1;
  if (val <= 1) return DEFAULT_ZOOM;
  return {
    scale: 1 + (val - 1) * 0.1,
    originX: SLOT_X[zoomPos] ?? DEFAULT_ZOOM.originX,
    originY: DEFAULT_ZOOM.originY,
  };
};

export const getZoomLayerStyle = (zoom: typeof DEFAULT_ZOOM) => {
  if (zoom.scale <= 1) return undefined;
  const tx = zoom.originX * (1 - zoom.scale);
  const ty = zoom.originY * (1 - zoom.scale);
  return { transform: `translate(${tx}%, ${ty}%) scale(${zoom.scale})` };
};

export const getBgStyle = (bgUrl: string | null, isSceneBg: boolean) => ({
  backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
  zIndex: isSceneBg ? 2 : undefined,
});

const getSlotLeft = (slot: CharaSlot) => {
  const base = `${SLOT_X[slot.pos] ?? 50}%`;
  return slot.posX ? `calc(${base} + ${gx(slot.posX)})` : base;
};

/** 係数: SD=1 / 立ち絵=0.6（立ち絵スプライトは実寸が大きいため）。中央アンカー+中央起点でscale変更時も顔位置がほぼ動かない */
export const getCharaStyle = (slot: CharaSlot) => {
  const scaleX = slot.direction === DIRECTION_FLIP ? -1 : 1;
  const size = slot.size || 1;
  const factor = slot.isSd ? 1 : 0.6;
  const anchorY = slot.isSd ? SD_ANCHOR_Y : STAND_ANCHOR_Y;
  return {
    left: getSlotLeft(slot),
    top: slot.posY ? `calc(${anchorY}% - ${gy(slot.posY)})` : `${anchorY}%`,
    transformOrigin: 'center center',
    transform: `translate(-50%, -50%) scale(${size * factor}) scaleX(${scaleX})`,
    width: 'auto' as const,
    height: 'auto' as const,
  };
};

/** 立ち絵のみ顔位置に合わせ左3%・上15%寄せ。高さは固定20%（キャラサイズ非追従） */
export const getEmoticonStyle = (slot: CharaSlot, emo: EmoticonInfo) => {
  const baseLeft = getSlotLeft(slot);
  const emoOffsetY = slot.posY + emo.posY;
  const nudgeX = slot.isSd ? '' : ' - 3%';
  const nudgeY = slot.isSd ? '' : ' - 15%';
  const left = `calc(${baseLeft}${emo.posX ? ` + ${gx(emo.posX)}` : ''}${nudgeX})`;
  const top = `calc(50% - ${gy(emoOffsetY)}${nudgeY})`;
  return { left, top, transform: 'translate(-100%, -50%)', height: '20%', width: 'auto' as const };
};
