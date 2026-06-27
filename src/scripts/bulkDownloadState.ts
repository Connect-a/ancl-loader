import { storage } from '@wxt-dev/storage';

export const BULK_DOWNLOAD_ALARM_NAME = 'bulkDownload';
export const HEARTBEAT_MIN = 1;

export type BulkDownloadPhase = 'scanning' | 'running' | 'waiting' | 'done' | 'stopped' | 'error';

export type BulkDownloadKind = 'chara' | 'section' | 'asmr';
export type BulkDownloadStatus = 'pending' | 'done' | 'skipped' | 'failed';

export type BulkDownloadCandidate = { id: string; fullyUnlocked: boolean; name?: string };

export type BulkDownloadItemSpec =
  | { kind: 'chara'; id: string; name: string }
  | { kind: 'section'; id: string; name: string; domain: 'event' | 'main' }
  | { kind: 'asmr'; id: string; name: string };

export type BulkDownloadItem = BulkDownloadItemSpec & { status: BulkDownloadStatus; bytes?: number; at?: number; complete?: boolean; error?: string };

export type BulkDownloadState = {
  phase: BulkDownloadPhase;
  kind: BulkDownloadKind;
  intervalMin: number;
  nextDownloadAt: number;
  consecutiveFailures: number;
  lastError: string;
  tokenError: boolean;
  items: Array<BulkDownloadItem>;
};

export type BulkDownloadStats = { total: number; done: number; skipped: number; failed: number; processed: number; pending: number; bytes: number };

export type BulkDownloadOptions = {
  intervalMin: number;
  scope: 'filtered' | 'all';
  overwrite: boolean;
  unlockedMode: 'priority' | 'only';
  idDescending: boolean;
};

export const bulkDownloadStats = (items: ReadonlyArray<BulkDownloadItem>): BulkDownloadStats => {
  let done = 0;
  let skipped = 0;
  let failed = 0;
  let bytes = 0;
  for (const it of items) {
    if (it.status === 'done') {
      done++;
      bytes += it.bytes ?? 0;
    } else if (it.status === 'skipped') skipped++;
    else if (it.status === 'failed') failed++;
  }
  return { total: items.length, done, skipped, failed, processed: done + skipped + failed, pending: items.length - done - skipped - failed, bytes };
};

export const isBulkDownloadActive = (phase: BulkDownloadPhase): boolean => phase === 'scanning' || phase === 'running' || phase === 'waiting';

export const createBulkDownloadState = (intervalMin: number, specs: Array<BulkDownloadItemSpec>): BulkDownloadState => ({
  phase: 'scanning',
  kind: specs[0]?.kind ?? 'chara',
  intervalMin,
  nextDownloadAt: 0,
  consecutiveFailures: 0,
  lastError: '',
  tokenError: false,
  items: specs.map((s): BulkDownloadItem => ({ ...s, status: 'pending' })),
});

export const bulkDownloadStateItem = storage.defineItem<BulkDownloadState>('local:bulkDownloadState');
export const getBulkDownloadState = (): Promise<BulkDownloadState | null> => bulkDownloadStateItem.getValue();
export const setBulkDownloadState = (state: BulkDownloadState): Promise<void> => bulkDownloadStateItem.setValue(state);

const bulkDownloadPrefetchSettledItem = storage.defineItem<boolean>('local:bulkDownloadPrefetchSettled');
export const getBulkDownloadPrefetchSettled = async (): Promise<boolean> => (await bulkDownloadPrefetchSettledItem.getValue()) ?? false;
export const setBulkDownloadPrefetchSettled = (v: boolean): Promise<void> => bulkDownloadPrefetchSettledItem.setValue(v);

const bulkDownloadNotifyItem = storage.defineItem<boolean>('local:bulkDownloadNotify');
export const getBulkDownloadNotify = async (): Promise<boolean> => (await bulkDownloadNotifyItem.getValue()) ?? true;
export const setBulkDownloadNotify = (v: boolean): Promise<void> => bulkDownloadNotifyItem.setValue(v);

const bulkDownloadOptionsItem = storage.defineItem<BulkDownloadOptions>('local:bulkDownloadOptions');
export const getBulkDownloadOptions = async (): Promise<Partial<BulkDownloadOptions>> => (await bulkDownloadOptionsItem.getValue()) ?? {};
export const setBulkDownloadOptions = (o: BulkDownloadOptions): Promise<void> => bulkDownloadOptionsItem.setValue(o);
