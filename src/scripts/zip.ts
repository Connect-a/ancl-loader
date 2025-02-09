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
  type EntryMetaData,
} from '@zip.js/zip.js';

export type ZipEntry = Entry;

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

  folder = (dir: string) => new ZipDir(`${this.#dir}/${dir}`, this);
  fileAsync = async (filename: string, body: ReadableStream<Uint8Array> | Uint8Array | Blob | Promise<Blob> | string | null) => {
    if (!body) return Promise.resolve('fileAsyncに空のbodyが渡された。');
    const n = `${this.#dir}/${filename}`;
    if (this.#zipped.has(n)) {
      return Promise.resolve(`fileAsyncに同じ名前（${n}）が指定された。`);
    }

    this.#zipped.add(n);
    try {
      switch (true) {
        case body instanceof Uint8Array: {
          return await this.#zip.add(n, new Uint8ArrayReader(body));
        }
        case body instanceof ReadableStream: {
          return await this.#zip.add(n, body);
        }
        case body instanceof Blob: {
          return await this.#zip.add(n, new BlobReader(body));
        }
        case body instanceof Promise: {
          const b = await body;
          if (b instanceof Blob) {
            return await this.#zip.add(n, new BlobReader(b));
          }
          return Promise.resolve();
        }
        case body instanceof String:
        case typeof body === 'string': {
          return await this.#zip.add(n, new TextReader(body));
        }
        default: {
          throw Error(`fileAsyncに非対応のbodyが渡された。${body}`);
        }
      }
    } catch (e) {
      console.error(e);
    }

    return Promise.resolve();
  };
  fileFromUrlAsync = async (filename: string, url: string) => {
    let entry = {} as EntryMetaData;
    try {
      entry = await this.#zip.add(`${this.#dir}/${filename}`, new HttpReader(url));
      this.#zipped.add(`${this.#dir}/${filename}`);
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.error(e.message);
      }
    }
    return entry;
  };
  has = (filename: string) => this.#zipped.has(`${this.#dir}/${filename}`);
  end = () => this.#zip.close();
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

  async initAsync(file: File): Promise<void> {
    this.file = file;
    this.entries.splice(0);
    this.entries.push(...(await new ZipReader(new BlobReader(this.file)).getEntries()));
  }

  readFile(filename: string): ZipEntry {
    const target = this.entries.find((x: ZipEntry) => x.filename === filename);
    if (!target) {
      throw new Error(`存在していないファイルを読もうとした。（${filename}）`);
    }
    if (target.directory) {
      throw new Error(`ディレクトリを読もうとした。（${filename}）`);
    }
    return target;
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
