/// <reference lib="esnext" />
/// <reference lib="webworker" />

import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';
import { runtimeCaching } from '../service-worker/runtime-caching';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  ...(self.__SW_MANIFEST !== undefined ? { precacheEntries: self.__SW_MANIFEST } : {}),
  skipWaiting: true,
  clientsClaim: true,
  disableDevLogs: true,
  runtimeCaching,
});

serwist.addEventListeners();
