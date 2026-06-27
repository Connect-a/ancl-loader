import {
  loadAnclCharacters,
  loadAnclDownloadContext,
  loadAnclSectionContext,
  loadAnclAsmrContext,
  addAdditionalData,
  type AnclDownloadContext,
  type AnclSectionContext,
  type StoryRecord,
  type VoiceRecord,
} from '@/scripts/anclData';
import type { Character } from '@/scripts/character';
import type { Story } from '@/@types';
import { resolveStoryIds, resolveChapterIds, GameApiError, toAsmrAdditionalChapters } from '@/repository/gameDataResolver';
import { enabledAsmrSectionIds } from '@/repository/asmrSection';
import { getBulkDownloadState, isBulkDownloadActive, setBulkDownloadPrefetchSettled, type BulkDownloadItem } from '@/scripts/bulkDownloadState';

const PREFETCH_REQUEST_GAP_MS = 2_000;

type StoryGroup = { sourceId: string; sourceName: string; stories: Array<Story> };
type StorySource = { key: string; id: string; name: string; stories: ReadonlyArray<Story> };

const toCharaSources = (charas: Record<string, Character>, charaCtx: AnclDownloadContext): Array<StorySource> =>
  Object.entries(charaCtx.stories?.chara?.story ?? {}).map(([id, stories]) => ({
    key: `chara:${id}`,
    id,
    name: charas[id]?.name ?? id,
    stories: stories.filter((s) => charaCtx.enableStidMap.has(s.st_id)),
  }));

const toSectionSources = (domain: 'event' | 'main', sectionCtx: AnclSectionContext): Array<StorySource> => {
  const dom = domain === 'event' ? sectionCtx.event : sectionCtx.main;
  return Object.entries(dom.storyList).map(([id, stories]) => ({
    key: `${domain}:${id}`,
    id,
    name: dom.sections[id]?.name ?? id,
    stories: stories.filter((s) => dom.enableStidMap.has(s.st_id)),
  }));
};

const toStoryGroups = (sources: Array<StorySource>, queue: ReadonlyArray<BulkDownloadItem>, known: ReadonlySet<string>): Array<StoryGroup> => {
  const rank = new Map(queue.map((it, i) => [it.kind === 'section' ? `${it.domain}:${it.id}` : `${it.kind}:${it.id}`, i] as const));
  return sources
    .sort((a, b) => (rank.get(a.key) ?? Infinity) - (rank.get(b.key) ?? Infinity))
    .map((p) => ({
      sourceId: p.id,
      sourceName: p.name,
      stories: p.stories.filter((s) => !known.has(`story:${s.st_id}`)),
    }))
    .filter((g) => g.stories.length > 0);
};

const toStoryEntries = (idMap: Map<number, string>, charaId: string, charaName: string): Array<StoryRecord> =>
  [...idMap].map(([stid, storyId]) => ({ type: 'story', charaId, charaName, stid, storyId }));

const toVoiceEntries = (idMap: Map<number, string>, sectionId: string): Array<VoiceRecord> =>
  [...idMap].map(([chId, chapterId]) => ({ type: 'voice', sectionId, chId, chapterId }));

const runAsmrPrefetch = async (queue: ReadonlyArray<BulkDownloadItem>): Promise<void> => {
  const ctx = await loadAnclAsmrContext();
  if (!ctx.token) return setBulkDownloadPrefetchSettled(true);
  const additionalChapters = toAsmrAdditionalChapters(ctx.voiceAdditional);
  const enabled = enabledAsmrSectionIds(ctx.voice, ctx.initData, additionalChapters);
  const knownCh = new Set(additionalChapters.map((c) => c.ch_id));
  const rank = new Map(queue.filter((it) => it.kind === 'asmr').map((it, i) => [it.id, i] as const));
  const sections = Object.values(ctx.voice?.all.section ?? {})
    .filter((s) => enabled.has(s.section_id))
    .sort((a, b) => (rank.get(a.section_id) ?? Infinity) - (rank.get(b.section_id) ?? Infinity));
  if (!sections.length) return setBulkDownloadPrefetchSettled(true);

  try {
    for (const section of sections) {
      const s = await getBulkDownloadState();
      if (!s || !isBulkDownloadActive(s.phase)) return;
      const chapters = (ctx.voice?.all.chapter[section.section_id] ?? []).filter((ch) => !knownCh.has(ch.ch_id));
      if (!chapters.length) continue;
      const idMap = await resolveChapterIds(chapters, additionalChapters, section.section_id, ctx.token, PREFETCH_REQUEST_GAP_MS);
      await addAdditionalData(toVoiceEntries(idMap, section.section_id));
    }
    await setBulkDownloadPrefetchSettled(true);
  } catch (e: unknown) {
    if (e instanceof GameApiError) await setBulkDownloadPrefetchSettled(true);
  }
};

export const runBulkDownloadPrefetch = async (): Promise<void> => {
  const state = await getBulkDownloadState();
  if (!state || !isBulkDownloadActive(state.phase)) return;
  const first = state.items[0];
  if (!first) return setBulkDownloadPrefetchSettled(true);
  if (first.kind === 'asmr') return runAsmrPrefetch(state.items);

  let sources: Array<StorySource>;
  let token: string;
  let storyAdditional: Array<StoryRecord>;
  if (first.kind === 'chara') {
    const [charas, charaCtx] = await Promise.all([loadAnclCharacters(), loadAnclDownloadContext()]);
    sources = toCharaSources(charas, charaCtx);
    token = charaCtx.token;
    storyAdditional = charaCtx.storyAdditionalData;
  } else {
    const sectionCtx = await loadAnclSectionContext();
    sources = toSectionSources(first.domain, sectionCtx);
    token = sectionCtx.token;
    storyAdditional = sectionCtx.storyAdditionalData;
  }
  if (!token) return setBulkDownloadPrefetchSettled(true);
  const known = new Set(storyAdditional.map((x) => `story:${x.stid}`));
  const groups = toStoryGroups(sources, state.items, known);
  if (!groups.length) return setBulkDownloadPrefetchSettled(true);

  try {
    for (const g of groups) {
      const s = await getBulkDownloadState();
      if (!s || !isBulkDownloadActive(s.phase)) return; // 停止/完了したら中断（settledにはしない）
      const idMap = await resolveStoryIds(g.stories, { id: g.sourceId, name: g.sourceName }, [], token, PREFETCH_REQUEST_GAP_MS);
      await addAdditionalData(toStoryEntries(idMap, g.sourceId, g.sourceName));
    }
    await setBulkDownloadPrefetchSettled(true);
  } catch (e: unknown) {
    if (e instanceof GameApiError) await setBulkDownloadPrefetchSettled(true);
  }
};
