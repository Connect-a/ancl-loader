import JSZip from "jszip";
import { loadCharaImage } from "./anclCharaImageLoader";
import characters from "./characters.json";
import charaSkeletons from "@/repository/characterSkeletons.json";

// 画像
const imageSuffixList = ["st_s_01.png", "st_s_02.png", "st_s_03.png", "st_s_04.png", "st_s_05.png", "st_s_06.png", "st_s_07.png", "st_s_99.png"];
const sdImageSuffixList = ["ss.png"]
for (let i = 1; i <= 27; i++) sdImageSuffixList.push(`sd_${String(i).padStart(2, "0")}.png`);
for (let i = 51; i <= 57; i++) sdImageSuffixList.push(`sd_${String(i).padStart(2, "0")}.png`);
// ボイス
// 声 V901からV941
const voiceList = new Array<{ type: string, id: string }>();
for (let i = 1; i <= 41; i++) voiceList.push({ type: "-", id: `V9${String(i).padStart(2, "0")}` });

export const downloadCharacter = async (dir: JSZip, createCanvas: () => HTMLCanvasElement) => {
  const promises = new Array<Promise<void>>();

  for (const c of characters) {
    const d = dir?.folder(c.name);
    //
    const imageBase = `https://ancl.jp/img/game/chara/${c.id}/graphic/${c.id}_`;
    const imageDir = d?.folder("image");
    if (!imageDir) continue;
    if (c.hasStandingPicture) promises.push(loadCharaImage(imageDir, createCanvas(), imageBase, imageSuffixList.concat(sdImageSuffixList)));
    if (!c.hasStandingPicture) promises.push(loadCharaImage(imageDir, createCanvas(), imageBase, sdImageSuffixList));
    //
    const voiceDir = d?.folder("voice");
    if (!voiceDir) continue;
    const voices = voiceList.map(x => ({
      name: `${x.id}.m4a`,
      res: fetch(`https://ancl.jp/img/game/chara/${c.id}/voice/${x.id}.m4a`)
    }));
    for (const x of voices) {
      const d = await x.res;
      if (!d.ok) continue;
      voiceDir?.file(x.name, d.blob());
    }
  }

  await Promise.all(promises);
}

export const downloadCharacterSkeleton = async (dir: JSZip) => {
  for (const c of charaSkeletons) {
    const charaDir = dir?.folder(c.name);
    const d = charaDir?.folder("skeleton");
    //
    const extensions = [".atlas", ".json", ".png"];
    for (const e of extensions) {
      const r = await fetch(`${c.path}${e}`);
      if (!r.ok) continue;
      d?.file(`skeleton${e}`, r.blob());
    }
  }
}