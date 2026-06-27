import { ZipDir } from '@/scripts/zip';
import type { Character } from '@/scripts/character';
import type { Section, Story, StoryElement } from '@/@types';
import storyResourcesMaster from '@/repository/data/storyResources.json';
import { staticAssets, eventAssets } from '../assetMap';
import { getStoryFolderName } from './storyMeta';
import { resolveStoryIds } from '../gameDataResolver';
import { homeLayout } from './homeLayout';
import type { ZipWriter } from './writer';
import type { StoryRecord } from '@/scripts/anclData';

export const fillStoryData = async (
  stories: Array<Story>,
  enableStidMap: ReadonlyMap<number, unknown>,
  parent: { id: string; name: string },
  storyAdditional: ReadonlyArray<StoryRecord>,
  token: string,
): Promise<Array<Story & { storyId: string; elements: StoryElement[] }>> => {
  const enabled = stories.filter((s) => enableStidMap.has(s.st_id));
  const idMap = await resolveStoryIds(enabled, parent, storyAdditional, token);
  const results: Array<Story & { storyId: string; elements: StoryElement[] }> = [];
  for (const story of enabled) {
    const storyId = idMap.get(story.st_id);
    if (!storyId) continue;
    const elements = (await fetchStoryElements(story, storyId)) ?? [];
    results.push({ ...story, storyId, elements });
  }
  return results;
};

const fetchStoryElements = async (story: Story, storyId?: string) => {
  if (!storyId) return;
  const res = await fetch(eventAssets.storySource(story.img, storyId), { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) return;
  return (await res.json()) as Array<StoryElement>;
};

export const downloadStory = async (
  dir: ZipDir,
  story: Story & { storyId: string | undefined; elements: StoryElement[] },
  parent: Character | Section,
) => {
  const tasks = new Array<Promise<unknown>>();
  const storyDir = dir.folder(getStoryFolderName(story));
  tasks.push(storyDir.fileAsync('source.json', JSON.stringify(story.elements, null, '  ')));

  {
    const textList = new Array<string>();
    textList.push(`\n${parent.name}\n・${story.chapter} 「${story.name}」\n\n${story.details}\n\n---\n\n`);
    let prevElement: StoryElement | undefined;
    for (const e of story.elements) {
      const speakerChanged = prevElement?.speaker !== e.speaker;
      if (speakerChanged) textList.push('\n');
      if (speakerChanged && e.speaker) textList.push(`◆${e.speaker}\n`);

      textList.push(`${e.text}\n`);

      const choices = [e.choice1, e.choice2, e.choice3];
      let choiceText = '';
      for (const c of choices) choiceText += `>${c}\n`;
      choiceText = choiceText.replaceAll('>\n', '');
      if (choiceText) textList.push(`\n${choiceText}\n`);

      prevElement = e;
    }
    tasks.push(storyDir.fileAsync('text.txt', textList.join('')));
  }

  const voices = new Set(
    story.elements
      .flatMap((e) => [e.p1_chara_voice_text, e.p2_chara_voice_text, e.p3_chara_voice_text, e.p4_chara_voice_text, e.p5_chara_voice_text])
      .filter((x) => x),
  );
  if (voices.size) {
    const voiceDir = storyDir.folder('voice');
    for (const x of voices) {
      tasks.push(voiceDir.fileFromUrlAsync(x, eventAssets.voice(story.img, x)));
    }
  }

  const movieList = new Set(story.elements.map((e) => e.movie_text).filter((x) => x));
  if (movieList.size) {
    const movieDir = storyDir.folder('movie');
    for (const movie of movieList) {
      tasks.push(movieDir.fileFromUrlAsync(movie, eventAssets.movie(story.img, movie)));
    }
  }

  // サムネは一括保存、シーン画像(SC*)は共有リソースに含まれるためここでは除外
  const masterSceneImgSet = new Set(storyResourcesMaster.sceneImgs);
  const imageDir = storyDir.folder('image');
  const imageList = new Set(story.elements.map((e) => e.bg_img_text).filter((x) => x && !masterSceneImgSet.has(x)));
  for (const image of imageList) {
    tasks.push(imageDir.fileFromUrlAsync(image, eventAssets.image(story.img, image)));
  }

  // マスタに含まれないBG画像/BGMをストーリーローカルに同梱（'1' = 変更なし）
  const addLocalOverrides = (
    pick: (e: StoryElement) => string,
    masterIds: ReadonlyArray<string>,
    zipFolder: string,
    webBase: string,
    ext: string,
  ) => {
    const master = new Set(masterIds);
    const ids = new Set(story.elements.map(pick).filter((x) => x && x !== '1' && !master.has(x)));
    if (!ids.size) return;
    const folder = storyDir.folder(zipFolder);
    for (const id of ids) tasks.push(folder.fileFromUrlAsync(`${id}${ext}`, `${webBase}${id}${ext}`));
  };
  addLocalOverrides((e) => e.bg_img_id, storyResourcesMaster.bgImgIds, staticAssets.bg.zipFolder, staticAssets.bg.webBase, '.jpg');
  addLocalOverrides((e) => e.bg_bgm, storyResourcesMaster.bgmIds, staticAssets.bgm.zipFolder, staticAssets.bgm.webBase, '.m4a');

  await Promise.all(tasks);
};

export const downloadSharedResources = async (writer: ZipWriter): Promise<{ total: number; failed: number }> => {
  const dir = new ZipDir();

  const simpleCategory = <K extends keyof typeof staticAssets>(key: K, ids: ReadonlyArray<string>, ext: string) => {
    const asset = staticAssets[key];
    return {
      dir: dir.folder(asset.zipFolder),
      items: ids.map((id) => ({ file: `${id}${ext}`, url: `${asset.webBase}${id}${ext}` })),
    };
  };

  const categories = [
    simpleCategory('bg', storyResourcesMaster.bgImgIds, '.jpg'),
    simpleCategory('bgm', storyResourcesMaster.bgmIds, '.m4a'),
    simpleCategory('se', storyResourcesMaster.seIds, '.m4a'),
    simpleCategory('emo', storyResourcesMaster.emoIds, '.png'),
    {
      // scene_imgはマスタが拡張子込みのファイル名なのでsimpleCategoryに乗せられない
      dir: dir.folder(staticAssets.sceneImg004V.zipFolder),
      items: storyResourcesMaster.sceneImgs.map((x) => ({ file: x, url: `${staticAssets.sceneImg004V.webBase}${x}` })),
    },
  ];

  let failed = 0;
  for (const cat of categories) {
    const results = await Promise.all(cat.items.map(({ file, url }) => cat.dir.fileFromUrlAsync(file, url)));
    failed += results.filter((r) => r === null).length;
  }

  await writer.save(dir, homeLayout.sharedDir, homeLayout.sharedZip);
  const total = categories.reduce((n, c) => n + c.items.length, 0);
  return { total, failed };
};
