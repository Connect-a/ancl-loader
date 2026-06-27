import { assets, type Asset } from '@/scripts/resolver/asset';
import type { NormalizedStoryElement } from '../types';
import type { FrameState } from './frameState';
import { isNoVoice } from './storySource';

/**
 * 録音2系統を保持し再生時に選択・解決する。
 * - eventVoice: イベント収録 (chara_voice_text → StoryVoice)
 * - charaVoice: キャラ収録 (chara_voice_id=V9xx → CharaVoice)
 */
export type FrameVoice = { eventVoice: Asset | null; charaVoice: Asset | null; text: string; speaker: string };
export type SpeakerEntry = { key: string; label: string };

const CIRCLED_NUMBERS = '①②③④⑤⑥⑦⑧';

/** スロット順で最初のchara_voice_textをStoryVoiceにする。1 frame = 1 voice前提 */
const getEventVoice = (el: NormalizedStoryElement, eventId: string): Asset | null => {
  for (const slot of el.slots) {
    if (slot.charaVoiceText) return assets.storyVoice(eventId, slot.charaVoiceText);
  }
  return null;
};

/** スロット順で最初のV9xxをCharaVoiceにする。charaIdはframe stateの累積から解決 */
const getCharaVoice = (el: NormalizedStoryElement, frame: FrameState | undefined): Asset | null => {
  for (let p = 0; p < el.slots.length; p++) {
    const voiceId = el.slots[p]!.charaVoiceId;
    if (!isNoVoice(voiceId)) {
      const charaId = frame?.slotSpecs[p]?.charaId ?? '';
      return charaId ? assets.charaVoice(charaId, voiceId) : null;
    }
  }
  return null;
};

export function buildFrameVoices(
  elements: ReadonlyArray<NormalizedStoryElement>,
  frames: ReadonlyArray<FrameState>,
  eventId: string,
): { voices: Array<FrameVoice>; speakers: Array<string> } {
  const voices = new Array<FrameVoice>();
  const seen = new Set<string>();
  const speakers = new Array<string>();
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!;
    if (el.speaker && !seen.has(el.speaker)) {
      seen.add(el.speaker);
      speakers.push(el.speaker);
    }
    voices.push({
      eventVoice: getEventVoice(el, eventId),
      charaVoice: getCharaVoice(el, frames[i]),
      text: el.text,
      speaker: el.speaker,
    });
  }
  return { voices, speakers };
}

export function buildSpeakerEntries(speakers: ReadonlyArray<string>): Array<SpeakerEntry> {
  const head: Array<SpeakerEntry> = [{ key: '', label: '地の文' }];
  const charaEntries = new Array<SpeakerEntry>();
  let charaIndex = 0;
  for (const spk of speakers) {
    if (spk === 'あなた') {
      head.push({ key: spk, label: 'あなた' });
    } else {
      charaIndex++;
      charaEntries.push({
        key: spk,
        label: `キャラ${CIRCLED_NUMBERS[charaIndex - 1] ?? charaIndex}（${spk}）`,
      });
    }
  }
  return [...head, ...charaEntries];
}
