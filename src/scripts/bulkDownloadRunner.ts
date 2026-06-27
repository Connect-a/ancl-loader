import { browser } from 'wxt/browser';
import { homeDirHandle } from '@/scripts/directoryHandleStore';
import { loadAnclCharacters, loadAnclDownloadContext, loadAnclSectionContext, loadAnclAsmrContext } from '@/scripts/anclData';
import { runCharacterDownload, runSectionDownload } from '@/repository/download';
import { runAsmrSectionDownload } from '@/repository/download/asmr';
import { GameApiError, toAsmrAdditionalChapters } from '@/repository/gameDataResolver';
import { DirectoryWriter } from '@/repository/download/writer';
import { homeLayout } from '@/repository/download/homeLayout';
import { toSafeFileName } from '@/utils/safeFileName';
import { collectExistingZipNames } from '@/components/folderPlayer/utils/folderScanner';
import {
  BULK_DOWNLOAD_ALARM_NAME,
  getBulkDownloadState,
  setBulkDownloadState,
  createBulkDownloadState,
  isBulkDownloadActive,
  getBulkDownloadPrefetchSettled,
  setBulkDownloadPrefetchSettled,
  HEARTBEAT_MIN,
  type BulkDownloadState,
  type BulkDownloadPhase,
  type BulkDownloadKind,
  type BulkDownloadItem,
  type BulkDownloadItemSpec,
} from '@/scripts/bulkDownloadState';
import { notifyBulkDownloadOutcome, clearBulkDownloadBadge } from '@/scripts/bulkDownloadAlert';
import { runBulkDownloadPrefetch } from './bulkDownloadPrefetch';

type DownloadResult = { bytes: number; complete: boolean };
type ItemPlan = { run: () => Promise<DownloadResult> } | { error: string };
type BulkDownloadSectionItem = Extract<BulkDownloadItem, { kind: 'section' }>;

type DownloadStrategy = {
  zipNames: (item: BulkDownloadItem) => Array<string>;
  plan: (item: BulkDownloadItem, handle: FileSystemDirectoryHandle) => ItemPlan;
};

let _dlRunning: Promise<void> | null = null;
let _prefetchRunning: Promise<void> | null = null;

const ensureHeartbeat = (): Promise<void> => browser.alarms.create(BULK_DOWNLOAD_ALARM_NAME, { periodInMinutes: HEARTBEAT_MIN });

const finishBulkDownload = async (
  state: BulkDownloadState,
  phase: Exclude<BulkDownloadPhase, 'scanning' | 'running' | 'waiting'>,
  lastError?: string,
  tokenError = false,
) => {
  const next = { ...state, phase, lastError: lastError ?? state.lastError, tokenError };
  await setBulkDownloadState(next);
  await browser.alarms.clear(BULK_DOWNLOAD_ALARM_NAME);
  if (phase === 'error' || phase === 'done') await notifyBulkDownloadOutcome(next);
};

// 長いawait（DL/フォルダ走査）の間にstopが割り込んでいないか再取得して確認する
const stillActive = async (): Promise<boolean> => {
  const s = await getBulkDownloadState();
  return !!s && isBulkDownloadActive(s.phase);
};

const downloadItem = async (state: BulkDownloadState, item: BulkDownloadItem, run: () => Promise<DownloadResult>) => {
  state.phase = 'running';
  await setBulkDownloadState(state);
  const { bytes, complete } = await run();
  item.status = 'done';
  item.bytes = bytes;
  item.complete = complete;
  item.at = Date.now();
  state.consecutiveFailures = 0;
};

const createCharaStrategy = async (): Promise<DownloadStrategy> => {
  const [charas, ctx] = await Promise.all([loadAnclCharacters(), loadAnclDownloadContext()]);
  return {
    zipNames: (item) => {
      const name = charas[item.id]?.name;
      return name ? [homeLayout.charaZip(item.id, name, true), homeLayout.charaZip(item.id, name, false)].map(toSafeFileName) : [];
    },
    plan: (item, handle) => {
      const chara = charas[item.id];
      if (!chara || !ctx.stories?.chara.story[item.id]?.length) return { error: 'ストーリー無し/データ無し' };
      return { run: () => runCharacterDownload(new DirectoryWriter(handle), chara, ctx) };
    },
  };
};

const createSectionStrategy = async (): Promise<DownloadStrategy> => {
  const ctx = await loadAnclSectionContext();
  return {
    zipNames: (item) => {
      const it = item as BulkDownloadSectionItem;
      const section = ctx[it.domain].sections[it.id];
      if (!section) return [];
      const names =
        it.domain === 'event'
          ? [homeLayout.eventStoryZip(section.name, true), homeLayout.eventStoryZip(section.name, false)]
          : [homeLayout.mainStoryZip(section.chapter, section.name, true), homeLayout.mainStoryZip(section.chapter, section.name, false)];
      return names.map(toSafeFileName);
    },
    plan: (item, handle) => {
      const it = item as BulkDownloadSectionItem;
      const dom = ctx[it.domain];
      const section = dom.sections[it.id];
      const stories = dom.storyList[it.id];
      if (!section || !stories?.length) return { error: 'セクションデータ無し' };
      return {
        run: () =>
          runSectionDownload(new DirectoryWriter(handle), {
            section,
            stories,
            enableStidMap: dom.enableStidMap,
            domain: it.domain,
            eventId: dom.sectionEventIdMap?.get(it.id),
            storyAdditional: ctx.storyAdditionalData,
            token: ctx.token,
          }),
      };
    },
  };
};

const createAsmrStrategy = async (): Promise<DownloadStrategy> => {
  const ctx = await loadAnclAsmrContext();
  return {
    zipNames: (item) => {
      const name = ctx.voice?.all.section[item.id]?.name;
      return name ? [toSafeFileName(homeLayout.asmrZip(name))] : [];
    },
    plan: (item, handle) => {
      const section = ctx.voice?.all.section[item.id];
      if (!section) return { error: 'ASMRデータ無し' };
      const chapters = ctx.voice?.all.chapter[item.id] ?? [];
      return {
        run: () => runAsmrSectionDownload(new DirectoryWriter(handle), section, chapters, toAsmrAdditionalChapters(ctx.voiceAdditional), ctx.token),
      };
    },
  };
};

const createStrategy = (kind: BulkDownloadKind): Promise<DownloadStrategy> => {
  switch (kind) {
    case 'chara':
      return createCharaStrategy();
    case 'section':
      return createSectionStrategy();
    case 'asmr':
      return createAsmrStrategy();
  }
};

const downloadNext = async (): Promise<void> => {
  const handle = await homeDirHandle.get();
  let strategy: DownloadStrategy | null = null;

  for (;;) {
    const state = await getBulkDownloadState();
    if (!state || !isBulkDownloadActive(state.phase)) {
      await browser.alarms.clear(BULK_DOWNLOAD_ALARM_NAME);
      return;
    }
    const idx = state.items.findIndex((it) => it.status === 'pending');
    if (idx === -1) return finishBulkDownload(state, 'done');

    if (!handle || (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      return finishBulkDownload(state, 'error', '権限が必要です（ページを開いて再許可してください）');
    }

    const item = state.items[idx]!;
    let didDownload = false;
    const markFailed = (msg: string) => {
      item.status = 'failed';
      item.error = msg;
      item.at = Date.now();
      state.consecutiveFailures++;
      state.lastError = `${item.id}: ${msg}`;
    };
    try {
      strategy ??= await createStrategy(state.kind);
      const plan = strategy.plan(item, handle);
      if ('error' in plan) markFailed(plan.error);
      else {
        await downloadItem(state, item, plan.run);
        didDownload = true;
      }
    } catch (e: unknown) {
      if (e instanceof GameApiError) return finishBulkDownload(state, 'error', e.message, true);
      markFailed(e instanceof Error ? e.message : String(e));
    }

    if (!(await stillActive())) {
      await browser.alarms.clear(BULK_DOWNLOAD_ALARM_NAME);
      return;
    }

    if (state.consecutiveFailures >= 5) {
      return finishBulkDownload(state, 'error', `連続 ${state.consecutiveFailures} 回失敗のため停止（最後: ${state.lastError}）`);
    }
    const nextIdx = state.items.findIndex((it) => it.status === 'pending');
    if (nextIdx === -1) return finishBulkDownload(state, 'done');

    if (didDownload) {
      state.phase = 'waiting';
      state.nextDownloadAt = Date.now() + state.intervalMin * 60_000;
    }
    await setBulkDownloadState(state);
    if (didDownload) return;
  }
};

export const tickBulkDownload = async (): Promise<void> => {
  const state = await getBulkDownloadState();
  if (!state || !isBulkDownloadActive(state.phase)) {
    await browser.alarms.clear(BULK_DOWNLOAD_ALARM_NAME);
    return;
  }
  if (!(await browser.alarms.get(BULK_DOWNLOAD_ALARM_NAME))) await ensureHeartbeat();

  const dlDue = state.phase === 'running' || Date.now() >= state.nextDownloadAt;
  if (dlDue && !_dlRunning) {
    _dlRunning = downloadNext().finally(() => (_dlRunning = null));
  }

  if (state.phase === 'waiting' && !_prefetchRunning && !(await getBulkDownloadPrefetchSettled())) {
    _prefetchRunning = runBulkDownloadPrefetch().finally(() => (_prefetchRunning = null));
  }

  // 起動中の処理完了までawaitしてSW延命（外すとgap中にSWが死ぬ）
  await Promise.all([_dlRunning, _prefetchRunning].filter((p): p is Promise<void> => p !== null));
};

export const startBulkDownload = async (intervalMin: number, specs: Array<BulkDownloadItemSpec>, overwrite: boolean): Promise<void> => {
  const cur = await getBulkDownloadState();
  if (cur && isBulkDownloadActive(cur.phase)) return;
  await clearBulkDownloadBadge();

  const state = createBulkDownloadState(intervalMin, specs);
  await setBulkDownloadPrefetchSettled(false);
  await setBulkDownloadState(state);

  const handle = await homeDirHandle.get();
  if (!overwrite && state.items.length && handle && (await handle.queryPermission({ mode: 'readwrite' })) === 'granted') {
    const existing = await collectExistingZipNames(handle);
    const strategy = await createStrategy(state.kind);
    for (const it of state.items) {
      if (strategy.zipNames(it).some((n) => existing.has(n))) it.status = 'skipped';
    }
  }

  if (!(await stillActive())) return;
  state.phase = 'running';
  await setBulkDownloadState(state);

  await ensureHeartbeat();
  await tickBulkDownload();
};

export const stopBulkDownload = async (): Promise<void> => {
  const state = await getBulkDownloadState();
  if (state) await finishBulkDownload(state, 'stopped', '');
  else await browser.alarms.clear(BULK_DOWNLOAD_ALARM_NAME);
};
