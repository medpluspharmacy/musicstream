import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * Storage for uploaded media: the server's disk, or any S3-compatible bucket such
 * as DigitalOcean Spaces. Use a bucket on hosts whose disk is wiped on redeploy,
 * such as DigitalOcean App Platform.
 *
 * The Settings page can choose a location (controllers/StorageController).
 * Otherwise the environment decides, with STORAGE_DRIVER=local (default) or s3.
 */
/** True when a stored file is gone, e.g. a server disk wiped by a redeploy. */
export function isMissingFileError(err: unknown): boolean {
  const e = err as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.code === "ENOENT" || e?.name === "NoSuchKey" || e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404;
}

export interface MediaStorage {
  /** Moves an already-written temp file into storage and returns its key. */
  saveFromPath(tmpPath: string, extension: string, contentType?: string): Promise<string>;
  size(key: string): Promise<number>;
  openReadStream(key: string, range?: { start: number; end: number }): Promise<Readable>;
  remove(key: string): Promise<void>;
}

// Temp uploads always land on local disk first, even with the s3 driver.
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");
export const UPLOAD_TMP_DIR = path.join(UPLOAD_DIR, "tmp");

// Keys are generated server-side; still refuse anything that could escape the root.
function assertKey(key: string) {
  if (!/^media\/[a-f0-9-]+(\.[a-z0-9]+)?$/.test(key)) throw new Error("Invalid storage key");
}

function newKey(extension: string) {
  const ext = /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : "";
  return `media/${randomUUID()}${ext}`;
}

class LocalDiskStorage implements MediaStorage {
  constructor(private root: string) {
    fs.mkdirSync(path.join(root, "media"), { recursive: true });
  }

  private resolve(key: string): string {
    assertKey(key);
    return path.join(this.root, key);
  }

  async saveFromPath(tmpPath: string, extension: string) {
    const key = newKey(extension);
    await fsp.rename(tmpPath, this.resolve(key));
    return key;
  }

  async size(key: string) {
    return (await fsp.stat(this.resolve(key))).size;
  }

  async openReadStream(key: string, range?: { start: number; end: number }) {
    return fs.createReadStream(this.resolve(key), range);
  }

  async remove(key: string) {
    await fsp.rm(this.resolve(key), { force: true });
  }
}

// Time limits for storage requests, so an unresponsive service fails instead of hanging.
const QUICK_REQUEST_MS = 20_000;
const UPLOAD_BASE_MS = 60_000;
const UPLOAD_MIN_BYTES_PER_SEC = 100 * 1024;

/** Runs a storage request that gives up after `ms`. Streams are only timed until they start. */
async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Storage didn't respond within ${Math.round(ms / 1000)} s`)), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

class S3Storage implements MediaStorage {
  constructor(private client: S3Client, private bucket: string, private prefix: string) {}

  private objectKey(key: string) {
    assertKey(key);
    return this.prefix + key;
  }

  async saveFromPath(tmpPath: string, extension: string, contentType?: string) {
    const key = newKey(extension);
    const { size } = await fsp.stat(tmpPath);
    // Allows a slow connection (100 KB/s) for big files.
    const limit = UPLOAD_BASE_MS + (size / UPLOAD_MIN_BYTES_PER_SEC) * 1000;
    await withTimeout(limit, abortSignal => this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.objectKey(key),
      Body: fs.createReadStream(tmpPath),
      ContentLength: size,
      ContentType: contentType,
    }), { abortSignal }));
    await fsp.rm(tmpPath, { force: true });
    return key;
  }

  async size(key: string) {
    const head = await withTimeout(QUICK_REQUEST_MS, abortSignal =>
      this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }), { abortSignal }));
    return head.ContentLength ?? 0;
  }

  async openReadStream(key: string, range?: { start: number; end: number }) {
    // Timed until the file starts arriving; a long song then streams for as long as it plays.
    const obj = await withTimeout(QUICK_REQUEST_MS, abortSignal => this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.objectKey(key),
      Range: range ? `bytes=${range.start}-${range.end}` : undefined,
    }), { abortSignal }));
    return obj.Body as Readable;
  }

  async remove(key: string) {
    await withTimeout(QUICK_REQUEST_MS, abortSignal =>
      this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }), { abortSignal }));
  }
}

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export function createS3Storage(config: S3Config): MediaStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    forcePathStyle: config.forcePathStyle,
    // Only send checksums when an operation requires them; not every S3-compatible service accepts the newer defaults.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    // Fail quickly on a wrong address. There's no overall limit, because streams can run for hours.
    requestHandler: { connectionTimeout: 5000 },
  });
  return new S3Storage(client, config.bucket, config.prefix ? `${config.prefix}/` : "");
}

export function createLocalStorage(): MediaStorage {
  return new LocalDiskStorage(UPLOAD_DIR);
}

/** Proves a location works by writing, reading back and deleting a small file. Throws if it doesn't. */
export async function verifyStorage(target: MediaStorage) {
  const body = "musicstream";
  const tmpPath = path.join(UPLOAD_TMP_DIR, `check-${randomUUID()}`);
  await fsp.writeFile(tmpPath, body);
  let key: string | undefined;
  try {
    key = await target.saveFromPath(tmpPath, ".txt", "text/plain");
    if ((await target.size(key)) !== body.length) throw new Error("Storage returned the wrong size");
    let read = "";
    for await (const chunk of await target.openReadStream(key, { start: 0, end: 3 })) read += chunk.toString();
    if (read !== body.slice(0, 4)) throw new Error("Storage returned the wrong content");
  } finally {
    await fsp.rm(tmpPath, { force: true });
    if (key) await target.remove(key).catch(() => {});
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when STORAGE_DRIVER=s3`);
  return value;
}

const environmentDriver = (process.env.STORAGE_DRIVER || "local").toLowerCase();
const environmentPrefix = (process.env.S3_PREFIX?.trim() || "").replace(/^\/+|\/+$/g, "");

function createEnvironmentStorage(): MediaStorage {
  fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });
  if (environmentDriver === "local") return createLocalStorage();
  if (environmentDriver !== "s3") throw new Error(`Unknown STORAGE_DRIVER "${environmentDriver}" (use "local" or "s3")`);
  return createS3Storage({
    endpoint: required("S3_ENDPOINT"),
    // Spaces ignores the region but the SDK needs one.
    region: process.env.S3_REGION?.trim() || "us-east-1",
    bucket: required("S3_BUCKET"),
    prefix: environmentPrefix,
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });
}

/** Used until a location is chosen on the Settings page, and always for files uploaded under it. */
export const environmentStorage: MediaStorage = createEnvironmentStorage();

/** Non-secret description of the environment settings, for the Settings page. */
export function environmentSummary() {
  return environmentDriver === "s3"
    ? { provider: "custom", endpoint: process.env.S3_ENDPOINT?.trim() ?? "", bucket: process.env.S3_BUCKET?.trim() ?? "", prefix: environmentPrefix }
    : { provider: "local", endpoint: "", bucket: "", prefix: "" };
}
