import { Global, Module } from '@nestjs/common';
import { OBJECT_STORAGE } from '../application/ports/object-storage.port';
import { MinioObjectStorage } from './minio-object-storage';

@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      useClass: MinioObjectStorage,
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class ObjectStorageModule {}
