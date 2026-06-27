import { range } from '@/utils/array';
import type { ZipDir } from '@/scripts/zip';
import type { Character } from '@/scripts/character';
import type { SpecificVoice } from '@/@types';
import { charaVoice } from '../assetMap';
import specialVoice from '../data/specialVoice.json';
import voice from '../data/voice.json';

const v8xxVoiceIds: ReadonlyArray<string> = range(1, 22).map((i) => `V8${String(i).padStart(2, '0')}`); // 戦闘
const v9xxVoiceIds: ReadonlyArray<string> = range(1, 41).map((i) => `V9${String(i).padStart(2, '0')}`); // その他

type SpecialVoiceEntry = { chara_id: Array<string>; id: Array<string> };

const specialVoiceIdsOf = (charaId: string): Array<string> =>
  (specialVoice as Array<SpecialVoiceEntry>).filter((x) => x.chara_id.includes(charaId)).flatMap((x) => x.id);

const VOICE_PROBE_SETS = [
  { probe: 'V404', rest: ['V405', 'V406'] }, // 総選挙
  { probe: 'V407', rest: ['V408', 'V409', 'V410'] }, // 応援
] as const;

const buildVoiceIds = (character: Character, specificVoices: ReadonlyArray<SpecificVoice>, isFulten: boolean): Array<string> => {
  // 括弧付きコラボは応援を持つため、変種スキップから除外する（誤スキップ防止）
  const group = character.profile?.group ?? '';
  const isCollab = group.includes('コラボ') || group === 'DMM10周年';
  const isVariant = /[（(]/.test(character.name) && !isFulten && !isCollab;

  // probe実測で不在のIDを除外。ふる転はV101/V112/V416/V428/V433/V434、イベント変種はV411も不在
  const probeSetIds = VOICE_PROBE_SETS.flatMap((probeSet) => [probeSet.probe, ...probeSet.rest]);
  const excluded = new Set<string>(probeSetIds);
  if (isFulten) for (const id of ['V101', 'V112', 'V416', 'V428', 'V433', 'V434']) excluded.add(id);
  if (isVariant) excluded.add('V411');

  const ids = (voice as Array<{ id: string }>).map((x) => x.id).filter((id) => !excluded.has(id));

  // probeは通常キャラのみ試す（ふる転/変種は不在）
  if (!isFulten && !isVariant) ids.push(...VOICE_PROBE_SETS.map((probeSet) => probeSet.probe));
  ids.push(...v8xxVoiceIds); // 戦闘
  if (!isFulten) ids.push(...v9xxVoiceIds); // その他

  ids.push(...specificVoices.filter((x) => x.chara_id === character.chara_id && x.voice_id).map((x) => x.voice_id));
  ids.push(...specialVoiceIdsOf(character.chara_id));

  return ids.filter((x) => x);
};

export const downloadCharaVoices = async (
  zipDir: ZipDir,
  character: Character,
  specificVoices: ReadonlyArray<SpecificVoice>,
  isFulten: boolean,
): Promise<void> => {
  const voices = new Set(buildVoiceIds(character, specificVoices, isFulten));
  if (!voices.size) return;

  const voiceDir = zipDir.folder('voice');
  const fetchVoice = (id: string) => voiceDir.fileFromUrlAsync(`${id}.m4a`, charaVoice.webUrlOf(character.chara_id, id));
  await Promise.all([...voices].map(fetchVoice));

  // probeが実在（DL成功）したらrestを後続取得。awaitしないとzip.end()とレースして取りこぼす
  const restTasks = new Array<Promise<unknown>>();
  for (const { probe, rest } of VOICE_PROBE_SETS) {
    if (voiceDir.has(`${probe}.m4a`)) for (const id of rest) restTasks.push(fetchVoice(id));
  }
  await Promise.all(restTasks);
};

export const downloadVoicesByIds = async (zipDir: ZipDir, charaId: string, ids: ReadonlyArray<string>): Promise<void> => {
  if (!ids.length) return;
  const voiceDir = zipDir.folder('voice');
  await Promise.all(ids.map((id) => voiceDir.fileFromUrlAsync(`${id}.m4a`, charaVoice.webUrlOf(charaId, id))));
};

export const downloadOtherCharaVoices = async (
  zipDir: ZipDir,
  charaId: string,
  hasVoices: boolean,
  missingVoices: ReadonlyArray<string> = [],
): Promise<void> => {
  const missing = new Set(missingVoices);
  const ids = [...(hasVoices ? v9xxVoiceIds.filter((id) => !missing.has(id)) : []), ...specialVoiceIdsOf(charaId)];
  await downloadVoicesByIds(zipDir, charaId, ids);
};
