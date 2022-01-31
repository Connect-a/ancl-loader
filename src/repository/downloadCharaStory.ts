import * as browser from "webextension-polyfill";
import { AdditionalStory, AllStories, Character, InitData } from "@/@types";

// 有効なst_idを返却
export const getEnableStidMap = async () => {
  const initData: InitData = await browser.runtime.sendMessage({ type: "getInitData" });
  const stories: AllStories = await browser.runtime.sendMessage({ type: "getStories" });
  if (!stories) return new Map();
  if (!initData) return new Map();

  const additionalStories: Array<AdditionalStory> = await browser.runtime.sendMessage({ type: "getAdditionalStories" });
  return new Map(Object.entries(stories.chara.story)
    .flatMap(
      ([charaId, stories]) =>
        stories
          .filter(s => {
            if (additionalStories.find(x => x.stid === s.st_id)) return true;
            const like = initData.result.player_data.story.chara[charaId];
            if (!like) return false;
            return s.order <= like;
          })
          .map(s => [s.st_id, s])))
}

export const getCharacterStory = async (character: Character) => {
  const stories: AllStories = await browser.runtime.sendMessage({ type: "getStories" });
  return stories.chara.story[character.chara_id];
}
