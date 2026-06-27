import type { GameSettings, PlayerChara } from '@/@types';
import { MAX_RARITY, type StatMode } from '@/constants/characterAttributes';

type CharaStats = { hp: number; atk: number; cri: number; def: number; res: number };

export type Character = {
  chara_id: string;
  name: string;
  kana: string;
  msg: { [index: string]: string };
  profile: {
    birth: string;
    cv_name: string;
    details: string;
    flavor: string;
    group: string;
    height: string;
    illust: string;
    size: string;
    weight: string;
  };
  order: number;
  rarity: number; // 元レアリティ (1-3)
  agi: number; // 行動速度
  pos: number; // 配置順
  dmg_type: number; // 1:物理2:魔法
  category: number; // 1:アタッカー2:サポーター3:ヒーラー4:タンク
  ele_type: number; // 1:日2:月3:火4:水5:木6:金7:土
  chara_status: {
    base: CharaStats;
    lvup: CharaStats;
    rankup: Record<string, CharaStats>; // r1, r2, ...
    likeup: Record<string, CharaStats>; // lv1, lv2, ...
  };
  stuff_panel: Record<string, { stuff: Record<string, { status: CharaStats }> }>; // r1.stuff.p1.status, ...
};

export type CalcResult = CharaStats & { agi: number };

const MAX_OVERLAP = 4;
const OVERLAP_COEFF = [1.0, 1.02, 1.04, 1.08, 1.16];
const STAT_KEYS: (keyof CharaStats)[] = ['hp', 'atk', 'cri', 'def', 'res'];

/**
 * 計算式: `floor((base + (Lv-1) × lvup) × overlapCoeff × rarityCoeff) + rankup + stuff + likeup`
 * overlapCoeff は天衣覚醒段階の係数（CRIは常に1.0）、rarityCoeff は `rarity × 0.2 + 1.0`、AGIは固定値。
 */
export function calcCharaStats(chara: Character, pChara: PlayerChara | undefined, mode: StatMode, settings?: GameSettings): CalcResult {
  const base = chara.chara_status.base;

  if (mode === 'base') return { ...base, agi: chara.agi };
  if (mode === 'current' && !pChara) return { ...base, agi: chara.agi };

  const rankup = chara.chara_status.rankup ?? {};
  const stuffPanel = chara.stuff_panel ?? {};
  const likeup = chara.chara_status.likeup ?? {};

  const maxLv = settings?.lv_max ?? 0;
  const maxRank = settings?.chara_rank_max ?? 0;
  const maxLikeLv = Object.keys(likeup).length + 1;

  const isMax = mode === 'max';
  const lv = isMax ? maxLv : pChara!.lv;
  const rank = isMax ? maxRank : pChara!.rank;
  const stuff = isMax ? [1, 2, 3, 4, 5, 6] : pChara!.stuff;
  const likeLv = isMax ? maxLikeLv : pChara!.like_lv;
  const overlap = isMax ? MAX_OVERLAP : pChara!.overlap;
  const rarity = isMax ? MAX_RARITY : pChara!.rarity;

  const overlapCoeff = OVERLAP_COEFF[overlap] ?? 1.0;
  const rarityCoeff = rarity * 0.2 + 1.0;

  const result = {} as CalcResult;
  for (const key of STAT_KEYS) {
    const keyOverlapCoeff = key === 'cri' ? 1.0 : overlapCoeff;
    const mainPart = Math.floor((base[key] + (lv - 1) * chara.chara_status.lvup[key]) * keyOverlapCoeff * rarityCoeff);

    let add = 0;
    for (let r = 1; r < rank; r++) add += rankup[`r${r}`]?.[key] ?? 0;
    for (let r = 1; r < rank; r++) {
      const panel = stuffPanel[`r${r}`];
      if (panel) for (const slot of Object.values(panel.stuff)) add += slot.status[key];
    }
    const currentPanel = stuffPanel[`r${rank}`];
    if (currentPanel) for (const slotNum of stuff) add += currentPanel.stuff[`p${slotNum}`]?.status[key] ?? 0;
    for (let l = 1; l < likeLv; l++) add += likeup[`lv${l}`]?.[key] ?? 0;

    result[key] = mainPart + add;
  }
  result.agi = chara.agi;
  return result;
}
