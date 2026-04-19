import { encodeBase64urlString } from "./base64url.js";
import { importPrivateKey, signES256 } from "./crypto.js";
import { ASCAuthError } from "./errors.js";
import type { ASCAuthOptions } from "./types.js";

const DEFAULT_EXPIRATION = 1200; // 20 minutes — Apple's max for standard tokens
const AUDIENCE = "appstoreconnect-v1";

function isIndividualKey(
  options: ASCAuthOptions,
): options is ASCAuthOptions & { keyType: "individual" } {
  return "keyType" in options && options.keyType === "individual";
}

function validateOptions(options: ASCAuthOptions): void {
  if (!options.keyId) {
    throw new ASCAuthError("Missing required option: keyId");
  }
  if (!isIndividualKey(options) && !options.issuerId) {
    throw new ASCAuthError("Missing required option: issuerId");
  }
  if (!options.privateKey) {
    throw new ASCAuthError("Missing required option: privateKey");
  }
  if (options.expiration !== undefined && options.expiration <= 0) {
    throw new ASCAuthError("expiration must be a positive number of seconds");
  }
}

export interface SignResult {
  token: string;
  exp: number;
}

/**
 * Sign a single App Store Connect API JWT.
 *
 * This is the low-level one-shot function. For repeated use with caching,
 * use `createASCAuth()` instead.
 */
export async function signASCToken(options: ASCAuthOptions): Promise<string> {
  const { token } = await signASCTokenInternal(options);
  return token;
}

/** Internal: returns both token and exp for cache management. */
export async function signASCTokenInternal(
  options: ASCAuthOptions,
): Promise<SignResult> {
  validateOptions(options);

  const expiration = options.expiration ?? DEFAULT_EXPIRATION;
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiration;

  // JWT header — kid goes in the HEADER, not the payload
  const header = {
    alg: "ES256" as const,
    kid: options.keyId,
    typ: "JWT" as const,
  };

  // JWT payload — differs between team and individual keys
  const payload: Record<string, unknown> = {
    iat,
    exp,
    aud: AUDIENCE,
  };

  if (isIndividualKey(options)) {
    payload.sub = "user";
  } else {
    payload.iss = options.issuerId;
  }

  if (options.scope && options.scope.length > 0) {
    payload.scope = options.scope;
  }

  // Encode header and payload
  const headerB64 = encodeBase64urlString(JSON.stringify(header));
  const payloadB64 = encodeBase64urlString(JSON.stringify(payload));
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  // Import key (accepts PEM string or CryptoKey)
  const cryptoKey = await importPrivateKey(options.privateKey);

  // Sign
  const signatureB64 = await signES256(cryptoKey, signingInput);

  return {
    token: `${headerB64}.${payloadB64}.${signatureB64}`,
    exp,
  };
}
