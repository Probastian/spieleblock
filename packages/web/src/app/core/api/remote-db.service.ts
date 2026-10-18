import { Injectable, inject } from '@angular/core';
import { ENDPOINTS, type CollectionEntry, type CollectionResponse, type DocResponse } from '@spieleblock/shared';
import { ApiHttp } from './http.service';
import { LiveStream, type DocSnapshot } from './live-stream';

export type { DocSnapshot } from './live-stream';

const docUrl = (path: string) => `${ENDPOINTS.doc}?path=${encodeURIComponent(path)}`;
const colUrl = (path: string) => `${ENDPOINTS.col}?path=${encodeURIComponent(path)}`;

/** Die Dokumentendatenbank auf dem Server: lesen, schreiben, löschen und live beobachten. */
@Injectable({ providedIn: 'root' })
export class RemoteDb {
  private readonly http = inject(ApiHttp);
  private live?: LiveStream;

  async getDoc<T = unknown>(path: string): Promise<DocSnapshot<T>> {
    const r = await this.http.request<DocResponse<T>>('GET', docUrl(path));
    return { id: path.slice(path.lastIndexOf('/') + 1), exists: r.exists, data: r.data };
  }

  async setDoc(path: string, data: unknown): Promise<void> {
    await this.http.request('PUT', docUrl(path), data);
  }

  async deleteDoc(path: string): Promise<void> {
    await this.http.request('DELETE', docUrl(path));
  }

  async getCollection<T = unknown>(path: string): Promise<CollectionEntry<T>[]> {
    return (await this.http.request<CollectionResponse<T>>('GET', colUrl(path))).docs;
  }

  watchDoc<T = unknown>(path: string, cb: (s: DocSnapshot<T>) => void): () => void {
    return this.stream().watchDoc(path, cb);
  }

  watchCollection<T = unknown>(path: string, cb: (docs: CollectionEntry<T>[]) => void): () => void {
    return this.stream().watchCollection(path, cb);
  }

  private stream(): LiveStream {
    return (this.live ??= new LiveStream(this.http));
  }
}
