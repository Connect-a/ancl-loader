export class BlobUrlRegistry {
  readonly #urls = new Set<string>();

  create(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.#urls.add(url);
    return url;
  }

  revoke(url: string): void {
    URL.revokeObjectURL(url);
    this.#urls.delete(url);
  }

  revokeAll(): void {
    for (const url of this.#urls) URL.revokeObjectURL(url);
    this.#urls.clear();
  }
}
