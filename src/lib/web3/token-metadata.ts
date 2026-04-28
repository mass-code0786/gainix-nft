import collectionConfig from "../../../config/gainix-nft-collection.json";

const DEFAULT_IPFS_GATEWAY = "https://dweb.link/ipfs/";
const FALLBACK_IPFS_GATEWAYS = ["https://w3s.link/ipfs/"];
const METADATA_REQUEST_TIMEOUT_MS = 5_000;

export interface ResolvedTokenMetadata {
  tokenUri: string;
  metadataUri: string;
  imageUri?: string;
  imageHttpUrl?: string;
  animationUri?: string;
  animationHttpUrl?: string;
  name?: string;
  description?: string;
  attributes?: Array<{ trait_type?: string; value?: string | number }>;
}

interface MetadataLike {
  name?: unknown;
  description?: unknown;
  image?: unknown;
  animation_url?: unknown;
  attributes?: unknown;
}

const metadataCache = new Map<string, Promise<ResolvedTokenMetadata>>();
const collectionAssetByMetadataFilename = new Map(
  collectionConfig.assets.map((asset) => [asset.metadataFilename.toLowerCase(), asset]),
);
const collectionAssetByCategoryAndTier = new Map(
  collectionConfig.assets.flatMap((asset) => {
    const category = typeof asset.attributes?.Category === "string" ? asset.attributes.Category.trim().toLowerCase() : "";
    const tier = typeof asset.attributes?.Tier === "string" ? asset.attributes.Tier.trim().toLowerCase() : "standard";

    return category ? [[`${category}:${tier}`, asset] as const] : [];
  }),
);

function normalizeIpfsGateway() {
  const rawGateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY?.trim();

  if (!rawGateway) {
    return DEFAULT_IPFS_GATEWAY;
  }

  return rawGateway.endsWith("/") ? rawGateway : `${rawGateway}/`;
}

function getIpfsGatewayCandidates() {
  return Array.from(new Set([normalizeIpfsGateway(), ...FALLBACK_IPFS_GATEWAYS]));
}

function normalizeIpfsPath(path: string) {
  return path
    .split("/")
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join("/");
}

export function sanitizeTokenUri(rawUri: string) {
  const trimmed = rawUri.trim();
  const duplicateIpfsStart = trimmed.indexOf("ipfs://", 7);

  if (duplicateIpfsStart !== -1) {
    return trimmed.slice(duplicateIpfsStart);
  }

  return trimmed;
}

export function isLegacyGainixDemoUri(uri?: string) {
  if (!uri) {
    return false;
  }

  const sanitizedUri = sanitizeTokenUri(uri);

  return sanitizedUri.includes("gainix-demo-nft-media") || sanitizedUri.includes("gainix-demo-nft-metadata");
}

export function ipfsToHttp(uri: string, gateway = normalizeIpfsGateway()) {
  const sanitizedUri = sanitizeTokenUri(uri);

  if (sanitizedUri.startsWith("ipfs://")) {
    const rawPath = sanitizedUri.replace("ipfs://", "").replace(/^ipfs\//i, "");
    const normalizedPath = normalizeIpfsPath(rawPath);
    return `${gateway}${normalizedPath}`;
  }

  return sanitizedUri;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = METADATA_REQUEST_TIMEOUT_MS) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`Metadata request timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    }),
  ]);
}

function toSafeString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function toSafeAttributes(value: unknown): ResolvedTokenMetadata["attributes"] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const attributes: Array<{ trait_type?: string; value?: string | number }> = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const trait_type = "trait_type" in entry ? toSafeString(entry.trait_type) : undefined;
    const rawValue = "value" in entry ? entry.value : undefined;
    const valueParsed = typeof rawValue === "string" || typeof rawValue === "number" ? rawValue : undefined;

    if (!trait_type && valueParsed === undefined) {
      continue;
    }

    attributes.push({
      trait_type,
      value: valueParsed,
    });
  }

  return attributes.length ? attributes : undefined;
}

function stripTextExtension(filename: string) {
  return filename.toLowerCase().endsWith(".txt") ? filename.slice(0, -4) : filename;
}

function getMetadataFilenameFromUri(uri: string) {
  const sanitizedUri = sanitizeTokenUri(uri);

  try {
    if (/^https?:\/\//i.test(sanitizedUri)) {
      const url = new URL(sanitizedUri);
      const pathname = decodeURIComponent(url.pathname);
      const filename = pathname.split("/").filter(Boolean).pop();
      return filename ? stripTextExtension(filename) : undefined;
    }
  } catch {
    // Fall back to string parsing below.
  }

  if (sanitizedUri.startsWith("ipfs://")) {
    const path = sanitizedUri.replace("ipfs://", "").replace(/^ipfs\//i, "");
    const filename = decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "");
    return filename ? stripTextExtension(filename) : undefined;
  }

  const filename = decodeURIComponent(sanitizedUri.split("/").filter(Boolean).pop() ?? "");
  return filename ? stripTextExtension(filename) : undefined;
}

function getCollectionAssetImageUri(imageFilename: string) {
  return `ipfs://${collectionConfig.ipfs.imageCid}/${normalizeIpfsPath(imageFilename)}`;
}

function buildCollectionMetadataFallback(tokenUri: string): Partial<ResolvedTokenMetadata> {
  const metadataFilename = getMetadataFilenameFromUri(tokenUri);

  if (!metadataFilename) {
    return {};
  }

  const asset = collectionAssetByMetadataFilename.get(metadataFilename.toLowerCase());

  if (!asset) {
    return {};
  }

  const imageUri = getCollectionAssetImageUri(asset.imageFilename);

  return {
    name: asset.name,
    description: `${asset.name} from the ${collectionConfig.name} collection on BNB testnet.`,
    imageUri,
    imageHttpUrl: ipfsToHttp(imageUri),
    attributes: Object.entries(asset.attributes ?? {}).map(([trait_type, value]) => ({
      trait_type,
      value,
    })),
  };
}

function buildCollectionTraitFallback(animalType?: string, rarity?: string): Partial<ResolvedTokenMetadata> {
  const normalizedCategory = animalType?.trim().toLowerCase();

  if (!normalizedCategory) {
    return {};
  }

  const preferredTier = rarity === "Legendary" || rarity === "Epic" ? "premium" : "standard";
  const asset =
    collectionAssetByCategoryAndTier.get(`${normalizedCategory}:${preferredTier}`) ??
    collectionAssetByCategoryAndTier.get(`${normalizedCategory}:standard`) ??
    collectionAssetByCategoryAndTier.get(`${normalizedCategory}:premium`);

  if (!asset) {
    return {};
  }

  const imageUri = getCollectionAssetImageUri(asset.imageFilename);

  return {
    imageUri,
    imageHttpUrl: ipfsToHttp(imageUri),
  };
}

function isBrokenAssetUri(uri?: string) {
  if (!uri) {
    return false;
  }

  const sanitizedUri = sanitizeTokenUri(uri);

  return sanitizedUri.includes("...") || sanitizedUri === "ipfs://" || sanitizedUri === "";
}

function resolveMetadataAssetUri(value: unknown, fallbackUri?: string) {
  const assetUri = toSafeString(value);
  const preferredUri =
    assetUri && !isBrokenAssetUri(assetUri) && !isLegacyGainixDemoUri(assetUri)
      ? sanitizeTokenUri(assetUri)
      : fallbackUri
        ? sanitizeTokenUri(fallbackUri)
        : undefined;

  if (!preferredUri) {
    return {
      uri: undefined,
      httpUrl: undefined,
    };
  }

  return {
    uri: preferredUri,
    httpUrl: preferredUri.startsWith("ipfs://") ? ipfsToHttp(preferredUri) : preferredUri,
  };
}

function extractIpfsPath(uri: string) {
  const sanitizedUri = sanitizeTokenUri(uri);

  if (sanitizedUri.startsWith("ipfs://")) {
    return sanitizedUri.replace("ipfs://", "").replace(/^ipfs\//i, "");
  }

  try {
    const url = new URL(sanitizedUri);
    const match = url.pathname.match(/\/ipfs\/(.+)$/i);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function buildHttpCandidates(uri: string) {
  const sanitizedUri = sanitizeTokenUri(uri);
  const ipfsPath = extractIpfsPath(sanitizedUri);

  if (!ipfsPath) {
    return [sanitizedUri];
  }

  const gatewayCandidates = getIpfsGatewayCandidates().map((gateway) => `${gateway}${normalizeIpfsPath(ipfsPath)}`);

  if (/^https?:\/\//i.test(sanitizedUri)) {
    return Array.from(new Set([sanitizedUri, ...gatewayCandidates]));
  }

  return gatewayCandidates;
}

function buildMetadataUriCandidates(metadataUri: string) {
  const candidates = [metadataUri];

  if (/\.json(?:[?#].*)?$/i.test(metadataUri) && !/\.json\.txt(?:[?#].*)?$/i.test(metadataUri)) {
    candidates.push(`${metadataUri}.txt`);
  }

  return candidates;
}

function tryParseMetadataPayload(value: string) {
  try {
    return JSON.parse(value) as MetadataLike;
  } catch {
    return null;
  }
}

async function fetchMetadataPayload(metadataUri: string) {
  for (const candidateUri of buildMetadataUriCandidates(metadataUri)) {
    for (const httpUrl of buildHttpCandidates(candidateUri)) {
      const response = await withTimeout(fetch(httpUrl, { cache: "force-cache" })).catch(() => null);

      if (!response?.ok) {
        continue;
      }

      const payload = tryParseMetadataPayload(await response.text());

      if (!payload) {
        continue;
      }

      return {
        metadataUri: candidateUri,
        httpUrl,
        payload,
      };
    }
  }

  return null;
}

export function resolvePreferredAssetHttpUrl(uri?: string) {
  if (!uri) {
    return undefined;
  }

  const candidates = buildHttpCandidates(uri);
  return candidates[0] ?? (uri.startsWith("ipfs://") ? ipfsToHttp(uri) : uri);
}

export function resolveNftImageUri({
  tokenUri,
  imageUri,
  animalType,
  rarity,
}: {
  tokenUri?: string;
  imageUri?: string;
  animalType?: string;
  rarity?: "Legendary" | "Epic" | "Rare" | "Uncommon";
}) {
  const preferredImageUri =
    imageUri && !isBrokenAssetUri(imageUri) && !isLegacyGainixDemoUri(imageUri) ? sanitizeTokenUri(imageUri) : undefined;
  const collectionFallback = tokenUri ? buildCollectionMetadataFallback(tokenUri) : {};
  const traitFallback = buildCollectionTraitFallback(animalType, rarity);
  const resolvedUri = preferredImageUri ?? collectionFallback.imageUri ?? traitFallback.imageUri;

  return resolvePreferredAssetHttpUrl(resolvedUri) ?? "";
}

async function fetchTokenMetadata(tokenUri: string): Promise<ResolvedTokenMetadata> {
  const normalizedTokenUri = sanitizeTokenUri(tokenUri);
  const collectionFallback = buildCollectionMetadataFallback(normalizedTokenUri);
  const fetchedMetadata = await fetchMetadataPayload(normalizedTokenUri);

  if (!fetchedMetadata) {
    const fallbackImageHttpUrl = resolvePreferredAssetHttpUrl(collectionFallback.imageUri);

    return {
      tokenUri,
      metadataUri: normalizedTokenUri,
      imageUri: collectionFallback.imageUri,
      imageHttpUrl: fallbackImageHttpUrl,
      name: collectionFallback.name,
      description: collectionFallback.description,
      attributes: collectionFallback.attributes,
    };
  }

  const payload = fetchedMetadata.payload;
  const rawImageUri = toSafeString(payload.image);
  const shouldPreferCollectionFallback = isBrokenAssetUri(rawImageUri) || isLegacyGainixDemoUri(rawImageUri);
  const fallbackImageUri = shouldPreferCollectionFallback ? collectionFallback.imageUri : undefined;
  const image = resolveMetadataAssetUri(payload.image, fallbackImageUri);
  const animation = resolveMetadataAssetUri(payload.animation_url);
  const imageHttpUrl = resolvePreferredAssetHttpUrl(image.uri);
  const animationHttpUrl = animation.uri ? resolvePreferredAssetHttpUrl(animation.uri) : undefined;
  const safeName = toSafeString(payload.name);
  const safeDescription = toSafeString(payload.description);
  const safeAttributes = toSafeAttributes(payload.attributes);

  return {
    tokenUri,
    metadataUri: fetchedMetadata.metadataUri,
    imageUri: image.uri,
    imageHttpUrl,
    animationUri: animation.uri,
    animationHttpUrl,
    name: shouldPreferCollectionFallback ? collectionFallback.name ?? safeName : safeName ?? collectionFallback.name,
    description:
      shouldPreferCollectionFallback
        ? collectionFallback.description ?? safeDescription
        : safeDescription ?? collectionFallback.description,
    attributes:
      shouldPreferCollectionFallback
        ? collectionFallback.attributes ?? safeAttributes
        : safeAttributes ?? collectionFallback.attributes,
  };
}

export async function resolveTokenMetadata(tokenUri: string) {
  const cacheKey = sanitizeTokenUri(tokenUri);

  if (!metadataCache.has(cacheKey)) {
    metadataCache.set(
      cacheKey,
      fetchTokenMetadata(tokenUri).catch(() => ({
        tokenUri,
        metadataUri: cacheKey,
        ...buildCollectionMetadataFallback(tokenUri),
      })),
    );
  }

  return metadataCache.get(cacheKey)!;
}
