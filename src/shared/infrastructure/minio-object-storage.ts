import { Readable } from 'stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ObjectStorage,
  ObjectStoragePutInput,
} from '../application/ports/object-storage.port';

/** Cliente MinIO vía API S3 (`forcePathStyle`). */
@Injectable()
export class MinioObjectStorage implements ObjectStorage, OnModuleInit {
  private readonly logger = new Logger(MinioObjectStorage.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.getOrThrow<string>('MINIO_SERVER_URL');
    const accessKeyId = this.config.getOrThrow<string>('MINIO_ROOT_USER');
    const secretAccessKey = this.config.getOrThrow<string>('MINIO_ROOT_PASSWORD');
    this.bucket = this.config.getOrThrow<string>('MINIO_BUCKET');

    this.client = new S3Client({
      endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBucket();
    } catch (error: unknown) {
      this.logger.error(
        `No se pudo asegurar el bucket MinIO "${this.bucket}"`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      this.logger.log(`Creando bucket MinIO "${this.bucket}"…`);
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async put(input: ObjectStoragePutInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async getStream(key: string): Promise<Readable> {
    const respuesta = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const body = respuesta.Body;
    if (!body) {
      throw new Error(`MinIO: objeto vacío (${key})`);
    }
    return body as Readable;
  }

  async getBuffer(key: string): Promise<Buffer> {
    const stream = await this.getStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
