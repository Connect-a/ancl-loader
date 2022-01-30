import * as browser from "webextension-polyfill";
import JSZip from "jszip";
import { Character, Voice } from "@/@types";
import specialVoice from "./specialVoice.json"
import voice from "./voice.json"
import imageSuffixes from "./imageSuffixes.json"
import { loadCharaImage } from "./anclCharaImageLoader";

export const downloadCharacter = async (dir: JSZip, character: Character, canvas: HTMLCanvasElement) => {
  dir?.file(`meta.json`, JSON.stringify({
    id: character.chara_id,
    name: character.name,
    msg: character.msg,
    profile: character.profile
  }, null, "  "));

  // ボイス
  {
    const voiceList = voice as Array<{ type: string, id: string }>
    // 戦闘 V801からV822
    Array(22).map(x => x)
    for (let i = 1; i <= 22; i++) voiceList.push({ type: "-", id: `V8${String(i).padStart(2, "0")}` });
    // 声 V901からV941
    for (let i = 1; i <= 41; i++) voiceList.push({ type: "-", id: `V9${String(i).padStart(2, "0")}` });

    // 特殊ボイス
    const specialVoices: Array<Voice> = await browser.runtime.sendMessage({ type: "getVoice" });
    voiceList.push(...specialVoices
      .filter(x => x.chara_id === character.chara_id)
      .filter(x => x.voice_id)
      .map(x => ({ type: "", id: x.voice_id })))
    // 特殊ボイス（手入力）
    const specialVoices2 = specialVoice as Array<{ chara_id: Array<string>, type: string, id: Array<string> }>
    const af = specialVoices2
      .filter(x => x.chara_id.includes(character.chara_id))
      .flatMap(x => x.id.map(y => ({ type: x.type, id: y })));
    voiceList.push(...af);

    // NOTE:重複除去してからfetch
    const voices = [...new Map(voiceList.map(v => [v.id, v.type])).entries()]
      .map(([id, type]) => ({
        name: `${id}.m4a`,
        res: fetch(`https://ancl.jp/img/game/chara/${character.chara_id}/voice/${id}.m4a`),
      }));
    if (voices.length) {
      const voiceDir = dir?.folder("voice");
      for (const x of voices) {
        const d = await x.res
        if (!d.ok) continue;
        voiceDir?.file(x.name, d.blob());
      }
    }
  }

  // 画像
  const base = `https://ancl.jp/img/game/chara/${character.chara_id}/graphic/${character.chara_id}_`;
  const imageSuffixList = imageSuffixes as Array<string>;
  for (let i = 1; i <= 26; i++) imageSuffixList.push(`sd_${String(i).padStart(2, "0")}.png`);
  for (let i = 51; i <= 56; i++) imageSuffixList.push(`sd_${String(i).padStart(2, "0")}.png`);
  const imageDir = dir?.folder("image");
  await loadCharaImage(imageDir ?? dir, canvas, base, imageSuffixList)
}

