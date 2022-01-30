import * as browser from "webextension-polyfill";
import JSZip from "jszip";
import { AllStories, Character, InitData, Section, Story, StoryElement, Voice } from "@/@types";
import { decode, encode } from "@msgpack/msgpack";

// 有効なst_idを返却
export const getEnableStidMap = async () => {
  const initData: InitData = await browser.runtime.sendMessage({ type: "getInitData" });
  const stories: AllStories = await browser.runtime.sendMessage({ type: "getStories" });
  if (!stories) return new Map();
  if (!initData) return new Map();

  const [sectionId, opened] = Object.entries(initData.result.player_data.story.main)[0];

  return new Map(Object.entries(stories.main.story)
    .flatMap(
      ([section, stories]) =>
        stories
          .filter(s => {
            if (section.substring(3) < sectionId.substring(3)) return true;
            if (section.substring(3) === sectionId.substring(3) && s.order <= opened) return true;
            return false;
          })
          .map(s => [s.st_id, s])));
}

export const getSection = async () => {
  const stories: AllStories = await browser.runtime.sendMessage({ type: "getStories" });
  return Object.entries(stories.main.section).map(([k, v]) => v).sort((a, b) => a.order - b.order);
}

export const getStory = async (sectionId: string) => {
  const stories: AllStories = await browser.runtime.sendMessage({ type: "getStories" });
  return stories.main.story[sectionId];
}

export const fillStoryData = async (stories: Array<Story>, enableStidMap: Map<number, Story>) => {
  return stories
    .filter(x => enableStidMap.has(x.st_id))
    .map(async story => ({
      ...story,
      storyId: await fetchStoryId(story.st_id)
    }))
    .filter(async x => (await x).storyId)
    .map(async story => {
      const s = await story;
      return {
        ...s,
        elements: await fetchStoryElements(s, s.storyId) ?? []
      }
    });
}

export const fetchStoryId = async (st_id: number) => {
  const token = await browser.runtime.sendMessage({ type: "getToken" });
  if (!token) return;

  const res = await fetch("https://ancl.jp/game/api/v1/", {
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    credentials: 'same-origin',
    headers: {
      "content-type": "application/x-msgpack",
      "authorization": `Bearer ${token}`,
      "x-class": "Story",
      "x-func": "getStoryId",
      "origin": "https://ancl.jp"
    },
    body: encode({ params: { st_id } })
  });

  const s = decode(await res.arrayBuffer()) as { result: { story_id: string } };
  return s.result?.story_id;
};

export const fetchStoryElements = async (story: Story, storyId?: string) => {
  if (!storyId) return;
  const res = await fetch(`https://ancl.jp/img/game/event/${story.img}/${storyId}.json`);
  return (await res.json()) as Array<StoryElement>
}

export const downloadStory = async (
  dir: JSZip,
  story: Story & { storyId: string | undefined; elements: StoryElement[]; },
  parent: Character | Section
) => {
  const storyDir = dir?.folder(`${story.order.toString().padStart(2, "0")}_${story.chapter}_${story.name}`);
  // 元データ
  storyDir?.file(`source.json`, JSON.stringify(story.elements, null, "  "));

  // テキスト
  {
    let text = `\n${parent.name}\n・${story.chapter} 「${story.name}」\n\n${story.details}\n\n---\n\n`;
    let prevElement: StoryElement | undefined;
    for (const e of story.elements) {
      if (prevElement?.speaker !== e.speaker) text += `\n`;
      if (prevElement?.speaker !== e.speaker && e.speaker) text += `◆${e.speaker}\n`;
      text += `${e.text}\n`

      const choises = [e.choice1, e.choice2, e.choice3];
      let choiseText = "";
      for (const c of choises) choiseText += `>${c}\n`;
      choiseText = choiseText.replaceAll(">\n","");
      if (choiseText) text += `\n${choiseText}\n`;

      prevElement = e;
    }
    storyDir?.file(`text.txt`, text);
  }

  // ボイス
  const voices = story.elements
    .flatMap(e => [e.p1_chara_voice_text, e.p2_chara_voice_text, e.p3_chara_voice_text, e.p4_chara_voice_text, e.p5_chara_voice_text,])
    .filter(x => x)
    .map(x => ({ name: x, res: fetch(`https://ancl.jp/img/game/event/${story.img}/voice/${x}`) }));
  if (voices.length) {
    const voiceDir = storyDir?.folder("voice");
    for (const x of voices) {
      const d = await x.res
      if (!d.ok) continue;
      voiceDir?.file(x.name, d.blob());
    }
  }

  // 動画
  const movieList = new Set(story.elements
    .map(e => e.movie_text)
    .filter(x => x));
  const movies = Array.from(movieList).map(x => ({ name: x, res: fetch(`https://ancl.jp/img/game/event/${story.img}/movie/${x}`) }));
  if (movies.length) {
    const movieDir = storyDir?.folder("movie");
    for (const x of movies) {
      const d = await x.res;
      if (!d.ok) continue;
      movieDir?.file(x.name, d.blob());
    }
  }

  // 画像
  const imageList = new Set(story.elements
    .map(e => e.bg_img_text)
    .filter(x => x));
  const images = Array.from(imageList).map(x => ({ name: x, res: fetch(`https://ancl.jp/img/game/event/${story.img}/image/${x}`) }));
  const imageDir = storyDir?.folder("image");
  for (const x of images) {
    const d = await x.res
    if (!d.ok) continue;
    imageDir?.file(x.name, d.blob());
  }
  imageDir?.file(`${story.img}_sthumb.jpg`, (await fetch(`https://ancl.jp/img/game/event/${story.img}/thumb/${story.img}_sthumb.jpg`)).blob());
}

export const downloadBg = async (dir: JSZip, stories: StoryElement[]) => {
  // BG画像集
  const bgImgDir = dir.folder("image");
  const bgImgs = stories.map(x => x.bg_img_id);
  for (const x of new Set(bgImgs)) {
    const res = await fetch(`https://ancl.jp/img/game/asset/bg/story/${x}.jpg`);
    if (!res.ok) continue;
    bgImgDir?.file(`${x}.jpg`, res.blob());
  }
  // BGM集
  const bgmDir = dir.folder("bgm");
  const bgms = stories.map(x => x.bg_bgm);
  for (const x of new Set(bgms)) {
    const res = await fetch(`https://ancl.jp/img/game/sound/bgm/${x}.m4a`);
    if (!res.ok) continue;
    bgmDir?.file(`${x}.m4a`, res.blob());
  }
}

export const downloadSectionImage = async (dir: JSZip, section: Section) => {
  const r = await fetch(`https://ancl.jp/img/game/event/section/${section.section_id}.jpg`);
  if (!r.ok) return;
  dir.file(`${section.section_id}.jpg`, r.blob())
}