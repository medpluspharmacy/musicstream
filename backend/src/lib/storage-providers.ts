import { HttpError } from "./http-error.js";

/**
 * Storage services offered on the Settings page. All the cloud ones speak the
 * S3 API, so a preset only has to work out the address from a region or account.
 */
export interface StorageProvider {
  id: string;
  name: string;
  driver: "local" | "s3";
  /** Address with {location} standing for the region or account; null when typed in. */
  endpointTemplate: string | null;
  /** What {location} is, for the form. Null when the provider doesn't need one. */
  locationLabel: string | null;
  locations: string[];
  /** Region given to the S3 client. Null means use the location. */
  signingRegion: string | null;
  keyHelp: string;
}

const REGION = /^[a-z0-9-]{2,40}$/;
const ACCOUNT_ID = /^[a-f0-9]{32}$/;

export const STORAGE_PROVIDERS: StorageProvider[] = [
  {
    id: "digitalocean",
    name: "DigitalOcean Spaces",
    driver: "s3",
    endpointTemplate: "https://{location}.digitaloceanspaces.com",
    locationLabel: "Region",
    locations: ["nyc3", "sfo2", "sfo3", "ams3", "fra1", "lon1", "tor1", "atl1", "sgp1", "blr1", "syd1"],
    signingRegion: "us-east-1", // Spaces ignores the region, but the client needs one.
    keyHelp: "Create a key under Spaces Object Storage, Access Keys.",
  },
  {
    id: "aws",
    name: "Amazon S3",
    driver: "s3",
    endpointTemplate: "https://s3.{location}.amazonaws.com",
    locationLabel: "Region",
    locations: ["us-east-1", "us-east-2", "us-west-2", "ca-central-1", "sa-east-1", "eu-west-1", "eu-west-2", "eu-central-1", "af-south-1", "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1"],
    signingRegion: null,
    keyHelp: "Use an IAM user limited to this bucket.",
  },
  {
    id: "cloudflare-r2",
    name: "Cloudflare R2",
    driver: "s3",
    endpointTemplate: "https://{location}.r2.cloudflarestorage.com",
    locationLabel: "Account ID",
    locations: [],
    signingRegion: "auto",
    keyHelp: "Create an R2 API token with Object Read & Write on this bucket.",
  },
  {
    id: "backblaze",
    name: "Backblaze B2",
    driver: "s3",
    endpointTemplate: "https://s3.{location}.backblazeb2.com",
    locationLabel: "Region",
    locations: ["us-west-000", "us-west-001", "us-west-002", "us-west-004", "us-east-005", "eu-central-003"],
    signingRegion: null,
    keyHelp: "Create an application key limited to this bucket. The region is part of the bucket's S3 endpoint.",
  },
  {
    id: "wasabi",
    name: "Wasabi",
    driver: "s3",
    endpointTemplate: "https://s3.{location}.wasabisys.com",
    locationLabel: "Region",
    locations: ["us-east-1", "us-east-2", "us-central-1", "us-west-1", "ca-central-1", "eu-central-1", "eu-central-2", "eu-west-1", "eu-west-2", "ap-northeast-1", "ap-southeast-1", "ap-southeast-2"],
    signingRegion: null,
    keyHelp: "Create an access key for a user limited to this bucket.",
  },
  {
    id: "google",
    name: "Google Cloud Storage",
    driver: "s3",
    endpointTemplate: "https://storage.googleapis.com",
    locationLabel: null,
    locations: [],
    signingRegion: "auto",
    keyHelp: "Create an HMAC key under Cloud Storage, Settings, Interoperability.",
  },
  {
    id: "custom",
    name: "Other S3-compatible (MinIO and others)",
    driver: "s3",
    endpointTemplate: null,
    locationLabel: "Region (optional)",
    locations: [],
    signingRegion: null,
    keyHelp: "Use a key limited to this bucket.",
  },
  {
    id: "local",
    name: "This server's disk",
    driver: "local",
    endpointTemplate: null,
    locationLabel: null,
    locations: [],
    signingRegion: null,
    keyHelp: "",
  },
];

export function findProvider(id: unknown): StorageProvider {
  const provider = STORAGE_PROVIDERS.find(p => p.id === id);
  if (!provider) throw new HttpError(400, "Choose a storage provider");
  return provider;
}

/** Region to sign requests with. Spaces and others ignore it, but the client needs one. */
export function signingRegion(provider: StorageProvider, location: string): string {
  return provider.signingRegion ?? (location || "us-east-1");
}

function isBlockedHost(host: string): boolean {
  // Cloud metadata services hand out server credentials.
  return host === "metadata.google.internal" || host.startsWith("169.254.") || host.startsWith("[fe80:") || host.startsWith("[fd00:ec2:");
}

function normalizeCustomEndpoint(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) throw new HttpError(400, "Enter the storage address");
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new HttpError(400, "Enter a valid storage address, e.g. https://storage.example.com");
  }
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  // Keys are signed but the media and the bucket traffic would otherwise be readable on the network.
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) throw new HttpError(400, "The storage address must start with https://");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new HttpError(400, "Enter only the address, without a path or login");
  if (isBlockedHost(url.hostname)) throw new HttpError(400, "That storage address isn't allowed");
  return url.origin;
}

/** Works out the address and checks the location, so it can't change which host gets the keys. */
export function resolveEndpoint(provider: StorageProvider, rawLocation: unknown, rawEndpoint: unknown): { location: string; endpoint: string } {
  const location = typeof rawLocation === "string" ? rawLocation.trim().toLowerCase() : "";
  if (provider.id === "custom") {
    if (location && !REGION.test(location)) throw new HttpError(400, "Enter a valid region");
    return { location, endpoint: normalizeCustomEndpoint(rawEndpoint) };
  }
  if (!provider.endpointTemplate) return { location: "", endpoint: "" };
  if (!provider.locationLabel) return { location: "", endpoint: provider.endpointTemplate };
  const valid = provider.id === "cloudflare-r2" ? ACCOUNT_ID.test(location) : REGION.test(location);
  if (!valid) throw new HttpError(400, `Enter a valid ${provider.locationLabel.toLowerCase()}`);
  return { location, endpoint: provider.endpointTemplate.replace("{location}", location) };
}

export function normalizeBucket(input: unknown): string {
  const bucket = typeof input === "string" ? input.trim() : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,61}[A-Za-z0-9]$/.test(bucket)) throw new HttpError(400, "Enter a valid bucket name");
  return bucket;
}

export function normalizePrefix(input: unknown): string {
  const prefix = (typeof input === "string" ? input.trim() : "").replace(/^\/+|\/+$/g, "");
  if (prefix.length > 200 || !/^[A-Za-z0-9._/-]*$/.test(prefix) || prefix.split("/").includes("..")) throw new HttpError(400, "The folder can only use letters, numbers, dots, dashes and slashes");
  return prefix;
}
