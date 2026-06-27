import { reactive } from 'vue';
import { useMainStore, TOKEN_ERROR_MESSAGE } from '@/store';

export type DownloadTask = () => Promise<void>;

// 手動DLを同時1つに制限する共有state。
const _state = reactive({ workingId: '', message: '' });

const isBusy = (): boolean => _state.workingId !== '';
const isActive = (id: string): boolean => _state.workingId === id;
const labelFor = (id: string): string => (_state.workingId === id ? _state.message : 'ダウンロード');

export const setDownloadMessage = (message: string): void => {
  _state.message = message;
};

const run = async (id: string, task: DownloadTask): Promise<void> => {
  _state.workingId = id;
  _state.message = '開始中…';
  try {
    await task();
  } catch (e: unknown) {
    console.error(e);
    alert(e instanceof Error ? e.message : String(e));
  } finally {
    _state.workingId = '';
    _state.message = '';
  }
};

// トークンエラー時はalertして実行しない。
const runWithToken = async (id: string, task: DownloadTask): Promise<void> => {
  if (useMainStore().tokenState === 'error') {
    alert(TOKEN_ERROR_MESSAGE);
    return;
  }
  await run(id, task);
};

export function useDownloadAction() {
  return { isBusy, isActive, labelFor, run, runWithToken };
}
