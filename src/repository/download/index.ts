import { ZipDir } from '@/scripts/zip';
import type { Character } from '@/scripts/character';
import type { Section, Story } from '@/@types';
import { loadAnclDownloadContext, type AnclDownloadContext, type StoryRecord } from '@/scripts/anclData';
import { downloadStory, fillStoryData } from '@/repository/download/story';
import { appendDownloadHistory, appendSectionDownloadHistory } from '@/scripts/downloadHistory';
import { downloadCharaVoices } from './voice';
import molabLeft from '../data/molab_left.json';
import { downloadCharacterImages } from './charaImage';
import { charaSpine, eventMetaUrl, SKELETON_EXTS } from '../assetMap';
import { writeStoryList, writeStoryThumbnails, writeSectionThumb, writeSectionMeta } from './storyArchive';
import { homeLayout } from './homeLayout';
import { DialogWriter, type ZipWriter } from './writer';
import dayjs from 'dayjs';

const buildCharacterZip = async (character: Character, ctx: AnclDownloadContext): Promise<{ zip: ZipDir; complete: boolean }> => {
  const zip = new ZipDir(character.name);

  const stories = ctx.stories?.chara.story[character.chara_id];
  if (!stories) {
    throw new Error('【例外】ストーリーの取得失敗した。');
  }
  const storyDir = zip.folder('story');
  const filledStories = await fillStoryData(
    stories,
    ctx.enableStidMap,
    { id: character.chara_id, name: character.name },
    ctx.storyAdditionalData,
    ctx.token,
  );

  const tasks = new Array<Promise<unknown>>();
  const isFulten = character.profile.group === 'ふるふる転生';
  tasks.push(downloadCharaVoices(zip, character, ctx.specificVoice, isFulten));
  tasks.push(downloadCharacterImages(zip, character, isFulten));

  {
    const skeletonDir = zip.folder('skeleton');
    const types = ['spine_n', 'spine_w'] as const;
    for (const t of types) {
      const d = skeletonDir.folder(t);
      for (const e of SKELETON_EXTS) {
        tasks.push(d.fileFromUrlAsync(`skeleton${e}`, charaSpine.webUrlOf(character.chara_id, t, `skeleton${e}`)));
      }
    }
  }

  tasks.push(writeStoryList(storyDir, stories));
  tasks.push(...writeStoryThumbnails(storyDir, stories));

  let downloadedStoryCount = 0;
  for (const s of filledStories) {
    tasks.push(downloadStory(storyDir, s, character));
    downloadedStoryCount++;
  }

  const complete = downloadedStoryCount >= stories.length;

  const V413Text = molabLeft.find((x) => x.id === character.chara_id)?.text ?? '';
  tasks.push(
    zip.fileAsync(
      'meta.json',
      JSON.stringify({
        id: character.chara_id,
        name: character.name,
        msg: character.msg,
        voiceTextMap: V413Text ? { V413: V413Text } : undefined,
        profile: character.profile,
        incomplete: !complete,
        downloadedAt: dayjs().toISOString(),
        downloaderVersion: __APP_VERSION__,
      }),
    ),
  );

  await Promise.all(tasks);
  return { zip, complete };
};

type SectionZipInput = {
  section: Section;
  stories: Array<Story>;
  enableStidMap: ReadonlyMap<number, unknown>;
  /** 指定時のみイベント資産（logo/bgm/bg/howto画像）を含める */
  eventId?: string;
  onStatus?: (msg: string) => void;
  storyAdditional: ReadonlyArray<StoryRecord>;
  token: string;
};

const buildSectionZip = async (input: SectionZipInput): Promise<{ zip: ZipDir; complete: boolean }> => {
  const { section, stories, enableStidMap, eventId, onStatus, storyAdditional, token } = input;
  const zip = new ZipDir(section.name);
  const storyDir = zip.folder('story');

  onStatus?.('ストーリーデータのダウンロード中…');
  const filledStories = await fillStoryData(stories, enableStidMap, { id: section.section_id, name: section.name }, storyAdditional, token);

  const tasks = new Array<Promise<unknown>>();
  tasks.push(writeStoryList(storyDir, stories));
  tasks.push(...writeStoryThumbnails(storyDir, stories));
  let downloadedStoryCount = 0;
  for (const s of filledStories) {
    tasks.push(downloadStory(storyDir, s, section));
    downloadedStoryCount++;
  }

  tasks.push(writeSectionThumb(zip, section.section_id));

  if (eventId) {
    tasks.push(zip.fileFromUrlAsync('logo.png', eventMetaUrl(eventId, 'logo.png')));
    tasks.push(zip.fileFromUrlAsync('bgm.m4a', eventMetaUrl(eventId, 'bgm.m4a')));
    tasks.push(zip.fileFromUrlAsync('bg.jpg', eventMetaUrl(eventId, 'bg.jpg')));
    tasks.push(zip.fileFromUrlAsync(`${eventId}_1.jpg`, eventMetaUrl(eventId, `${eventId}_1.jpg`)));
    const resLeftChara = await fetch(eventMetaUrl(eventId, 'left_chara.json'), { signal: AbortSignal.timeout(120_000) });
    if (resLeftChara.ok) {
      tasks.push(zip.fileAsync('left_chara.json', await resLeftChara.clone().blob()));
      const leftCharaJson = await resLeftChara.json();
      if (Array.isArray(leftCharaJson?.howto)) {
        for (const x of Array.from(leftCharaJson.howto).flat()) {
          if (!`${x}`.startsWith('EVE')) continue;
          tasks.push(zip.fileFromUrlAsync(`${x}.jpg`, eventMetaUrl(eventId, `${x}.jpg`)));
        }
      }
    }
  }

  const complete = downloadedStoryCount >= stories.length;
  tasks.push(writeSectionMeta(zip, section, complete));

  onStatus?.('アーカイブなう…（時間かかるよ）');
  await Promise.all(tasks);
  return { zip, complete };
};

export const runCharacterDownload = async (
  writer: ZipWriter,
  character: Character,
  ctx: AnclDownloadContext,
): Promise<{ complete: boolean; bytes: number }> => {
  const { zip, complete } = await buildCharacterZip(character, ctx);
  const bytes = await writer.save(zip, homeLayout.charaDir(complete), homeLayout.charaZip(character.chara_id, character.name, complete));
  await appendDownloadHistory(character.chara_id, complete);
  return { complete, bytes };
};

export const downloadCharacter = async (character: Character): Promise<void> => {
  const ctx = await loadAnclDownloadContext();
  await runCharacterDownload(new DialogWriter(), character, ctx);
};

type SectionDownloadInput = {
  section: Section;
  stories: Array<Story>;
  enableStidMap: ReadonlyMap<number, unknown>;
  domain: 'event' | 'main';
  eventId?: string;
  storyAdditional: ReadonlyArray<StoryRecord>;
  token: string;
  onStatus?: (msg: string) => void;
};

export const runSectionDownload = async (writer: ZipWriter, input: SectionDownloadInput): Promise<{ complete: boolean; bytes: number }> => {
  const { section, stories, enableStidMap, domain, eventId, storyAdditional, token, onStatus } = input;
  const { zip, complete } = await buildSectionZip({ section, stories, enableStidMap, eventId, storyAdditional, token, onStatus });
  onStatus?.('リンク生成中…');
  const subDir = domain === 'event' ? homeLayout.eventDir : homeLayout.mainDir;
  const filename =
    domain === 'event' ? homeLayout.eventStoryZip(section.name, complete) : homeLayout.mainStoryZip(section.chapter, section.name, complete);
  const bytes = await writer.save(zip, subDir, filename);
  await appendSectionDownloadHistory(section.section_id, complete);
  return { complete, bytes };
};
