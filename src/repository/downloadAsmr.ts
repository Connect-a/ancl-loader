import { decode, encode } from '@msgpack/msgpack';
import { useMainStore } from '@/store';
import type JSZip from 'jszip';
import type { AsmrChapter } from '@/@types';

export const fetchChapterId = async (ch_id: number) => {
  const token = useMainStore().token;
  if (!token) return;

  const res = await fetch('https://ancl.jp/game/api/v1/', {
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/x-msgpack',
      authorization: `Bearer ${token}`,
      'x-class': 'Voice',
      'x-func': 'getChapterId',
      origin: 'https://ancl.jp',
    },
    body: encode({ params: { ch_id } }),
  });

  const s = decode(await res.arrayBuffer()) as { result: { chapter_id: string } };
  return s.result?.chapter_id;
};

export const downloadChapter = async (dir: JSZip, chapter: AsmrChapter & { chapterId: string }) => {
  if (!chapter.chapterId) return;
  const htmlRes = await fetch(
    `https://ancl.jp/img/game/event/${chapter.chapterId}/${chapter.chapterId.toLowerCase()}.html`,
  );

  const e = await htmlRes.text();
  const imagePath = (e.match(/\/(image\/.+?\.jpg)/) ?? [])[1] ?? '';
  const voicePath = (e.match(/\/(voice\/.+?\.m4a)/) ?? [])[1] ?? '';

  const imageRes = await fetch(`https://ancl.jp/img/game/event/${chapter.chapterId}/${imagePath}`);
  const voiceRes = await fetch(`https://ancl.jp/img/game/event/${chapter.chapterId}/${voicePath}`);

  const chaperDir = dir.folder(`${chapter.order.toString().padStart(2, '0')}_${chapter.name}`);

  chaperDir?.file('source.html', e);
  chaperDir?.file(`${imagePath.replace('image/', '')}`, imageRes.arrayBuffer());
  chaperDir?.file(`${voicePath.replace('voice/', '')}`, voiceRes.arrayBuffer());
};
