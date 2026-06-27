import { BlobUrlRegistry } from '@/scripts/blobUrlRegistry';
import { staticAssets, charaImage, charaVoice, eventAssets } from '@/repository/assetMap';
import { Unzipper, type IUnzipper } from '@/scripts/zip';
import { type EntryManifest, storyAssetPath } from './entryManifest';
import type { Asset } from './asset';
import { assetKey } from './asset';
import { ZipSource, CharaZipSource, MetaZipSource } from './source';

type AssetSources = {
  entryZip: ZipSource;
  sharedZip: ZipSource | null;
  charaZip: CharaZipSource;
  manifest: EntryManifest;
  meta: MetaZipSource;
};

export type SessionInputs = {
  entryZip: IUnzipper;
  sharedZip: IUnzipper | null;
  charaHandleMap: ReadonlyMap<string, FileSystemFileHandle>;
  manifest: EntryManifest;
};

export type Resolver = {
  resolve(asset: Asset): Promise<string | null>;
  listFiles(pattern?: RegExp): Promise<Array<string>>;
  readJson<T>(path: string): Promise<T | null>;
  revokeAll(): void;
  /** prefixは assetKey ベース文字列で指定する。 */
  revokeByPrefix(prefix: string): void;
};

const staticAssetByKind: Record<'Bg' | 'Bgm' | 'Se' | 'Emo' | 'SceneImg', { zipFolder: string; webBase: string | null }> = {
  Bg: staticAssets.bg,
  Bgm: staticAssets.bgm,
  Se: staticAssets.se,
  Emo: staticAssets.emo,
  SceneImg: staticAssets.sceneImg004V,
};

const fetchBitmap = async (url: string): Promise<ImageBitmap> => createImageBitmap(await (await fetch(url)).blob());

// 立ち絵合成(`_merged_st_NN.png`)は body+face を canvas 合成する。
async function mergeStandingImage(charaId: string, mergedIndex: string): Promise<Blob | string | null> {
  const emotionIndex = String((parseInt(mergedIndex) || 0) + 1).padStart(2, '0');
  const bodyUrl = charaImage.webUrlOf(charaId, 'st_99.png');
  const faceUrl = charaImage.webUrlOf(charaId, `st_${emotionIndex}.png`);
  const [bodyR, faceR] = await Promise.allSettled([fetchBitmap(bodyUrl), fetchBitmap(faceUrl)]);
  const body = bodyR.status === 'fulfilled' ? bodyR.value : null;
  const face = faceR.status === 'fulfilled' ? faceR.value : null;
  if (!body || !face) {
    body?.close();
    face?.close();
    return bodyUrl;
  }
  try {
    const canvas = new OffscreenCanvas(body.width, body.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return bodyUrl;
    ctx.drawImage(body, 0, 0);
    ctx.drawImage(face, 0, 0);
    return await canvas.convertToBlob({ type: 'image/png' });
  } catch {
    return bodyUrl;
  } finally {
    body.close();
    face.close();
  }
}

export class AssetResolver implements Resolver {
  private blobUrls = new BlobUrlRegistry();
  private urlCache = new Map<string, Promise<string | null>>();

  constructor(private sources: AssetSources) {}

  static create({ entryZip, sharedZip, charaHandleMap, manifest }: SessionInputs): AssetResolver {
    const charaZip = new CharaZipSource(charaHandleMap, (f) => Unzipper.open(f));
    if (manifest.charaId) charaZip.registerEntry(manifest.charaId, entryZip);

    return new AssetResolver({
      entryZip: new ZipSource(entryZip),
      sharedZip: sharedZip ? new ZipSource(sharedZip) : null,
      charaZip,
      manifest,
      meta: new MetaZipSource([entryZip, sharedZip].filter((z): z is IUnzipper => !!z)),
    });
  }

  resolve(asset: Asset): Promise<string | null> {
    const key = assetKey(asset);
    const cached = this.urlCache.get(key);
    if (cached) return cached;
    const fresh = this.fetchRaw(asset).then((raw) => (raw === null ? null : this.toUrl(raw)));
    this.urlCache.set(key, fresh);
    return fresh;
  }

  private async fetchRaw(asset: Asset): Promise<Blob | string | null> {
    switch (asset.kind) {
      case 'CharaImage': {
        const local = await this.sources.charaZip.read(asset.charaId, `image/${asset.file}`);
        if (local) return local;
        const merged = asset.file.match(/^_merged_st_(\d+)\.png$/);
        return merged ? mergeStandingImage(asset.charaId, merged[1]!) : charaImage.webUrlOf(asset.charaId, asset.file);
      }
      case 'CharaVoice': {
        const local = await this.sources.charaZip.read(asset.charaId, `voice/${asset.voiceId}.m4a`);
        return local ?? charaVoice.webUrlOf(asset.charaId, asset.voiceId);
      }
      case 'StoryVoice':
      case 'StoryMovie':
      case 'StoryImage': {
        const category = asset.kind === 'StoryVoice' ? 'voice' : asset.kind === 'StoryMovie' ? 'movie' : 'image';
        const path = storyAssetPath(this.sources.manifest, asset.eventId, category, asset.file);
        const local = path ? await this.sources.entryZip.read(path) : null;
        return local ?? eventAssets[category](asset.eventId, asset.file);
      }
      case 'StoryBg':
      case 'StoryBgm': {
        const category = asset.kind === 'StoryBg' ? 'bg' : 'bgm';
        // bg/bgm は local override 専用（web fallbackは持たない）。
        const path = storyAssetPath(this.sources.manifest, asset.eventId, category, asset.file);
        return path ? this.sources.entryZip.read(path) : null;
      }
      case 'Bg':
      case 'Bgm':
      case 'Se':
      case 'Emo':
      case 'SceneImg': {
        const spec = staticAssetByKind[asset.kind];
        const local = await this.sources.entryZip.read(`${spec.zipFolder}/${asset.file}`);
        if (local) return local;
        const shared = await this.sources.sharedZip?.read(`${spec.zipFolder}/${asset.file}`);
        if (shared) return shared;
        return spec.webBase ? spec.webBase + asset.file : null;
      }
    }
  }

  revokeAll(): void {
    this.blobUrls.revokeAll();
    this.urlCache.clear();
    this.sources.charaZip.clearCache();
  }

  revokeByPrefix(prefix: string): void {
    if (!prefix) return;
    for (const [key, urlPromise] of this.urlCache) {
      if (!key.startsWith(prefix)) continue;
      void urlPromise.then((url) => {
        if (url !== null && url.startsWith('blob:')) this.blobUrls.revoke(url);
      });
      this.urlCache.delete(key);
    }
  }

  listFiles(pattern?: RegExp): Promise<Array<string>> {
    return this.sources.meta.listFiles(pattern);
  }

  readJson<T>(path: string): Promise<T | null> {
    return this.sources.meta.readJson<T>(path);
  }

  private toUrl(raw: Blob | string): string {
    return raw instanceof Blob ? this.blobUrls.create(raw) : raw;
  }
}
