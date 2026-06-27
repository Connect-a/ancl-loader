import dayjs from 'dayjs';
import { ZipDir } from '@/scripts/zip';
import { downloadCharaImageSet } from './charaImage';
import { charaImage, skeletonSpineUrlOf, SKELETON_EXTS, sd01To23Suffixes, sd51To56Suffixes, type SkeletonKind } from '../assetMap';
import characters from '../data/characters.json';
import charaSkeletonsData from '@/repository/data/characterSkeletons.json';
import { downloadOtherCharaVoices, downloadVoicesByIds } from './voice';
import { buildProtagonistZip } from './protagonist';
import { homeLayout } from './homeLayout';
import { type ZipWriter } from './writer';

const charaSkeletons = charaSkeletonsData as ReadonlyArray<{ id: string; name: string; kind: SkeletonKind }>;

type OtherCharacter = {
  id: string;
  name: string;
  hasStandingPicture: boolean;
  hasVoices: boolean;
  missingVoices?: Array<string>;
  isFulten?: boolean;
};

const imageSuffixList = [
  'st_01.png',
  'st_02.png',
  'st_03.png',
  'st_04.png',
  'st_05.png',
  'st_06.png',
  'st_07.png',
  'st_99.png',
  'st_s_01.png',
  'st_s_02.png',
  'st_s_03.png',
  'st_s_04.png',
  'st_s_05.png',
  'st_s_06.png',
  'st_s_07.png',
  'st_s_99.png',
];
const sdImageSuffixList = ['ss.png', ...sd01To23Suffixes, ...sd51To56Suffixes];
// ふる転キャラはサーバにsd_08が存在しないため除外
const sdImageSuffixListFulten = sdImageSuffixList.filter((s) => s !== 'sd_08.png');

export const fetchMergedCharacterList = async (): Promise<Array<OtherCharacter>> => {
  const list = [...(characters as Array<OtherCharacter>)];
  try {
    const res = await fetch('https://raw.githubusercontent.com/Connect-a/ancl-loader/master/src/repository/characters.json');
    if (res.ok) {
      for (const c of (await res.json()) as Array<OtherCharacter>) {
        if (!list.find((x) => x.id === c.id)) list.push(c);
      }
    }
  } catch {
    /* オフライン時はローカルのみ */
  }
  return list;
};

const downloadCharaAssets = async (target: ZipDir, c: OtherCharacter): Promise<void> => {
  const sdList = c.isFulten ? sdImageSuffixListFulten : sdImageSuffixList;
  const suffixList = c.hasStandingPicture ? imageSuffixList.concat(sdList) : sdList;
  await Promise.all([
    downloadCharaImageSet(target.folder('image'), charaImage.webUrlOf(c.id, ''), suffixList, c.hasStandingPicture),
    downloadOtherCharaVoices(target, c.id, c.hasVoices, c.missingVoices),
  ]);
};

const downloadSkeletonInto = async (target: ZipDir, id: string, kind: SkeletonKind): Promise<void> => {
  const skeletonDir = target.folder('skeleton');
  const urlOf = skeletonSpineUrlOf[kind];
  await Promise.all(SKELETON_EXTS.map((e) => skeletonDir.fileFromUrlAsync(`skeleton${e}`, urlOf(id, `skeleton${e}`))));
};

export const buildStoryCharactersZip = async (dir: ZipDir) => {
  const characterList = await fetchMergedCharacterList();
  for (const c of characterList) {
    await downloadCharaAssets(dir.folder(`${c.id}_${c.name}`), c);
  }
  for (const c of charaSkeletons) {
    await downloadSkeletonInto(dir.folder(c.name), c.id, c.kind);
  }
};

export const runStoryCharactersDownload = async (
  writer: ZipWriter,
  excludeIds: ReadonlySet<string>,
  onProgress?: (done: number, total: number, label: string) => void,
): Promise<{ total: number; failed: number; skipped: number }> => {
  const characterList = await fetchMergedCharacterList();
  const charIds = new Set(characterList.map((c) => c.id));
  const skeletonById = new Map(charaSkeletons.map((s) => [s.id, s]));
  const skeletonOnly = charaSkeletons.filter((s) => !charIds.has(s.id));

  const total = 1 + characterList.length + skeletonOnly.length;
  let done = 0;
  let failed = 0;
  let skipped = 0;
  const meta = (id: string, name: string) => JSON.stringify({ id, name, downloadedAt: dayjs().toISOString(), downloaderVersion: __APP_VERSION__ });

  if (excludeIds.has('000000')) {
    skipped++;
  } else {
    try {
      const { zip } = await buildProtagonistZip();
      await writer.save(zip, homeLayout.storyCharaDir, homeLayout.charaZip('000000', 'あなた', true));
    } catch {
      failed++;
    }
  }
  onProgress?.(++done, total, 'あなた');

  for (const c of characterList) {
    if (excludeIds.has(c.id)) {
      skipped++;
    } else {
      try {
        const zip = new ZipDir(c.name);
        await zip.fileAsync('meta.json', meta(c.id, c.name));
        await downloadCharaAssets(zip, c);
        const skel = skeletonById.get(c.id);
        if (skel) await downloadSkeletonInto(zip, skel.id, skel.kind);
        await writer.save(zip, homeLayout.storyCharaDir, homeLayout.charaZip(c.id, c.name, true));
      } catch {
        failed++;
      }
    }
    onProgress?.(++done, total, c.name);
  }

  for (const s of skeletonOnly) {
    if (excludeIds.has(s.id)) {
      skipped++;
    } else {
      try {
        const zip = new ZipDir(s.name);
        await zip.fileAsync('meta.json', meta(s.id, s.name));
        await downloadSkeletonInto(zip, s.id, s.kind);
        await writer.save(zip, homeLayout.storyCharaDir, homeLayout.charaZip(s.id, s.name, true));
      } catch {
        failed++;
      }
    }
    onProgress?.(++done, total, s.name);
  }

  return { total, failed, skipped };
};

export const runScannedStoryCharasDownload = async (
  writer: ZipWriter,
  missing: ReadonlyMap<string, { name: string; voiceIds: ReadonlySet<string>; isFulten: boolean }>,
  onProgress?: (done: number, total: number, label: string) => void,
): Promise<{ total: number; failed: number }> => {
  const total = missing.size;
  let done = 0;
  let failed = 0;
  for (const [id, info] of missing) {
    const displayName = info.isFulten && !info.name.includes('ふる転') ? `${info.name}(ふる転)` : info.name;
    try {
      const zip = new ZipDir(displayName);
      await zip.fileAsync(
        'meta.json',
        JSON.stringify({ id, name: displayName, downloadedAt: dayjs().toISOString(), downloaderVersion: __APP_VERSION__ }),
      );
      // 画像はSDのみ（立ち絵なし）＝hasStandingPicture:false経路を流用
      await downloadCharaAssets(zip, { id, name: displayName, hasStandingPicture: false, hasVoices: false, isFulten: info.isFulten });
      await downloadVoicesByIds(zip, id, [...info.voiceIds]);
      await writer.save(zip, homeLayout.storyCharaDir, homeLayout.charaZip(id, displayName, true));
    } catch {
      failed++;
    }
    onProgress?.(++done, total, displayName || id);
  }
  return { total, failed };
};
