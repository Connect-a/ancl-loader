import type { VoicevoxParams } from '@/store/audioSettingsStore';

export type VoicevoxStyle = { title: string; value: number };

const normalize = (url: string) => url.replace(/\/+$/, '');

export async function voicevoxSynthesize(
  baseUrl: string,
  text: string,
  speakerId: number,
  params: VoicevoxParams,
  signal: AbortSignal,
): Promise<Blob | null> {
  const base = normalize(baseUrl);
  if (!base) return null;

  const queryRes = await fetch(`${base}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`, {
    method: 'POST',
    signal,
  });
  if (!queryRes.ok) return null;
  const query = (await queryRes.json()) as Record<string, unknown>;

  const synthRes = await fetch(`${base}/synthesis?speaker=${speakerId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...query, ...params }),
    signal,
  });
  if (!synthRes.ok) return null;

  return synthRes.blob();
}

type VoicevoxConnectResult = { ok: true; styles: Array<VoicevoxStyle> } | { ok: false; error: string };

export async function voicevoxConnect(baseUrl: string): Promise<VoicevoxConnectResult> {
  const base = normalize(baseUrl);
  try {
    const [vRes, sRes] = await Promise.all([fetch(`${base}/version`), fetch(`${base}/speakers`)]);
    if (!vRes.ok) return { ok: false, error: `サーバーエラー (HTTP ${vRes.status})` };
    if (!sRes.ok) return { ok: false, error: `話者一覧の取得に失敗 (HTTP ${sRes.status})` };

    const list = (await sRes.json()) as Array<{ name: string; styles: Array<{ name: string; id: number }> }>;
    const styles: Array<VoicevoxStyle> = list.flatMap((s) => s.styles.map((st) => ({ title: `${s.name} (${st.name})`, value: st.id })));
    return { ok: true, styles };
  } catch {
    return { ok: false, error: '接続できません — VOICEVOXが起動しているか確認してください' };
  }
}
