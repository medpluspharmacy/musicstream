import { Op } from "sequelize";
import { MediaFile, StorageBackend, sequelize } from "../models/index.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { decryptSecret, encryptSecret } from "../lib/secret-cipher.js";
import { createLocalStorage, createS3Storage, environmentStorage, environmentSummary, verifyStorage, type MediaStorage } from "../lib/storage.js";
import { STORAGE_PROVIDERS, findProvider, normalizeBucket, normalizePrefix, resolveEndpoint, signingRegion } from "../lib/storage-providers.js";

// One client per saved location, rebuilt when the row changes.
const built = new Map<number, { stamp: number; storage: MediaStorage }>();

function build(row: StorageBackend): MediaStorage {
  if (row.driver === "local") return createLocalStorage();
  return createS3Storage({
    endpoint: row.endpoint,
    region: signingRegion(findProvider(row.provider), row.location),
    bucket: row.bucket,
    prefix: row.prefix,
    accessKeyId: row.accessKeyId ?? "",
    secretAccessKey: decryptSecret(row.secretAccessKey ?? ""),
    forcePathStyle: row.forcePathStyle,
  });
}

function storageFor(row: StorageBackend): MediaStorage {
  const stamp = row.updatedAt.getTime();
  const cached = built.get(row.id);
  if (cached?.stamp === stamp) return cached.storage;
  const storage = build(row);
  built.set(row.id, { stamp, storage });
  return storage;
}

/** Plain reasons only: the service's own error text isn't shown, since the address is user-supplied. */
function connectionError(err: unknown): HttpError {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  logger.warn({ name: e?.name, status: e?.$metadata?.httpStatusCode }, "Storage connection check failed");
  const status = e?.$metadata?.httpStatusCode;
  if (e?.name === "NoSuchBucket" || status === 404) return new HttpError(400, "Connected, but that bucket wasn't found.");
  if (e?.name === "InvalidAccessKeyId" || e?.name === "SignatureDoesNotMatch" || status === 401 || status === 403) {
    return new HttpError(400, "The storage service refused these keys. Check they're right and can read, write and delete in this bucket.");
  }
  return new HttpError(400, "Couldn't connect to the storage service. Check the region or address.");
}

function activeRow() {
  return StorageBackend.findOne({ where: { isActive: true } });
}

export default class StorageController {
  /** Where new uploads go. A null id means the server's environment settings. */
  static async forUpload(): Promise<{ storage: MediaStorage; backendId: number | null }> {
    const row = await activeRow();
    return row ? { storage: storageFor(row), backendId: row.id } : { storage: environmentStorage, backendId: null };
  }

  /** Where a file lives, which may not be where new uploads go any more. */
  static async forMedia(media: MediaFile): Promise<MediaStorage> {
    return StorageController.forBackend(media.storageBackendId);
  }

  /** The storage for a saved location id; null means the environment settings. */
  static async forBackend(backendId: number | null): Promise<MediaStorage> {
    if (backendId == null) return environmentStorage;
    const row = await StorageBackend.findByPk(backendId);
    if (!row) throw new Error(`Storage location ${backendId} is missing`);
    return storageFor(row);
  }

  /** Current settings for the admin UI. The secret key is never returned. */
  static async get() {
    const row = await activeRow();
    const filesElsewhere = await MediaFile.count({
      where: {
        storageKey: { [Op.ne]: null },
        storageBackendId: row ? { [Op.or]: [{ [Op.ne]: row.id }, { [Op.is]: null }] } : { [Op.ne]: null },
      },
    });
    const current = row
      ? {
          source: "saved" as const,
          provider: row.provider,
          location: row.location,
          endpoint: row.endpoint,
          bucket: row.bucket,
          prefix: row.prefix,
          accessKeyId: row.accessKeyId,
          hasSecret: !!row.secretAccessKey,
          forcePathStyle: row.forcePathStyle,
        }
      : { source: "environment" as const, location: "", accessKeyId: null, hasSecret: false, forcePathStyle: false, ...environmentSummary() };
    return { ...current, filesElsewhere, providers: STORAGE_PROVIDERS };
  }

  /**
   * Checks the location with a real write, read and delete, then sends new
   * uploads there. Existing files stay where they are. Leaving the secret out
   * keeps the saved one, but only for the same address and access key, so a
   * saved secret can't be sent to a different server.
   */
  static async save(input: Record<string, unknown>) {
    const provider = findProvider(input.provider);
    const { location, endpoint } = resolveEndpoint(provider, input.location, input.endpoint);
    const s3 = provider.driver === "s3";
    const bucket = s3 ? normalizeBucket(input.bucket) : "";
    const prefix = s3 ? normalizePrefix(input.prefix) : "";
    const accessKeyId = s3 && typeof input.accessKeyId === "string" ? input.accessKeyId.trim() : "";
    if (s3 && !accessKeyId) throw new HttpError(400, "Enter the access key");

    const [active, existing] = await Promise.all([
      activeRow(),
      StorageBackend.findOne({ where: { driver: provider.driver, endpoint, bucket, prefix } }),
    ]);

    let secret = "";
    if (s3) {
      const typed = typeof input.secretAccessKey === "string" ? input.secretAccessKey.trim() : "";
      const saved = [existing, active].find(r => r?.secretAccessKey && r.endpoint === endpoint && r.accessKeyId === accessKeyId);
      secret = typed || (saved ? decryptSecret(saved.secretAccessKey!) : "");
      if (!secret) throw new HttpError(400, "Enter the secret key");
    }

    const forcePathStyle = provider.id === "custom" && input.forcePathStyle === true;
    const candidate = s3
      ? createS3Storage({ endpoint, region: signingRegion(provider, location), bucket, prefix, accessKeyId, secretAccessKey: secret, forcePathStyle })
      : createLocalStorage();
    try {
      await verifyStorage(candidate);
    } catch (err) {
      throw connectionError(err);
    }

    await sequelize.transaction(async (transaction) => {
      // Leaves `existing` alone: clearing it behind Sequelize's back would make update() skip isActive.
      await StorageBackend.update({ isActive: false }, { where: { isActive: true, id: { [Op.ne]: existing?.id ?? 0 } }, transaction });
      const values = {
        driver: provider.driver, provider: provider.id, location, endpoint, bucket, prefix,
        accessKeyId: s3 ? accessKeyId : null,
        secretAccessKey: s3 ? encryptSecret(secret) : null,
        forcePathStyle, isActive: true, updatedAt: new Date(),
      };
      if (existing) await existing.update(values, { transaction });
      else await StorageBackend.create(values, { transaction });
    });
    return StorageController.get();
  }

  /** New uploads go back to the server's environment settings. Saved locations stay so their files keep playing. */
  static async useEnvironment() {
    await StorageBackend.update({ isActive: false }, { where: { isActive: true } });
    return StorageController.get();
  }
}
