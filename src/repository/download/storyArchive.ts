import type { ZipDir } from '@/scripts/zip';
import type { Section } from '@/@types';
import dayjs from 'dayjs';
import { eventAssets } from '../assetMap';
import { ALL_AGES, type StoryListMeta, getStoryFolderName } from './storyMeta';

const THUMB_PREFIXES = ['s', 'n', 'r'] as const;

export const writeStoryList = (storyDir: ZipDir, stories: ReadonlyArray<StoryListMeta>): Promise<unknown> =>
  storyDir.fileAsync('list.json', JSON.stringify(stories, null, '  '));

export const writeStoryThumbnails = (storyDir: ZipDir, stories: ReadonlyArray<StoryListMeta>): Array<Promise<unknown>> => {
  const tasks = new Array<Promise<unknown>>();
  for (const story of stories) {
    const folder = storyDir.folder(getStoryFolderName(story));
    for (const pref of THUMB_PREFIXES) {
      if (story.adult_type === ALL_AGES && pref === 'r') continue;
      const file = `${story.img}_${pref}thumb.jpg`;
      tasks.push(folder.fileFromUrlAsync(file, eventAssets.thumb(story.img, file)));
    }
  }
  return tasks;
};

export const writeSectionThumb = (zip: ZipDir, sectionId: string): Promise<unknown> =>
  zip.fileFromUrlAsync(`${sectionId}.jpg`, eventAssets.sectionThumb(sectionId));

export const writeSectionMeta = (zip: ZipDir, section: Section, complete: boolean): Promise<unknown> =>
  zip.fileAsync(
    'section.json',
    JSON.stringify(
      {
        ...section,
        incomplete: !complete,
        downloadedAt: dayjs().toISOString(),
        downloaderVersion: __APP_VERSION__,
      },
      null,
      '  ',
    ),
  );
