import {
  BlobReader,
  BlobWriter,
  Data64URIWriter,
  TextReader,
  TextWriter,
  ZipReader,
  ZipWriter,
  Uint8ArrayReader,
  HttpReader,
  type Entry,
  type FileEntry,
  type EntryMetaData,
} from '@zip.js/zip.js';

type ZipEntry = Entry;

export class ZipDir {
  #dir: string;
  #zip: ZipWriter<Blob>;
  #zipped = new Set<string>();
  constructor(dirName?: string, zipDir?: ZipDir) {
    this.#dir = dirName ?? '';
    if (zipDir) {
      this.#zip = zipDir.#zip;
      this.#zipped = zipDir.#zipped;
    } else {
      this.#zip = new ZipWriter(new BlobWriter('application/zip'), { bufferedWrite: true });
    }
  }

  folder = (dir: string) => new ZipDir(this.#dir ? `${this.#dir}/${dir}` : dir, this);
  fileAsync = async (filename: string, body: ReadableStream<Uint8Array> | Uint8Array | Blob | Promise<Blob> | string | null): Promise<void> => {
    if (!body) return;
    const n = this.#dir ? `${this.#dir}/${filename}` : filename;
    if (this.#zipped.has(n)) return;

    this.#zipped.add(n);
    try {
      switch (true) {
        case body instanceof Uint8Array:
          await this.#zip.add(n, new Uint8ArrayReader(body));
          break;
        case body instanceof ReadableStream:
          await this.#zip.add(n, body);
          break;
        case body instanceof Blob:
          await this.#zip.add(n, new BlobReader(body));
          break;
        case body instanceof Promise:
          await this.#zip.add(n, new BlobReader(await body));
          break;
        case typeof body === 'string':
          await this.#zip.add(n, new TextReader(body));
          break;
        default:
          throw new Error('zip: 非対応のbody型');
      }
    } catch (e: unknown) {
      this.#zipped.delete(n);
      console.warn(`zip: "${n}" 追加失敗: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  fileFromUrlAsync = async (filename: string, url: string): Promise<EntryMetaData | null> => {
    try {
      const n = this.#dir ? `${this.#dir}/${filename}` : filename;
      const entry = await this.#zip.add(n, new HttpReader(url, { preventHeadRequest: true }), { signal: AbortSignal.timeout(120_000) });
      this.#zipped.add(n);
      return entry;
    } catch (e: unknown) {
      console.warn(`zip: URL取得失敗 "${url}": ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };
  has = (filename: string) => this.#zipped.has(this.#dir ? `${this.#dir}/${filename}` : filename);
  end = (): Promise<Blob> => this.#zip.close();
}

export interface IUnzipper {
  file: File;
  entries: Array<ZipEntry>;
  initAsync(file: File): Promise<void>;
  readFile(filename: string): ZipEntry;
  readFileAsBlobAsync(filename: string): Promise<Blob> | undefined;
  readFileAsTextAsync(filename: string): Promise<string> | undefined;
  readFileAsJsonAsync<T>(filename: string): Promise<T | undefined>;
  readFileAsData64UriAsync(filename: string, mimeString?: string): Promise<string> | undefined;
}

class Unzipper implements IUnzipper {
  file: File;
  entries: Array<ZipEntry>;

  constructor() {
    this.file = new File([], '');
    this.entries = new Array<ZipEntry>();
  }

  static async open(file: File): Promise<Unzipper> {
    const u = new Unzipper();
    await u.initAsync(file);
    return u;
  }

  async initAsync(file: File): Promise<void> {
    this.file = file;
    this.entries.splice(0);
    this.entries.push(...(await new ZipReader(new BlobReader(this.file)).getEntries()));
  }

  readFile(filename: string): FileEntry {
    const target = this.entries.find((x: ZipEntry) => x.filename === filename);
    if (!target) {
      throw new Error(`存在していないファイルを読もうとした。（${filename}）`);
    }
    if (target.directory) {
      throw new Error(`ディレクトリを読もうとした。（${filename}）`);
    }
    return target as FileEntry;
  }

  readFileAsBlobAsync(filename: string): Promise<Blob> | undefined {
    return this.readFile(filename).getData?.(new BlobWriter());
  }

  readFileAsTextAsync(filename: string): Promise<string> | undefined {
    return this.readFile(filename).getData?.(new TextWriter());
  }

  async readFileAsJsonAsync<T>(filename: string): Promise<T | undefined> {
    return JSON.parse((await this.readFileAsTextAsync(filename)) ?? '{}') as T;
  }

  readFileAsData64UriAsync(filename: string, mimeString?: string): Promise<string> | undefined {
    return this.readFile(filename).getData?.(new Data64URIWriter(mimeString));
  }
}

export { Unzipper };
