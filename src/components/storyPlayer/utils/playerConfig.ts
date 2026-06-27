import type { Ref } from 'vue';
import { storage } from '@wxt-dev/storage';
import { isSideTab, type SideTab } from '../types';

type PlayerConfig = {
  autoPlay?: boolean;
  sidePanel?: {
    open?: boolean;
    ratio?: number;
    tab?: string;
    vertical?: boolean;
    originalSize?: boolean;
  };
};

const playerConfigItem = storage.defineItem<PlayerConfig>('local:playerConfig');

export function createPlayerConfig(refs: {
  autoPlay: Ref<boolean>;
  sidePanel: {
    open: Ref<boolean>;
    ratio: Ref<number>;
    tab: Ref<SideTab>;
    vertical: Ref<boolean>;
    originalSize: Ref<boolean>;
  };
}) {
  const load = async () => {
    const cfg = await playerConfigItem.getValue();
    if (!cfg) return;
    if (typeof cfg.autoPlay === 'boolean') refs.autoPlay.value = cfg.autoPlay;
    const sp = cfg.sidePanel;
    if (!sp) return;
    if (typeof sp.open === 'boolean') refs.sidePanel.open.value = sp.open;
    if (typeof sp.ratio === 'number') refs.sidePanel.ratio.value = sp.ratio;
    if (typeof sp.tab === 'string' && isSideTab(sp.tab)) refs.sidePanel.tab.value = sp.tab;
    if (typeof sp.vertical === 'boolean') refs.sidePanel.vertical.value = sp.vertical;
    if (typeof sp.originalSize === 'boolean') refs.sidePanel.originalSize.value = sp.originalSize;
  };
  const save = async () => {
    await playerConfigItem.setValue({
      autoPlay: refs.autoPlay.value,
      sidePanel: {
        open: refs.sidePanel.open.value,
        ratio: refs.sidePanel.ratio.value,
        tab: refs.sidePanel.tab.value,
        vertical: refs.sidePanel.vertical.value,
        originalSize: refs.sidePanel.originalSize.value,
      },
    } satisfies PlayerConfig);
  };
  return { load, save };
}
