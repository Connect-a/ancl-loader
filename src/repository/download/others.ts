import dayjs from 'dayjs';
import { ZipDir } from '@/scripts/zip';
import { monster, radio } from '../assetMap';
import type { Enemy, Radio } from '@/@types';
import type { LogEntry } from '@/scripts/anclLog';

export const buildEnemiesZip = async (zip: ZipDir, enemies: Enemy): Promise<void> => {
  const tasks = new Array<Promise<unknown>>();
  for (const enemy of Object.values(enemies)) {
    const enemyDir = zip.folder(`${enemy.section_id}_${enemy.name}`);
    tasks.push(enemyDir.fileAsync('meta.json', JSON.stringify(enemy)));
    const imageDir = enemyDir.folder('image');
    tasks.push(imageDir.fileFromUrlAsync('icon.png', monster.graphicUrlOf(enemy.img, 'icon.png')));
    tasks.push(imageDir.fileFromUrlAsync('pc.png', monster.graphicUrlOf(enemy.img, 'pc.png')));
    tasks.push(imageDir.fileFromUrlAsync('ok.png', monster.graphicUrlOf(enemy.img, 'ok.png')));
    const skeletonDir = enemyDir.folder('skeleton');
    tasks.push(skeletonDir.fileFromUrlAsync('skeleton.json', monster.spineUrlOf(enemy.img, 'skeleton.json')));
    tasks.push(skeletonDir.fileFromUrlAsync('skeleton.png', monster.spineUrlOf(enemy.img, 'skeleton.png')));
    tasks.push(skeletonDir.fileFromUrlAsync('skeleton.atlas', monster.spineUrlOf(enemy.img, 'skeleton.atlas')));
  }
  await Promise.all(tasks);
};

export const buildRadioZip = async (zip: ZipDir, radioData: Radio): Promise<Array<LogEntry>> => {
  const getHashCode = (ee: object) => Iterator.from(ee ? JSON.stringify(ee) : '').reduce((e, t) => ((e << 5) - e + t.charCodeAt(0)) | 0, 0);
  const query = `?h=${dayjs().valueOf()}${getHashCode(radioData.radio_guide)}`;
  const queryVal = query.split('=')[1] ?? '';
  const tasks = new Array<Promise<unknown>>();
  tasks.push(zip.fileFromUrlAsync('_番組表.jpg', `${radio.listUrl}${query}`));

  const logPayloads = new Array<LogEntry>();
  for (const guide of Object.values(radioData.radio_guide)) {
    const start = guide.start.replace(':', '');
    for (const x of guide.list) {
      tasks.push(zip.fileFromUrlAsync(`${start}_${guide.name}_${x}.m4a`, radio.programUrl(x)));
      logPayloads.push(['radio', start, guide.name, String(x), queryVal]);
    }
  }
  await Promise.all(tasks);
  return logPayloads;
};
