import * as browser from "webextension-polyfill";
import { AllStories, Character, InitData, Story, StoryElement, Voice } from "@/@types";

// 有効なst_idを返却
export const getEnableStidMap = async () => {
  const initData: InitData = await browser.runtime.sendMessage({ type: "getInitData" });
  const stories: AllStories = await browser.runtime.sendMessage({ type: "getStories" });
  if (!stories) return new Map();
  if (!initData) return new Map();

  return new Map(Object.entries(stories.chara.story)
    .filter(([charaId, stories]) => initData.result.player_data.chara[charaId])
    .flatMap(
      ([charaId, stories]) =>
        stories
          .filter(s => s.order <= initData.result.player_data.story.chara[charaId])
          .map(s => [s.st_id, s])))
}

export const getCharacterStory = async (character: Character) => {
  const stories: AllStories = await browser.runtime.sendMessage({ type: "getStories" });
  return stories.chara.story[character.chara_id];
}
