const ANCL_LOG_URL = 'https://ancl-receiver-v2.azurewebsites.net/api/log';

export type LogEntry = ReadonlyArray<string>;

export const sendAnclLog = async (entries: ReadonlyArray<LogEntry>): Promise<void> => {
  const list = entries.filter((e) => e.length > 0);
  if (!list.length) return;
  await fetch(ANCL_LOG_URL, {
    method: 'POST',
    mode: 'no-cors',
    cache: 'no-cache',
    credentials: 'same-origin',
    body: JSON.stringify({ v: __APP_VERSION__, ids: list }),
  }).catch(() => undefined);
};
