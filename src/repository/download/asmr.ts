import dayjs from 'dayjs';
import { ZipDir } from '@/scripts/zip';
import { toSafeFileName } from '@/utils/safeFileName';
import { eventAssets } from '../assetMap';
import { homeLayout } from './homeLayout';
import { type ZipWriter } from './writer';
import { asmrPriceYen } from '../asmrSection';
import type { AsmrChapter, AsmrSection } from '@/@types';
import { resolveChapterIds, type AsmrAdditionalChapter } from '../gameDataResolver';

export type ChapterWithId = AsmrChapter & { chapterId: string };

const VOICE_PATH_RE = /\/(voice\/.+?\.m4a)/g;
const IMAGE_PATH_RE = /\/(image\/.+?\.jpg)/g;

const distinctPaths = (html: string, re: RegExp): Array<string> => [...new Set([...html.matchAll(re)].map((m) => m[1]!))];

const downloadChapter = async (dir: ZipDir, chapter: ChapterWithId) => {
  if (!chapter.chapterId) return;
  const html = await (await fetch(eventAssets.asmrHtml(chapter.chapterId))).text();

  const chapterDir = dir.folder(`${String(chapter.order).padStart(2, '0')}_${toSafeFileName(chapter.name)}`);
  const tasks = new Array<Promise<unknown>>();
  tasks.push(chapterDir.fileAsync('source.html', html));
  for (const p of distinctPaths(html, IMAGE_PATH_RE)) {
    const file = p.replace('image/', '');
    tasks.push(chapterDir.fileFromUrlAsync(file, eventAssets.image(chapter.chapterId, file)));
  }
  for (const p of distinctPaths(html, VOICE_PATH_RE)) {
    const file = p.replace('voice/', '');
    tasks.push(chapterDir.fileFromUrlAsync(file, eventAssets.voice(chapter.chapterId, file)));
  }
  await Promise.all(tasks);
};

export const runAsmrSectionDownload = async (
  writer: ZipWriter,
  section: AsmrSection,
  allChapters: ReadonlyArray<AsmrChapter>,
  additionalChapters: ReadonlyArray<AsmrAdditionalChapter>,
  token: string,
  onStatus?: (msg: string) => void,
): Promise<{ complete: boolean; bytes: number }> => {
  const idMap = await resolveChapterIds(allChapters, additionalChapters, section.section_id, token);
  const sample: ChapterWithId | null = section.sample_id ? { ch_id: 0, chapterId: section.sample_id, name: 'サンプル', order: 0 } : null;

  const tasks = new Array<Promise<unknown>>();
  const zip = new ZipDir(section.name);
  onStatus?.('セクションのダウンロード中…');
  tasks.push(zip.fileAsync('section.json', JSON.stringify({ ...section, downloadedAt: dayjs().toISOString(), downloaderVersion: __APP_VERSION__ })));
  tasks.push(zip.fileFromUrlAsync(`${section.img}.jpg`, eventAssets.sectionThumb(section.img)));
  if (asmrPriceYen(section) != null) tasks.push(zip.fileFromUrlAsync(`${section.section_id}_mod.jpg`, eventAssets.shopImage(section.section_id)));
  const enabledChapters = allChapters.filter((ch) => idMap.has(ch.ch_id));
  if (enabledChapters.length) {
    onStatus?.('チャプターのダウンロード中…');
    for (const ch of enabledChapters) tasks.push(downloadChapter(zip, { ...ch, chapterId: idMap.get(ch.ch_id)! }));
  }
  if (sample) {
    onStatus?.('サンプルのダウンロード中…');
    tasks.push(downloadChapter(zip, sample));
  }

  await Promise.all(tasks);
  onStatus?.('リンク生成中…');
  const bytes = await writer.save(zip, homeLayout.asmrDir, homeLayout.asmrZip(section.name));
  return { complete: true, bytes };
};
