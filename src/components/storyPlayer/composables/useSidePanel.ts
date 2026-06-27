import { ref, computed, watch } from 'vue';
import type { Resolver } from '@/scripts/resolver/resolver';
import { assets, assetKey, assetBasename, type Asset } from '@/scripts/resolver/asset';
import type { EntryManifest } from '@/scripts/resolver/entryManifest';
import { isSideTab, type SideTab } from '../types';

type SideImageCategories = Readonly<Record<SideTab, ReadonlyArray<Asset>>>;

type SidePanelDeps = {
  resolver: Resolver;
  manifest: EntryManifest;
};

const imageAssetFromZipPath = (zipPath: string, manifest: EntryManifest): Asset | null => {
  if (manifest.charaId) {
    const m = zipPath.match(/^image\/(.+)$/);
    return m ? assets.charaImage(manifest.charaId, m[1]!) : null;
  }
  if (!zipPath.startsWith(manifest.rootDir)) return null;
  const m = zipPath.slice(manifest.rootDir.length).match(/^story\/([^/]+)\/image\/(.+)$/);
  if (!m) return null;
  const img = manifest.episodes.find((e) => e.folderName === m[1])?.img;
  return img ? assets.storyImage(img, m[2]!) : null;
};

const classifyImages = (imgs: ReadonlyArray<Asset>): SideImageCategories => {
  const result: Record<SideTab, Array<Asset>> = { sd: [], standing: [], gravure: [], other: [] };
  for (const asset of imgs) {
    const basename = assetBasename(asset);
    if (/sd_\d+\.png$/.test(basename)) result.sd.push(asset);
    else if (/(_merged_st_|st_)\d+\.png$/.test(basename) && !basename.includes('st_99')) result.standing.push(asset);
    else if (/(_merged_gr_|gr_)/.test(basename)) result.gravure.push(asset);
    else result.other.push(asset);
  }
  return result;
};

export function useSidePanel({ resolver, manifest }: SidePanelDeps, onConfigChange: () => void) {
  const open = ref(false);
  const ratio = ref(0.25);
  const tab = ref<SideTab>('standing');
  const vertical = ref(false);
  const dragging = ref(false);
  const originalSize = ref(false);

  const allImages = ref<Array<Asset>>([]);
  const userPickedKey = ref('');

  void resolver.listFiles(/image\/[^/]+\.(png|jpg)$/i).then((files) => {
    allImages.value = files.map((p) => imageAssetFromZipPath(p, manifest)).filter((a): a is Asset => a !== null);
  });

  const categories = computed((): SideImageCategories => classifyImages(allImages.value));
  const currentImages = computed(() => categories.value[tab.value] ?? []);
  const imageSelectItems = computed(() => currentImages.value.map((a) => ({ title: assetBasename(a), value: assetKey(a) })));

  const selectedAsset = computed((): Asset | null => {
    const current = currentImages.value;
    const picked = userPickedKey.value ? current.find((a) => assetKey(a) === userPickedKey.value) : null;
    return picked ?? current[0] ?? null;
  });
  const selectedKey = computed(() => (selectedAsset.value ? assetKey(selectedAsset.value) : ''));
  const selectedIndex = computed(() => (selectedAsset.value ? currentImages.value.findIndex((a) => a === selectedAsset.value) : -1));
  const hasPrevImage = computed(() => selectedIndex.value > 0);
  const hasNextImage = computed(() => selectedIndex.value >= 0 && selectedIndex.value < currentImages.value.length - 1);

  const imageUrl = ref<string | null>(null);
  watch(selectedAsset, async (asset) => {
    imageUrl.value = asset ? await resolver.resolve(asset) : null;
  });

  const toggle = () => {
    open.value = !open.value;
    onConfigChange();
  };
  const changeTab = (next: string) => {
    if (!isSideTab(next)) return;
    tab.value = next;
    onConfigChange();
  };
  const toggleOrientation = () => {
    vertical.value = !vertical.value;
    onConfigChange();
  };
  const toggleOriginalSize = () => {
    originalSize.value = !originalSize.value;
    onConfigChange();
  };
  const selectImage = (key: string) => {
    userPickedKey.value = key;
  };
  const stepImage = (delta: number) => {
    const next = currentImages.value[selectedIndex.value + delta];
    if (next) userPickedKey.value = assetKey(next);
  };
  const imagePrev = () => stepImage(-1);
  const imageNext = () => stepImage(1);

  const startResize = (e: PointerEvent) => {
    e.preventDefault();
    dragging.value = true;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const isVertical = vertical.value;
    const start = isVertical ? e.clientY : e.clientX;
    const startRatio = ratio.value;
    const size = (isVertical ? target.parentElement?.clientHeight : target.parentElement?.clientWidth) ?? 1;
    const onMove = (ev: PointerEvent) => {
      // 横: パネルは右なので左ドラッグ(減少)で拡大 / 縦: パネルは上なので下ドラッグ(増加)で拡大
      const delta = ((isVertical ? ev.clientY : ev.clientX) - start) / size;
      const newRatio = isVertical ? startRatio + delta : startRatio - delta;
      ratio.value = Math.max(0.1, Math.min(0.8, newRatio));
    };
    const onUp = () => {
      dragging.value = false;
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      onConfigChange();
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  };

  return {
    open,
    ratio,
    tab,
    vertical,
    dragging,
    originalSize,
    currentImages,
    imageSelectItems,
    selectedImageKey: selectedKey,
    hasPrevImage,
    hasNextImage,
    imageUrl,
    toggle,
    changeTab,
    toggleOrientation,
    toggleOriginalSize,
    selectImage,
    imagePrev,
    imageNext,
    startResize,
  };
}

export type SidePanelApi = ReturnType<typeof useSidePanel>;
