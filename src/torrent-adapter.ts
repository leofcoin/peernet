export type TorrentSource = Uint8Array | ArrayBuffer | string

export interface TorrentAdapter {
  importTorrent(source: TorrentSource, context: { peernet: unknown; signal?: AbortSignal }): Promise<string>
  exportTorrent(hash: string, context: { peernet: unknown; signal?: AbortSignal }): Promise<Uint8Array | string>
}
