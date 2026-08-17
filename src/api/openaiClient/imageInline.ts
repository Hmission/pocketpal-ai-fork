/**
 * openaiClient/imageInline — 本地图片内联族（api 域拆分 · 批次4 P3）
 *
 * 远端服务器读不到设备文件系统 → 本地 image_url 读文件 base64 内联为
 * data: URI（encode-once 缓存 + 字节上限逐出）。自 src/api/openai.ts
 * 原样迁出（行为零变化）。
 */
import * as RNFS from '@dr.pogodin/react-native-fs';

import {OpenAIChatMessage} from './types';

/** A local image path needs inlining: not already a data: or http(s): url. */
function isLocalImageUrl(url: string | undefined): url is string {
  return (
    !!url &&
    !url.startsWith('data:') &&
    !url.startsWith('http://') &&
    !url.startsWith('https://')
  );
}

/** True when any message carries a local-path image that must be encoded. */
export function hasLocalImageAttachment(
  messages: OpenAIChatMessage[],
): boolean {
  return messages.some(
    m =>
      Array.isArray(m.content) &&
      m.content.some(part => isLocalImageUrl(part.image_url?.url)),
  );
}

// Skip inlining a file larger than this — base64 inflates ~33% and the whole
// buffer is held in memory, so a huge attachment would spike heap on low-RAM
// devices. The image is left unchanged and the server surfaces the failure.
const REMOTE_IMAGE_MAX_BYTES = 12 * 1024 * 1024;

// Bound the encode-once cache by total encoded-string bytes (evict-oldest)
// rather than entry count: a handful of large base64 buffers must not pin
// excessive resident heap.
const REMOTE_IMAGE_CACHE_BYTES = 24 * 1024 * 1024;

// Extension → data-URI MIME. A bare `image/${ext}` produced invalid types
// (image/jpg, image// for dotless / content:// paths). Unknown extensions fall
// back to image/jpeg.
const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
};

function mimeForPath(path: string): string {
  const ext = path.toLowerCase().split('.').pop() ?? '';
  return EXT_MIME[ext] ?? 'image/jpeg';
}

// Encoded local images keyed by path so a multi-turn history re-sends without
// re-reading each file from disk (chat.ts re-emits the same stored path across
// turns, so a history image encodes at most once).
const remoteImageCache = new Map<string, string>();
let remoteImageCacheBytes = 0;

function cacheRemoteImage(path: string, dataUri: string): void {
  if (remoteImageCache.has(path)) {
    return;
  }
  remoteImageCache.set(path, dataUri);
  remoteImageCacheBytes += dataUri.length;
  for (const [oldestPath, oldestUri] of remoteImageCache) {
    if (remoteImageCacheBytes <= REMOTE_IMAGE_CACHE_BYTES) {
      break;
    }
    remoteImageCache.delete(oldestPath);
    remoteImageCacheBytes -= oldestUri.length;
  }
}

/** Test-only: reset the encode-once remote-image cache between cases. */
export function __clearRemoteImageCache(): void {
  remoteImageCache.clear();
  remoteImageCacheBytes = 0;
}

/**
 * Encode a single content part's local image path to a data URI. Returns the
 * part unchanged when it is not a local image, when a successful stat reports
 * an over-cap file, or when the read fails. A stat throw or a size-less result
 * FALLS THROUGH to encoding so a healthy image is never dropped on a stat
 * hiccup — only a successful over-cap stat skips.
 */
async function encodeImagePart(part: {
  type: string;
  text?: string;
  image_url?: {url?: string};
}): Promise<typeof part> {
  const url = part.image_url?.url;
  if (!isLocalImageUrl(url)) {
    return part;
  }
  const path = url.replace(/^file:\/\//, '');

  const cached = remoteImageCache.get(path);
  if (cached) {
    return {...part, image_url: {url: cached}};
  }

  try {
    const info = await RNFS.stat(path);
    if (typeof info?.size === 'number' && info.size > REMOTE_IMAGE_MAX_BYTES) {
      return part;
    }
  } catch {
    // stat unavailable — encode anyway rather than drop a healthy image.
  }

  try {
    const base64 = await RNFS.readFile(path, 'base64');
    const dataUri = `data:${mimeForPath(path)};base64,${base64}`;
    cacheRemoteImage(path, dataUri);
    return {...part, image_url: {url: dataUri}};
  } catch (error) {
    // Leave the part unchanged; the server surfaces the failure on the
    // existing completion-error path.
    console.warn('Failed to encode image for remote server:', error);
    return part;
  }
}

/**
 * Encode local image attachments to data: URIs for the remote wire. A remote
 * server cannot read the device filesystem, so any image_url pointing at a
 * local path is read and inlined as base64. Already-remote (http/https) or
 * already-inlined (data:) urls pass through unchanged. Remote-only: the local
 * llama.rn engine reads the file path natively and never routes through here.
 *
 * Encodes sequentially (outer messages and inner parts) so peak heap is one
 * base64 buffer at a time on a long or multi-image history.
 */
export async function encodeMessagesForRemote(
  messages: OpenAIChatMessage[],
): Promise<OpenAIChatMessage[]> {
  const encoded: OpenAIChatMessage[] = [];
  for (const message of messages) {
    if (!Array.isArray(message.content)) {
      encoded.push(message);
      continue;
    }
    const content: typeof message.content = [];
    for (const part of message.content) {
      content.push(await encodeImagePart(part));
    }
    encoded.push({...message, content});
  }
  return encoded;
}
