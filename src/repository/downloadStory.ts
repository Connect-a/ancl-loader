import JSZip from 'jszip';
import type { Character, Section, Story, StoryElement } from '@/@types';
import { decode, encode } from '@msgpack/msgpack';
import { useMainStore } from '@/store';
import { useAdditionalDataStore } from '@/store/additionalDataStore';

export const fillStoryData = async (stories: Array<Story>, enableStidMap: Map<number, Story>) => {
  const additionalDataStore = useAdditionalDataStore();
  return stories
    .filter((x) => enableStidMap.has(x.st_id))
    .map(async (story) => ({
      ...story,
      storyId:
        additionalDataStore.storyAdditionalData.find((x) => x.stid === story.st_id)?.storyId ??
        (await fetchStoryId(story.st_id)),
    }))
    .filter(async (x) => (await x).storyId)
    .map(async (story) => {
      const s = await story;
      return {
        ...s,
        elements: (await fetchStoryElements(s, s.storyId)) ?? [],
      };
    });
};

export const fetchStoryId = async (st_id: number) => {
  const token = useMainStore().token;
  if (!token) return;

  const res = await fetch('https://ancl.jp/game/api/v1/', {
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/x-msgpack',
      authorization: `Bearer ${token}`,
      'x-class': 'Story',
      'x-func': 'getStoryId',
      origin: 'https://ancl.jp',
    },
    body: encode({ params: { st_id } }),
  });

  const s = decode(await res.arrayBuffer()) as { result: { story_id: string } };
  return s.result?.story_id;
};

export const fetchStoryElements = async (story: Story, storyId?: string) => {
  if (!storyId) return;
  const res = await fetch(`https://ancl.jp/img/game/event/${story.img}/${storyId}.json`);
  return (await res.json()) as Array<StoryElement>;
};

export const downloadStory = async (
  dir: JSZip,
  story: Story & { storyId: string | undefined; elements: StoryElement[] },
  parent: Character | Section,
) => {
  const storyDir = dir?.folder(
    `${story.order.toString().padStart(2, '0')}_${story.chapter}_${story.name}`,
  );
  // 元データ
  storyDir?.file('source.json', JSON.stringify(story.elements, null, '  '));

  // テキスト
  {
    const textList = new Array<string>();
    textList.push(
      `\n${parent.name}\n・${story.chapter} 「${story.name}」\n\n${story.details}\n\n---\n\n`,
    );
    let prevElement: StoryElement | undefined;
    for (const e of story.elements) {
      if (prevElement?.speaker !== e.speaker) textList.push('\n');
      if (prevElement?.speaker !== e.speaker && e.speaker) textList.push(`◆${e.speaker}\n`);

      textList.push(`${e.text}\n`);

      const choises = [e.choice1, e.choice2, e.choice3];
      let choiseText = '';
      for (const c of choises) choiseText += `>${c}\n`;
      choiseText = choiseText.replaceAll('>\n', '');
      if (choiseText) textList.push(`\n${choiseText}\n`);

      prevElement = e;
    }
    storyDir?.file('text.txt', textList.join(''));
  }

  // ボイス
  const voices = story.elements
    .flatMap((e) => [
      e.p1_chara_voice_text,
      e.p2_chara_voice_text,
      e.p3_chara_voice_text,
      e.p4_chara_voice_text,
      e.p5_chara_voice_text,
    ])
    .filter((x) => x)
    .map((x) => ({
      name: x,
      res: fetch(`https://ancl.jp/img/game/event/${story.img}/voice/${x}`),
    }));
  if (voices.length) {
    const voiceDir = storyDir?.folder('voice');
    for (const x of voices) {
      const res = await x.res;
      if (res.ok) voiceDir?.file(x.name, res.blob());
    }
  }

  // 動画
  const movieList = new Set(story.elements.map((e) => e.movie_text).filter((x) => x));
  const movies = Array.from(movieList).map((x) => ({
    name: x,
    res: fetch(`https://ancl.jp/img/game/event/${story.img}/movie/${x}`),
  }));
  if (movies.length) {
    const movieDir = storyDir?.folder('movie');
    for (const x of movies) {
      const res = await x.res;
      if (res.ok) movieDir?.file(x.name, res.blob());
    }
  }

  // 画像
  const imageList = new Set(story.elements.map((e) => e.bg_img_text).filter((x) => x));
  const images = Array.from(imageList).map((x) => ({
    name: x,
    res: fetch(`https://ancl.jp/img/game/event/${story.img}/image/${x}`),
  }));
  const iconList = new Map(story.elements.map((e) => [e.backlog_icon_id, e.speaker]));
  images.push(
    ...Array.from(iconList)
      .filter(([k, _v]) => k && k !== '1')
      .map(([k, v]) => ({
        name: `${k}_${v}_ss.png`,
        res: fetch(`https://ancl.jp/img/game/chara/${k}/graphic/${k}_ss.png`),
      })),
  );
  const imageDir = storyDir?.folder('image');
  for (const x of images) {
    const res = await x.res;
    if (res.ok) imageDir?.file(x.name, res.blob());
  }
  for (const pref of ['s', 'n', 'r']) {
    const n = `${story.img}_${pref}thumb.jpg`;
    const res = await fetch(`https://ancl.jp/img/game/event/${story.img}/thumb/${n}`);
    if (res.ok) imageDir?.file(n, res.blob());
  }
};

export const downloadBg = async (dir: JSZip, stories: StoryElement[]) => {
  // BG画像集
  const bgImgDir = dir.folder('image');
  const bgImgs = stories.map((x) => x.bg_img_id).filter((x) => x !== '1');
  for (const x of new Set(bgImgs)) {
    const res = await fetch(`https://ancl.jp/img/game/asset/bg/story/${x}.jpg`);
    if (res.ok) bgImgDir?.file(`${x}.jpg`, res.blob());
  }
  // BGM集
  const bgmDir = dir.folder('bgm');
  const bgms = stories.map((x) => x.bg_bgm).filter((x) => x !== '1');
  for (const x of new Set(bgms)) {
    const res = await fetch(`https://ancl.jp/img/game/sound/bgm/${x}.m4a`);
    if (res.ok) bgmDir?.file(`${x}.m4a`, res.blob());
  }
};

export const downloadSectionImage = async (dir: JSZip, section: Section) => {
  const r = await fetch(`https://ancl.jp/img/game/event/section/${section.section_id}.jpg`);
  if (r.ok) dir.file(`${section.section_id}.jpg`, r.blob());
};
