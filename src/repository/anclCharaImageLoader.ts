import imageMergePatterns from './imageMergePatterns.json';
import type { ZipDir } from '@/scripts/zip';

export const loadCharaImage = async (dir: ZipDir, canvas: HTMLCanvasElement, urlBase: string, imageSuffixList: Array<string>) => {
  const tasks = new Array<Promise<unknown>>();
  const blobMap = new Map<string, Promise<Blob>>();
  const images = imageSuffixList.map((x) => ({
    name: x,
    res: fetch(`${urlBase}${x}`),
  }));
  for (const x of images) {
    const d = await x.res;
    if (!d.ok || !d.body) continue;
    const b = d.blob();
    tasks.push(dir?.fileAsync(x.name, b));
    // 差分生成用に一時保存
    blobMap.set(x.name, b);
  }

  // 画像差分の生成
  tasks.push(mergeImg(dir, canvas, blobMap));
  await Promise.all(tasks);
};

const mergeImg = async (dir: ZipDir, canvas: HTMLCanvasElement, blobMap: Map<string, Promise<Blob>>) => {
  const tasks = new Array<Promise<unknown>>();
  const mergedPrefixes = new Array<string>();
  for (const mergePattern of imageMergePatterns as Array<Array<string>>) {
    if (!mergePattern.every((m) => blobMap.has(m))) continue;

    const prefix = mergePattern[0].split('_')[0];
    const num = mergedPrefixes
      .filter((x) => x === prefix)
      .length.toString()
      .padStart(2, '0');
    const merged =
      (await mergePng(
        canvas,
        mergePattern.map((x) => blobMap.get(x) ?? Promise.resolve(new Blob())),
      )) ?? new Blob();
    if (merged) tasks.push(dir.fileAsync(`_merged_${prefix}_${num}.png`, merged));

    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    mergedPrefixes.push(prefix);
  }
  await Promise.all(tasks);
};

const mergePng = async (canvas: HTMLCanvasElement, blobs: Array<Promise<Blob>>) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const bitmaps = await Promise.all(blobs.map(async (x) => createImageBitmap(await x)));
  canvas.width = bitmaps[0].width;
  canvas.height = bitmaps[0].height;
  bitmaps.forEach((x) => ctx.drawImage(x, 0, 0));
  return new Promise((r: BlobCallback) => canvas.toBlob(r, 'image/png', 1));
};
