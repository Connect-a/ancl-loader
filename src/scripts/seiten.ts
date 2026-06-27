import type { BattleMain, BattleEvent, BattleLimited, BattleStage, BattleDungeon, EventInfo, PlayerChara } from '@/@types';
import type { Character } from '@/scripts/character';
import { MAX_RARITY } from '@/constants/characterAttributes';

const AWAKE_COST = [30, 80, 110, 150];
const UNLOCK_COST = 145;
const needFor = (unlocked: boolean, rarity: number): number => (unlocked ? (AWAKE_COST[rarity - 1] ?? 0) : UNLOCK_COST);

export type SeitenSrc = 'main' | 'event' | 'limited';

type GroupMeta = { src: SeitenSrc; key: string; name: string; start?: number; end?: number };
type GroupUnit = GroupMeta & { stages: Array<BattleStage> };

const stageGroupMap = (dungeons: Record<string, BattleDungeon> | undefined, keyPrefix: string, src: SeitenSrc): Map<string, GroupMeta> => {
  const map = new Map<string, GroupMeta>();
  for (const [dungeonId, d] of Object.entries(dungeons ?? {})) {
    const meta: GroupMeta = { src, key: `${keyPrefix}:${dungeonId}`, name: d.name, start: d.limit?.start_time, end: d.limit?.end_time };
    for (const mode of [d?.data?.normal, d?.data?.hard]) {
      for (const sid of mode?.stages_list ?? []) map.set(sid, meta);
    }
  }
  return map;
};

// main/event/limitedで形状が異なるため吸収してグループ単位にstagesをまとめる。
const collectGroups = (main?: BattleMain, event?: BattleEvent, limited?: BattleLimited, eventInfo?: EventInfo): Array<GroupUnit> => {
  const byKey = new Map<string, GroupUnit>();
  const add = (meta: GroupMeta, st: BattleStage) => {
    let g = byKey.get(meta.key);
    if (!g) {
      g = { ...meta, stages: [] };
      byKey.set(meta.key, g);
    }
    g.stages.push(st);
  };

  const mainGroups = stageGroupMap(main?.dungeons, 'main', 'main');
  for (const [sid, st] of Object.entries(main?.stages ?? {})) add(mainGroups.get(sid) ?? { src: 'main', key: 'main', name: '' }, st);

  for (const [evId, node] of Object.entries(event ?? {})) {
    const e = eventInfo?.[evId];
    const meta: GroupMeta = { src: 'event', key: evId, name: e?.name ?? evId, start: e?.start_time, end: e?.change_time || e?.end_time };
    for (const st of Object.values(node?.stages ?? {})) add(meta, st);
  }

  for (const [cId, node] of Object.entries(limited ?? {})) {
    const limitedGroups = stageGroupMap(node?.dungeons, cId, 'limited');
    for (const [sid, st] of Object.entries(node?.stages ?? {})) add(limitedGroups.get(sid) ?? { src: 'limited', key: cId, name: '' }, st);
  }

  return [...byKey.values()];
};

export type Status = 'open' | 'upcoming' | 'ended' | 'unknown';
type SeitenChara = { charaId: string; name: string; unlocked: boolean; rarity: number; owned: number; need: number; stages: Array<string> };
export type SeitenDungeon = { key: string; src: SeitenSrc; groupName: string; status: Status; deadline?: number; charas: Array<SeitenChara> };

export type SeitenInput = {
  battleMain?: BattleMain;
  battleEvent?: BattleEvent;
  battleLimited?: BattleLimited;
  eventInfo?: EventInfo;
  charaData: Record<string, Character>;
  player: Record<string, PlayerChara>;
  ownedSeiten: Record<string, number>;
  nowSec: number;
};

// type5（聖典）はawakeかreward[] に入る（clear_rewardのtype5は初回ボーナスで対象外）。awake.id/reward.id = 対象キャラID。
const SEITEN_TYPE = 5;

const statusFromTimes = (nowSec: number, start?: number, end?: number): Status => {
  if (end == null) return 'unknown';
  if (start != null && nowSec < start) return 'upcoming';
  if (nowSec > end) return 'ended';
  return 'open';
};

// ステージ名末尾の数値（半角/全角）を無視してまとめる。
const stageBase = (name: string) => name.replace(/[0-9０-９]+$/, '').trim();

type CharaAcc = Omit<SeitenChara, 'stages'> & { stages: Set<string> };

const buildDungeon = (g: GroupUnit, input: SeitenInput): SeitenDungeon | null => {
  const { charaData, player, ownedSeiten, nowSec } = input;
  const status = statusFromTimes(nowSec, g.start, g.end);
  if (status === 'ended') return null;

  const charaMap = new Map<string, CharaAcc>();
  for (const st of g.stages) {
    const charaIds = new Set<string>(); // awakeとreward[] の同一キャラ重複を排除
    if (st?.awake?.type === SEITEN_TYPE && st.awake.id) charaIds.add(st.awake.id);
    for (const r of st?.reward ?? []) if (r?.type === SEITEN_TYPE && r.id) charaIds.add(r.id);

    for (const charaId of charaIds) {
      const pc = player[charaId];
      if (pc && pc.rarity >= MAX_RARITY) continue; // 所持カンストは除外（未所持は開放候補として残す）
      let c = charaMap.get(charaId);
      if (!c) {
        const unlocked = !!pc;
        const rarity = pc?.rarity ?? 0;
        c = {
          charaId,
          name: charaData[charaId]?.name ?? charaId,
          unlocked,
          rarity,
          owned: ownedSeiten[charaId] ?? 0,
          need: needFor(unlocked, rarity),
          stages: new Set(),
        };
        charaMap.set(charaId, c);
      }
      c.stages.add(stageBase(st?.name ?? ''));
    }
  }
  if (charaMap.size === 0) return null;

  const charas: Array<SeitenChara> = [...charaMap.values()]
    .map((c) => ({ ...c, stages: [...c.stages] }))
    .sort((a, b) => Math.max(0, a.need - a.owned) - Math.max(0, b.need - b.owned) || a.name.localeCompare(b.name));
  return { key: g.key, src: g.src, groupName: g.name, status, deadline: g.end, charas };
};

export const buildSeitenDungeons = (input: SeitenInput): Array<SeitenDungeon> =>
  collectGroups(input.battleMain, input.battleEvent, input.battleLimited, input.eventInfo)
    .map((g) => buildDungeon(g, input))
    .filter((d): d is SeitenDungeon => d !== null)
    .sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity) || a.groupName.localeCompare(b.groupName));
