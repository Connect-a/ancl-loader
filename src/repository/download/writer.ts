import { browser, type Browser } from 'wxt/browser';
import { toSafeFileName } from '@/utils/safeFileName';
import type { ZipDir } from '@/scripts/zip';

export interface ZipWriter {
  /** subDir=nullはルート直下。戻り値は書き込んだバイト数。 */
  save(zip: ZipDir, subDir: string | null, filename: string): Promise<number>;
}

export class DirectoryWriter implements ZipWriter {
  constructor(private readonly rootDir: FileSystemDirectoryHandle) {}
  async save(zip: ZipDir, subDir: string | null, filename: string): Promise<number> {
    const dir = subDir ? await this.rootDir.getDirectoryHandle(subDir, { create: true }) : this.rootDir;
    const blob = await zip.end();
    // getFileHandleは / \ : * ? " < > | を含む名前で失敗するため全角へ置換する
    const fileHandle = await dir.getFileHandle(toSafeFileName(filename), { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return blob.size;
  }
}

export class DialogWriter implements ZipWriter {
  async save(zip: ZipDir, _subDir: string | null, filename: string): Promise<number> {
    const blob = await zip.end();
    const url = URL.createObjectURL(blob);
    try {
      const id = await browser.downloads.download({ url, filename, saveAs: true });
      const listener = (delta: Browser.downloads.DownloadDelta) => {
        if (delta.id !== id) return;
        const downloadState = delta.state?.current;
        if (downloadState === 'complete' || downloadState === 'interrupted') {
          browser.downloads.onChanged.removeListener(listener);
          URL.revokeObjectURL(url);
        }
      };
      browser.downloads.onChanged.addListener(listener);
    } catch (e: unknown) {
      URL.revokeObjectURL(url);
      throw e;
    }
    return blob.size;
  }
}

// <a download> は完了検知不可のため遅延revoke
export class AnchorWriter implements ZipWriter {
  async save(zip: ZipDir, _subDir: string | null, filename: string): Promise<number> {
    const blob = await zip.end();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = filename;
    anchor.href = url;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return blob.size;
  }
}
