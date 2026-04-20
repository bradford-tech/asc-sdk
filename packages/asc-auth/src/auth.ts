import { importPrivateKey } from "./crypto.js";
import { signASCTokenInternal } from "./sign.js";
import type { ASCAuth, ASCAuthOptions } from "./types.js";

const DEFAULT_REFRESH_BUFFER = 30;

/**
 * Create an auth provider for the App Store Connect API.
 *
 * Returns a callable function compatible with Hey API's `auth` option.
 * Tokens are cached and automatically refreshed before expiry.
 *
 * @example
 * ```ts
 * import { client } from "@bradford-tech/asc-sdk";
 * import { createASCAuth } from "@bradford-tech/asc-auth";
 *
 * const auth = createASCAuth({
 *   issuerId: "57246542-96fe-1a63-e053-0824d011072a",
 *   keyId: "2X9R4HXF34",
 *   privateKey: process.env.ASC_PRIVATE_KEY!,
 * });
 *
 * client.setConfig({ auth });
 * ```
 */
export function createASCAuth(options: ASCAuthOptions): ASCAuth {
  const refreshBuffer = options.refreshBuffer ?? DEFAULT_REFRESH_BUFFER;

  // Cache the CryptoKey after first PEM parse to avoid re-importing on every refresh.
  let cachedKey: CryptoKey | null =
    options.privateKey instanceof CryptoKey ? options.privateKey : null;

  let cached: { token: string; exp: number } | null = null;
  let inflight: Promise<string> | null = null;

  async function getOptionsWithCachedKey(): Promise<ASCAuthOptions> {
    if (!cachedKey) {
      cachedKey = await importPrivateKey(options.privateKey);
    }
    return { ...options, privateKey: cachedKey };
  }

  async function signFresh(): Promise<string> {
    const opts = await getOptionsWithCachedKey();
    const result = await signASCTokenInternal(opts);
    cached = { token: result.token, exp: result.exp };
    return result.token;
  }

  function isCacheValid(): boolean {
    if (!cached) return false;
    // Refresh when current time reaches (exp - refreshBuffer).
    // Strict less-than: at exactly the boundary, we sign a new token.
    return Date.now() / 1000 < cached.exp - refreshBuffer;
  }

  async function getToken(): Promise<string> {
    if (isCacheValid()) {
      return cached!.token;
    }

    // Single-flight: if a signing operation is already in progress,
    // piggyback on it instead of signing a duplicate token.
    if (inflight) {
      return inflight;
    }

    const promise = signFresh().finally(() => {
      if (inflight === promise) inflight = null;
    });
    inflight = promise;

    return inflight;
  }

  // Build the callable auth object
  const auth = getToken as ASCAuth;

  auth.refresh = () => {
    cached = null;
    const promise = signFresh().finally(() => {
      if (inflight === promise) inflight = null;
    });
    inflight = promise;
    return inflight;
  };

  auth.clearCache = () => {
    cached = null;
    inflight = null;
  };

  return auth;
}
