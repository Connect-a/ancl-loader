import * as browser from "webextension-polyfill";
import { AllStories, InitData } from "@/@types";

// 有効なst_idを返却
export const getEnableStidMap = async () => {
  const initData: InitData = await browser.runtime.sendMessage({ type: "getInitData" });
  const stories: AllStories = await browser.runtime.sendMessage({ type: "getStories" });
  if (!stories) return new Map();
  if (!initData) return new Map();

  const eventMap = new Map<string, string>(
    Object.entries(initData.result.player_data.story.event));

  return new Map(Object.entries(stories.event.story)
    .flatMap(
      ([section, stories]) =>
        stories
          .filter(s => {
            if (!eventMap.has(section)) return false;
            const open = Number.parseInt(eventMap.get(section)?.split('-')[0] ?? "0");
            return s.order <= open;
          })
          .map(s => [s.st_id, s])));
}

export const getSection = async () => {
  const stories: AllStories = await browser.runtime.sendMessage({ type: "getStories" });
  return Object.entries(stories.event.section).map(([k, v]) => v).sort((a, b) => a.section_id.localeCompare(b.section_id));
}

export const getStory = async (sectionId: string) => {
  const stories: AllStories = await browser.runtime.sendMessage({ type: "getStories" });
  return stories.event.story[sectionId];
}
