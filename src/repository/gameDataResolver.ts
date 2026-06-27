import { storage } from '@wxt-dev/storage';
import { encodeMsgpack, decodeMsgpack } from '@/utils/msgpack';
import { useMainStore, TOKEN_ERROR_MESSAGE } from '@/store';
import { sendAnclLog } from '@/scripts/anclLog';
import type { StoryRecord, VoiceRecord } from '@/scripts/anclData';
import type { Story, AsmrChapter } from '@/@types';

export type AsmrAdditionalChapter = { section_id: string; ch_id: number; chapterId: string };

/** 取り込み済み voice追加データを AsmrAdditionalChapter へ変換 */
export const toAsmrAdditionalChapters = (voiceAdditional: ReadonlyArray<VoiceRecord>): Array<AsmrAdditionalChapter> =>
  voiceAdditional.map((x) => ({ section_id: x.sectionId, ch_id: x.chId, chapterId: x.chapterId }));

export class GameApiError extends Error {
  constructor() {
    super(TOKEN_ERROR_MESSAGE);
    this.name = 'GameApiError';
  }
}

// token省略時はstoreから取得（ページ用）。SWからは明示的に渡す。error.code≠0（正負問わず）はトークンエラー。
export async function callGameApi<T>(xClass: string, xFunc: string, params: Record<string, unknown>, token?: string): Promise<T | undefined> {
  const t = token ?? useMainStore().token;
  if (!t) return;

  const res = await fetch('https://ancl.jp/game/api/v1/', {
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/x-msgpack',
      authorization: `Bearer ${t}`,
      'x-class': xClass,
      'x-func': xFunc,
      origin: 'https://ancl.jp',
    },
    body: encodeMsgpack({ params }),
    signal: AbortSignal.timeout(120_000),
  });

  const decoded = decodeMsgpack<T>(await res.arrayBuffer());
  const errorCode = (decoded as { error?: { code?: number } | null })?.error?.code;
  if (typeof errorCode === 'number' && errorCode !== 0) {
    await storage.setItem('local:failedToken', t);
    throw new GameApiError();
  }
  return decoded;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type ContentKind = { apiClass: string; apiFunc: string; paramKey: string; resultKey: string };
const STORY_KIND: ContentKind = { apiClass: 'Story', apiFunc: 'getStoryId', paramKey: 'st_id', resultKey: 'story_id' };
const VOICE_KIND: ContentKind = { apiClass: 'Voice', apiFunc: 'getChapterId', paramKey: 'ch_id', resultKey: 'chapter_id' };

const resolveIds = async (
  localIds: ReadonlyArray<number>,
  known: ReadonlyMap<number, string>,
  kind: ContentKind,
  logPrefix: readonly [string, string],
  token?: string,
  requestDelayMs = 0,
): Promise<Map<number, string>> => {
  const idMap = new Map<number, string>();
  for (const localId of localIds) {
    const cached = known.get(localId);
    if (cached) {
      idMap.set(localId, cached);
      continue;
    }
    if (requestDelayMs) await sleep(requestDelayMs);
    const res = await callGameApi<{ result?: Record<string, string> }>(kind.apiClass, kind.apiFunc, { [kind.paramKey]: localId }, token);
    const contentId = res?.result?.[kind.resultKey];
    if (contentId) idMap.set(localId, contentId);
  }
  void sendAnclLog([...idMap].map(([id, contentId]) => [logPrefix[0], logPrefix[1], String(id), contentId]));
  return idMap;
};

export const resolveStoryIds = (
  stories: ReadonlyArray<Story>,
  parent: { id: string; name: string },
  storyAdditional: ReadonlyArray<StoryRecord>,
  token?: string,
  requestDelayMs = 0,
): Promise<Map<number, string>> =>
  resolveIds(
    stories.map((s) => s.st_id),
    new Map(storyAdditional.map((x) => [x.stid, x.storyId] as [number, string])),
    STORY_KIND,
    [parent.id, parent.name],
    token,
    requestDelayMs,
  );

export const resolveChapterIds = (
  chapters: ReadonlyArray<AsmrChapter>,
  additionalChapters: ReadonlyArray<AsmrAdditionalChapter>,
  sectionId: string,
  token?: string,
  requestDelayMs = 0,
): Promise<Map<number, string>> =>
  resolveIds(
    chapters.map((c) => c.ch_id),
    new Map(additionalChapters.map((x) => [x.ch_id, x.chapterId] as [number, string])),
    VOICE_KIND,
    ['voice', sectionId],
    token,
    requestDelayMs,
  );
