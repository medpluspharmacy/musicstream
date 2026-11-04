import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * Storage for uploaded media, selected with STORAGE_DRIVER:
 * - "local" (default): files on the server's disk under UPLOAD_DIR.
 * - "s3": any S3-compatible bucket, e.g. DigitalOcean Spaces. Use this on hosts
 *   whose disk is wiped on redeploy, such as DigitalOcean App Platform.
 */
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

class S3Storage implements MediaStorage {
  constructor(private client: S3Client, private bucket: string, private prefix: string) {}

  private objectKey(key: string) {
    assertKey(key);
    return this.prefix + key;
  }

  async saveFromPath(tmpPath: string, extension: string, contentType?: string) {
    const key = newKey(extension);
    const { size } = await fsp.stat(tmpPath);
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.objectKey(key),
      Body: fs.createReadStream(tmpPath),
      ContentLength: size,
      ContentType: contentType,
      ACL: "private",
    }));
    await fsp.rm(tmpPath, { force: true });
    return key;
  }

  async size(key: string) {
    const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }));
    return head.ContentLength ?? 0;
  }

  async openReadStream(key: string, range?: { start: number; end: number }) {
    const obj = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.objectKey(key),
      Range: range ? `bytes=${range.start}-${range.end}` : undefined,
    }));
    return obj.Body as Readable;
  }

  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }));
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when STORAGE_DRIVER=s3`);
  return value;
}

function createStorage(): MediaStorage {
  fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });
  const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase();
  if (driver === "local") return new LocalDiskStorage(UPLOAD_DIR);
  if (driver !== "s3") throw new Error(`Unknown STORAGE_DRIVER "${driver}" (use "local" or "s3")`);

  const client = new S3Client({
    endpoint: required("S3_ENDPOINT"),
    // Spaces ignores the region but the SDK needs one.
    region: process.env.S3_REGION?.trim() || "us-east-1",
    credentials: { accessKeyId: required("S3_ACCESS_KEY_ID"), secretAccessKey: required("S3_SECRET_ACCESS_KEY") },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    // Only send checksums when an operation requires them; not every S3-compatible service accepts the newer defaults.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const prefix = (process.env.S3_PREFIX?.trim() || "").replace(/^\/+|\/+$/g, "");
  return new S3Storage(client, required("S3_BUCKET"), prefix ? `${prefix}/` : "");
}

export const storage: MediaStorage = createStorage();
