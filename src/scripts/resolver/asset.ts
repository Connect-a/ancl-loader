export type Asset =
  | { kind: 'CharaImage'; charaId: string; file: string }
  | { kind: 'CharaVoice'; charaId: string; voiceId: string }
  | { kind: 'StoryVoice'; eventId: string; file: string }
  | { kind: 'StoryMovie'; eventId: string; file: string }
  | { kind: 'StoryImage'; eventId: string; file: string }
  | { kind: 'StoryBg'; eventId: string; file: string }
  | { kind: 'StoryBgm'; eventId: string; file: string }
  | { kind: 'Bg'; file: string }
  | { kind: 'Bgm'; file: string }
  | { kind: 'Se'; file: string }
  | { kind: 'Emo'; file: string }
  | { kind: 'SceneImg'; file: string };

export const assets = {
  charaImage: (charaId: string, file: string): Asset => ({ kind: 'CharaImage', charaId, file }),
  charaVoice: (charaId: string, voiceId: string): Asset => ({ kind: 'CharaVoice', charaId, voiceId }),
  storyVoice: (eventId: string, file: string): Asset => ({ kind: 'StoryVoice', eventId, file }),
  storyMovie: (eventId: string, file: string): Asset => ({ kind: 'StoryMovie', eventId, file }),
  storyImage: (eventId: string, file: string): Asset => ({ kind: 'StoryImage', eventId, file }),
  storyBg: (eventId: string, file: string): Asset => ({ kind: 'StoryBg', eventId, file }),
  storyBgm: (eventId: string, file: string): Asset => ({ kind: 'StoryBgm', eventId, file }),
  bg: (file: string): Asset => ({ kind: 'Bg', file }),
  bgm: (file: string): Asset => ({ kind: 'Bgm', file }),
  se: (file: string): Asset => ({ kind: 'Se', file }),
  emo: (file: string): Asset => ({ kind: 'Emo', file }),
  sceneImg: (file: string): Asset => ({ kind: 'SceneImg', file }),
};

export function assetBasename(asset: Asset): string {
  if (asset.kind === 'CharaVoice') return `${asset.voiceId}.m4a`;
  return asset.file.split('/').pop() ?? asset.file;
}

export function assetKey(asset: Asset): string {
  switch (asset.kind) {
    case 'CharaImage':
      return `chara/${asset.charaId}/image/${asset.file}`;
    case 'CharaVoice':
      return `chara/${asset.charaId}/voice/${asset.voiceId}.m4a`;
    case 'StoryVoice':
      return `event/${asset.eventId}/voice/${asset.file}`;
    case 'StoryMovie':
      return `event/${asset.eventId}/movie/${asset.file}`;
    case 'StoryImage':
      return `event/${asset.eventId}/image/${asset.file}`;
    case 'StoryBg':
      return `event/${asset.eventId}/bg/${asset.file}`;
    case 'StoryBgm':
      return `event/${asset.eventId}/bgm/${asset.file}`;
    case 'Bg':
      return `bg/${asset.file}`;
    case 'Bgm':
      return `bgm/${asset.file}`;
    case 'Se':
      return `se/${asset.file}`;
    case 'Emo':
      return `emo/${asset.file}`;
    case 'SceneImg':
      return `scene_img/${asset.file}`;
  }
}
