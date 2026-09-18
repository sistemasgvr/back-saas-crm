import type { Readable } from 'stream';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStoragePutInput {
  key: string;
  body: Buffer;
  contentType: string;
}

/** Puerto S3-compatible (MinIO, R2, etc.) — sin acoplar a un vendor. */
export interface ObjectStorage {
  ensureBucket(): Promise<void>;
  put(input: ObjectStoragePutInput): Promise<void>;
  exists(key: string): Promise<boolean>;
  getStream(key: string): Promise<Readable>;
  getBuffer(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
