import 'server-only';

import { UploadCounterRepository } from '@/repositories/UploadCounterRepository';
import { UploadCounterService } from '@/services/upload/UploadCounterService';

let service: UploadCounterService | undefined;

export function getUploadCounterService(): UploadCounterService {
  service ??= new UploadCounterService(new UploadCounterRepository());
  return service;
}
