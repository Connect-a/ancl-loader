import { defineExtensionMessaging } from '@webext-core/messaging';
import type { BulkDownloadItemSpec } from '@/scripts/bulkDownloadState';
import type { AdditionalRecord } from '@/scripts/anclData';

type BulkDownloadStartPayload = {
  intervalMin: number;
  items: Array<BulkDownloadItemSpec>;
  overwrite: boolean;
};

interface ProtocolMap {
  'capture/start'(): void;
  'capture/stop'(): void;
  'bulkDownload/start'(payload: BulkDownloadStartPayload): void;
  'bulkDownload/stop'(): void;
  'additionalData/add'(payload: Array<AdditionalRecord>): void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
