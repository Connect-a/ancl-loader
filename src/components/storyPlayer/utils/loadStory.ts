import type { Resolver } from '@/scripts/resolver/resolver';
import { assets } from '@/scripts/resolver/asset';
import type { Episode } from '@/scripts/resolver/entryManifest';
import { buildFrameStates, type FrameState } from './frameState';
import { buildFrameVoices, type FrameVoice } from './frameVoice';
import { normalizeElements, textSizeFactor, type RawStoryElement } from './storySource';
import type { NormalizedStoryElement } from '../types';

export type LoadedStory = {
  readonly eventId: string;
  readonly elements: ReadonlyArray<NormalizedStoryElement>;
  readonly frames: ReadonlyArray<FrameState>;
  readonly movieUrls: ReadonlyArray<string>;
  readonly frameVoices: ReadonlyArray<FrameVoice>;
  readonly speakers: ReadonlyArray<string>;
  readonly reservedLines: number;
};

/** 枠高固定用。行数×倍率の最大値、下限2 */
const computeReservedLines = (elements: ReadonlyArray<NormalizedStoryElement>): number =>
  Math.max(2, ...elements.map((el) => (el.text ? el.text.split('\n').length : 1) * textSizeFactor(el.text_size)));

export async function loadStory(resolver: Resolver, episode: Episode): Promise<LoadedStory | null> {
  const raw = await resolver.readJson<Array<RawStoryElement>>(episode.sourcePath);
  if (!raw?.length) return null;
  const eventId = episode.img;
  if (!eventId) return null;
  const elements = normalizeElements(raw);
  const frames = buildFrameStates(elements, eventId);
  const { voices: frameVoices, speakers } = buildFrameVoices(elements, frames, eventId);
  const movieTexts = [...new Set(elements.map((e) => e.movie_text).filter(Boolean))];
  const movieUrls = (await Promise.all(movieTexts.map((t) => resolver.resolve(assets.storyMovie(eventId, t))))).filter(
    (u): u is string => u !== null,
  );
  return { eventId, elements, frames, movieUrls, frameVoices, speakers, reservedLines: computeReservedLines(elements) };
}
