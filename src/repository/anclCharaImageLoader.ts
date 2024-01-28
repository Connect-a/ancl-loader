import imageMergePatterns from './imageMergePatterns.json';
import JSZip from 'jszip';

export const loadCharaImage = async (
  dir: JSZip,
  canvas: HTMLCanvasElement,
  urlBase: string,
  imageSuffixList: Array<string>,
) => {
  const blobMap = new Map<string, Blob>();
  const images = imageSuffixList.map((x) => ({
    name: x,
    res: fetch(`${urlBase}${x}`),
  }));
  for (const x of images) {
    const d = await x.res;
    if (!d.ok) continue;
    const blob = await d.blob();
    dir?.file(x.name, blob);
    // 差分生成用に一時保存
    blobMap.set(x.name, blob);
  }

  // 画像差分の生成
  await mergeImg(dir, canvas, blobMap);
};

const mergeImg = async (
  dir: JSZip | null | undefined,
  canvas: HTMLCanvasElement,
  blobMap: Map<string, Blob>,
) => {
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
        mergePattern.map((x) => blobMap.get(x) ?? new Blob()),
      )) ?? new Blob();
    if (merged) dir?.file(`_merged_${prefix}_${num}.png`, merged);

    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    mergedPrefixes.push(prefix);
  }
};

const mergePng = async (canvas: HTMLCanvasElement, blobs: Array<Blob>) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const bitmaps = await Promise.all(blobs.map((x) => createImageBitmap(x)));
  canvas.width = bitmaps[0].width;
  canvas.height = bitmaps[0].height;
  bitmaps.forEach((x) => ctx.drawImage(x, 0, 0));
  return new Promise((r: BlobCallback) => canvas.toBlob(r, 'image/png', 1));
};
