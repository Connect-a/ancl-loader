// 中断可能な遅延のWeb標準 (scheduler.postTask, Promise版setTimeout) はFirefox未実装のため自前で持つ。
export function delayAbortable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        resolve();
      },
      { once: true },
    );
  });
}
