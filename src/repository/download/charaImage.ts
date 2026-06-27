import imageMergePatterns from '../data/imageMergePatterns.json';
import imageSuffixes from '../data/imageSuffixes.json';
import type { ZipDir } from '@/scripts/zip';
import type { Character } from '@/scripts/character';
import { charaImage, sd01To23Suffixes, sd51To56Suffixes } from '../assetMap';

const mergeImg = async (dir: ZipDir, canvas: OffscreenCanvas, blobMap: Map<string, Promise<Blob>>) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const tasks = new Array<Promise<unknown>>();
  const mergedPrefixes = new Array<string>();
  for (const mergePattern of imageMergePatterns as Array<Array<string>>) {
    if (!mergePattern.every((m) => blobMap.has(m))) continue;

    const prefix = mergePattern[0]!.split('_')[0]!;
    const num = mergedPrefixes
      .filter((x) => x === prefix)
      .length.toString()
      .padStart(2, '0');
    const bitmaps = await Promise.all(mergePattern.map(async (m) => createImageBitmap(await blobMap.get(m)!)));
    canvas.width = bitmaps[0]!.width;
    canvas.height = bitmaps[0]!.height;
    bitmaps.forEach((b) => ctx.drawImage(b, 0, 0));
    tasks.push(dir.fileAsync(`_merged_${prefix}_${num}.png`, await canvas.convertToBlob({ type: 'image/png' })));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    mergedPrefixes.push(prefix);
  }
  await Promise.all(tasks);
};

const loadCharaImages = async (dir: ZipDir, base: string, imageSuffixList: Array<string>, merge: boolean) => {
  const tasks = new Array<Promise<unknown>>();
  const blobMap = new Map<string, Promise<Blob>>();
  const images = imageSuffixList.map((x) => ({
    name: x,
    res: fetch(`${base}${x}`),
  }));
  for (const x of images) {
    const d = await x.res;
    if (!d.ok || !d.body) continue;
    const b = d.blob();
    tasks.push(dir.fileAsync(x.name, b));
    blobMap.set(x.name, b);
  }

  if (merge) tasks.push(mergeImg(dir, new OffscreenCanvas(0, 0), blobMap));
  await Promise.all(tasks);
};

export const downloadCharaImageSet = async (imageDir: ZipDir, base: string, suffixList: Array<string>, merge: boolean) => {
  await loadCharaImages(imageDir, base, suffixList, merge);
  if (imageDir.has('sd_23.png')) await loadCharaImages(imageDir, base, ['sd_24.png'], false);
  if (imageDir.has('sd_24.png')) await loadCharaImages(imageDir, base, ['sd_25.png'], false);
  if (imageDir.has('sd_25.png')) await loadCharaImages(imageDir, base, ['sd_26.png'], false);
};

const buildImageSuffixList = (isFulten: boolean): Array<string> => [
  ...imageSuffixes,
  ...sd01To23Suffixes.filter((s) => !isFulten || s !== 'sd_08.png'),
  ...sd51To56Suffixes,
];

export const downloadCharacterImages = async (zipDir: ZipDir, character: Character, isFulten: boolean) => {
  await downloadCharaImageSet(zipDir.folder('image'), charaImage.webUrlOf(character.chara_id, ''), buildImageSuffixList(isFulten), true);
};
