import type { Character } from '@/scripts/character';
import {
  mdiBoxingGlove,
  mdiBullhorn,
  mdiChartBubble,
  mdiFire,
  mdiGold,
  mdiHeart,
  mdiMagicStaff,
  mdiMoonWaningCrescent,
  mdiPineTree,
  mdiShield,
  mdiSword,
  mdiTerrain,
  mdiWeatherSunny,
} from '@mdi/js';

export type SortTarget =
  | 'id'
  | 'rarity'
  | 'lv'
  | 'rank'
  | 'currentRarity'
  | 'overlap'
  | 'likeLv'
  | 'agi'
  | 'pos'
  | 'hp'
  | 'atk'
  | 'cri'
  | 'def'
  | 'res'
  | 'b'
  | 'w'
  | 'h'
  | 'height'
  | 'weight'
  | 'birthDate'
  | 'acquisitionOrder';

type SortTargetItem = { key: SortTarget; label: string };

export const sortTargetsBasic: Array<SortTargetItem> = [
  { key: 'id', label: 'ID' },
  { key: 'rarity', label: 'ベース★' },
  { key: 'b', label: 'b' },
  { key: 'w', label: 'w' },
  { key: 'h', label: 'h' },
  { key: 'height', label: 'height' },
  { key: 'weight', label: 'weight' },
  { key: 'birthDate', label: 'birthDate' },
];

export const sortTargetsPlayerSpecific: Array<SortTargetItem> = [
  { key: 'acquisitionOrder', label: '入手順' },
  { key: 'lv', label: 'Lv' },
  { key: 'rank', label: 'ランク' },
  { key: 'currentRarity', label: '現在★' },
  { key: 'overlap', label: '天衣覚醒' },
  { key: 'likeLv', label: '好感度' },
];

export const sortTargetsBattleStats: Array<SortTargetItem> = [
  { key: 'hp', label: 'HP' },
  { key: 'atk', label: '攻撃力' },
  { key: 'cri', label: 'クリティカル' },
  { key: 'def', label: '物理防御力' },
  { key: 'res', label: '魔法防御力' },
  { key: 'agi', label: 'すばやさ' },
  { key: 'pos', label: 'ポジション' },
];

export interface AttributeIcon {
  icon: string;
  color: string;
  title: string;
}

export const dmgTypeIcons = new Map<number, AttributeIcon>([
  [1, { icon: mdiSword, color: 'red', title: '物理' }],
  [2, { icon: mdiMagicStaff, color: 'blue', title: '魔法' }],
]);

export const categoryIcons = new Map<number, AttributeIcon>([
  [1, { icon: mdiBoxingGlove, color: 'red', title: 'アタッカー' }],
  [2, { icon: mdiBullhorn, color: 'orange', title: 'サポーター' }],
  [3, { icon: mdiHeart, color: 'green', title: 'ヒーラー' }],
  [4, { icon: mdiShield, color: 'blue', title: 'タンク' }],
]);

export const eleTypeIcons = new Map<number, AttributeIcon>([
  [1, { icon: mdiWeatherSunny, color: 'white', title: '日' }],
  [2, { icon: mdiMoonWaningCrescent, color: 'purple', title: '月' }],
  [3, { icon: mdiFire, color: 'red', title: '火' }],
  [4, { icon: mdiChartBubble, color: 'blue', title: '水' }],
  [5, { icon: mdiPineTree, color: 'green', title: '木' }],
  [6, { icon: mdiGold, color: 'amber', title: '金' }],
  [7, { icon: mdiTerrain, color: 'amber-darken-2', title: '土' }],
]);

export const overlapChars = ['○', '◔', '◑', '◕', '⬤'];

export const MAX_RARITY = 5;

export type StatMode = 'base' | 'current' | 'max';

export const statModeLabels: Array<{ value: StatMode; label: string }> = [
  { value: 'base', label: 'ベース' },
  { value: 'current', label: '現在値' },
  { value: 'max', label: '最大育成' },
];

export interface DetailFilter {
  dmgType: Array<number>;
  eleType: Array<number>;
  category: Array<number>;
  rarity: Array<number>;
  currentRarity: Array<number>;
  overlap: Array<number>;
  hasOverlapStory: boolean;
  notDownloadedYet: boolean;
  acquiredCharacter: boolean;
  excludeCollab: boolean;
}

export const createDefaultDetailFilter = (): DetailFilter => ({
  dmgType: [],
  eleType: [],
  category: [],
  rarity: [],
  currentRarity: [],
  overlap: [],
  hasOverlapStory: false,
  notDownloadedYet: false,
  acquiredCharacter: false,
  excludeCollab: false,
});

// グループ名が「コラボ」を含むか、名前に出ない特定コラボグループに属するか。
const COLLAB_GROUPS = ['DMM10周年', 'ふるふる転生'];
export const isCollabGroup = (group: string): boolean => group.includes('コラボ') || COLLAB_GROUPS.includes(group);

export const getBattleTypeText = (dmgType: number, eleType: number, category: number): string => {
  const dmg = dmgTypeIcons.get(dmgType)?.title ?? '？？？';
  const ele = eleTypeIcons.get(eleType)?.title ?? '？？？';
  const cat = categoryIcons.get(category)?.title ?? '？？？';
  return `【${dmg}】${ele}属性${cat}`;
};

export type CharaListItem = Character & {
  battleTypeText: string;
  currentRarity: number;
  currentOverlap: number;
  hasOverlapStory: boolean;
  sortTarget: Record<Exclude<SortTarget, 'id'>, number>;
};
