export interface PackResult {
  clank: Buffer
  manifest: Record<string, unknown>
  contentHash: string
}

export function packCourse(files: Record<string, Uint8Array>): PackResult