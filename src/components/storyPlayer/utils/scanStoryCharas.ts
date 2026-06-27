import { Unzipper } from '@/scripts/zip';
import type { ZipEntry } from '@/components/folderPlayer/types';
import { normalizeElements, type RawStoryElement } from './storySource';
import { buildFrameStates } from './frameState';
import { buildFrameVoices } from './frameVoice';

export type ScannedChara = { name: string; voiceIds: Set<string>; isFulten: boolean };

/** ストーリー専用NPC（N始まりの6桁ID） */
const isStoryNpcId = (id: string): boolean => /^N[A-Za-z0-9]{5}$/.test(id);

const FULTEN_GROUP = 'ふるふる転生';

/** ZIP内meta.jsonのprofile.groupを読む。失敗・未取得はfalse */
const isZipFulten = async (zip: Awaited<ReturnType<typeof Unzipper.open>>): Promise<boolean> => {
  const meta = zip.entries.find((e) => !e.directory && (e.filename === 'meta.json' || e.filename.endsWith('/meta.json')));
  if (!meta) return false;
  const json = await zip.readFileAsJsonAsync<{ profile?: { group?: string } }>(meta.filename);
  return json?.profile?.group === FULTEN_GROUP;
};

/**
 * 本名はspeaker{1,2}_* (explicit) → backlog_icon_id+speaker対 (フォールバック) の順に解決。
 * 親ZIPがふる転グループなら発見したNPCもふる転扱い（DL時のsd_08除外に利用）。
 */
export const scanStoryCharas = async (
  entries: ReadonlyArray<ZipEntry>,
  excludeIds: ReadonlySet<string>,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, ScannedChara>> => {
  const appeared = new Set<string>();
  const voiceIdsByCharaId = new Map<string, Set<string>>();
  const nameById = new Map<string, string>();
  const fultenIds = new Set<string>();

  const addVoice = (charaId: string, voiceId: string) => {
    let set = voiceIdsByCharaId.get(charaId);
    if (!set) {
      set = new Set();
      voiceIdsByCharaId.set(charaId, set);
    }
    set.add(voiceId);
  };

  let done = 0;
  for (const entry of entries) {
    try {
      const zip = await Unzipper.open(await entry.fileHandle.getFile());
      const parentIsFulten = await isZipFulten(zip);
      const sources = zip.entries.filter((e) => !e.directory && e.filename.endsWith('source.json'));
      const localAppeared = new Set<string>();
      for (const src of sources) {
        const raw = await zip.readFileAsJsonAsync<Array<RawStoryElement>>(src.filename);
        if (!raw?.length) continue;
        const elements = normalizeElements(raw);
        const frames = buildFrameStates(elements, '');
        const { voices } = buildFrameVoices(elements, frames, '');

        for (const frame of frames) for (const slot of frame.slotSpecs) if (slot.charaId) localAppeared.add(slot.charaId);
        for (const el of elements) {
          if (el.backlog_icon_id) localAppeared.add(el.backlog_icon_id);
          if (el.speaker1_id && el.speaker1_name) nameById.set(el.speaker1_id, el.speaker1_name);
          if (el.speaker2_id && el.speaker2_name) nameById.set(el.speaker2_id, el.speaker2_name);
          if (el.backlog_icon_id && el.speaker && !nameById.has(el.backlog_icon_id)) {
            nameById.set(el.backlog_icon_id, el.speaker);
          }
        }
        for (const v of voices) {
          if (v.charaVoice?.kind === 'CharaVoice') addVoice(v.charaVoice.charaId, v.charaVoice.voiceId);
        }
      }
      for (const id of localAppeared) {
        appeared.add(id);
        if (parentIsFulten) fultenIds.add(id);
      }
    } catch {
      // 読めないZIPはスキップ
    }
    onProgress?.(++done, entries.length);
  }

  const result = new Map<string, ScannedChara>();
  for (const id of appeared) {
    if (!isStoryNpcId(id) || excludeIds.has(id)) continue;
    result.set(id, { name: nameById.get(id) ?? id, voiceIds: voiceIdsByCharaId.get(id) ?? new Set(), isFulten: fultenIds.has(id) });
  }
  return result;
};
