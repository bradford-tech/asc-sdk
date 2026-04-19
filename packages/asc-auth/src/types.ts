/** Configuration for team key auth (the common case). */
export interface ASCTeamKeyOptions {
  /** Issuer ID from App Store Connect > Keys. UUID format. */
  issuerId: string;
  /** API key ID (e.g., "2X9R4HXF34"). */
  keyId: string;
  /** The private key. Accepts PEM string or CryptoKey. */
  privateKey: string | CryptoKey;
  /**
   * Token lifetime in seconds. This is `exp - iat` — the total duration
   * Apple allows for the token, not wall-clock time until expiry.
   *
   * @default 1200 (20 minutes — Apple's maximum for standard tokens)
   */
  expiration?: number;
  /**
   * Refresh buffer in seconds — sign a new token this many seconds
   * before the current one expires.
   *
   * @default 30
   */
  refreshBuffer?: number;
  /** Optional token scope. Array of "GET /path?query" strings. */
  scope?: string[];
}

/** Configuration for individual key auth. */
export interface ASCIndividualKeyOptions {
  /** Must be set to "individual" to use this key type. */
  keyType: "individual";
  /** API key ID. */
  keyId: string;
  /** The private key. PEM string or CryptoKey. */
  privateKey: string | CryptoKey;
  /**
   * Token lifetime in seconds.
   *
   * @default 1200
   */
  expiration?: number;
  /** @default 30 */
  refreshBuffer?: number;
  /** Optional token scope. */
  scope?: string[];
}

export type ASCAuthOptions = ASCTeamKeyOptions | ASCIndividualKeyOptions;

/** The returned auth provider — a callable + utility methods. */
export interface ASCAuth {
  /** Returns a cached or freshly-signed JWT. Compatible with Hey API's `auth` callback. */
  (): Promise<string>;
  /** Force-generate a new token, bypassing the cache. */
  refresh(): Promise<string>;
  /** Clear the cached token. Does NOT invalidate the token on Apple's side (JWTs are stateless). */
  clearCache(): void;
}
