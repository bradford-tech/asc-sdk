# @bradford-tech/asc-auth

Zero-dependency JWT authentication for Apple's App Store Connect API, built on Web Crypto (`crypto.subtle`) for ES256 signing.

## Install

```bash
npm install @bradford-tech/asc-auth
```

Also available on [jsr](https://jsr.io/@bradford-tech/asc-auth):

```bash
npx jsr add @bradford-tech/asc-auth
```

## Usage

```ts
import { createASCAuth } from "@bradford-tech/asc-auth";

const auth = createASCAuth({
  issuerId: "57246542-96fe-1a63-e053-0824d011072a",
  keyId: "2X9R4HXF34",
  privateKey: process.env.ASC_PRIVATE_KEY!,
});

const token = await auth();
console.log(token.split(".").length);
// => 3
```

`createASCAuth` returns a callable that produces cached, auto-refreshing JWTs.

### With `@bradford-tech/asc-sdk`

The returned `auth` function is directly compatible with Hey API's `auth` callback:

```ts
import { client } from "@bradford-tech/asc-sdk";

client.setConfig({ auth });
```

## Team keys vs. individual keys

### Team keys (default)

Team keys are scoped to the organization and require an Issuer ID:

```ts
const auth = createASCAuth({
  issuerId: "57246542-96fe-1a63-e053-0824d011072a",
  keyId: "2X9R4HXF34",
  privateKey: process.env.ASC_PRIVATE_KEY!,
});
```

### Individual keys

Individual keys are tied to a specific user's apps and permissions:

```ts
const auth = createASCAuth({
  keyType: "individual",
  keyId: "2X9R4HXF34",
  privateKey: process.env.ASC_PRIVATE_KEY!,
});
```

## Key input formats

### PEM string (most common)

Pass the `.p8` file contents directly. The PEM parser handles CRLF/LF line endings, missing `BEGIN`/`END` markers, single-line base64, literal `\n` from environment variables, and extra whitespace.

```ts
// From environment variable
const auth = createASCAuth({
  issuerId: "...",
  keyId: "...",
  privateKey: process.env.ASC_PRIVATE_KEY!,
});

// From file (Node.js only)
import { readFileSync } from "node:fs";
const auth = createASCAuth({
  issuerId: "...",
  keyId: "...",
  privateKey: readFileSync("./AuthKey_2X9R4HXF34.p8", "utf8"),
});
```

### CryptoKey (pre-imported)

For KMS or Vault flows where the private key should never exist as a string in process memory:

```ts
const key = await crypto.subtle.importKey(
  "pkcs8",
  derBuffer,
  { name: "ECDSA", namedCurve: "P-256" },
  false,
  ["sign"],
);

const auth = createASCAuth({
  issuerId: "...",
  keyId: "...",
  privateKey: key,
});
```

## Token caching

Tokens are cached and automatically refreshed before expiry. Defaults:

- Token lifetime: 1200 seconds (20 minutes, Apple's maximum for standard tokens)
- Refresh buffer: 30 seconds (sign a new token 30s before expiry)

Concurrent callers share a single in-flight signing operation rather than triggering duplicate signs.

```ts
const auth = createASCAuth({
  issuerId: "...",
  keyId: "...",
  privateKey: "...",
  expiration: 900, // 15-minute tokens
  refreshBuffer: 60, // refresh 60s before expiry
});
```

The `expiration` parameter is the total token lifetime (`exp - iat`), which is what Apple checks -- not wall-clock "seconds from now until expiry."

### Manual cache control

```ts
auth.refresh(); // Force sign a new token, bypassing cache
auth.clearCache(); // Drop the cached token (does NOT invalidate it on Apple's side -- JWTs are stateless)
```

## Scoped tokens

Restrict a token to specific operations:

```ts
const auth = createASCAuth({
  issuerId: "...",
  keyId: "...",
  privateKey: "...",
  scope: ["GET /v1/apps?filter[platform]=IOS"],
});
```

Scoped tokens are GET-only by Apple's design. Apple ignores `limit`, `cursor`, and `sort` query params when matching scope entries.

Long-lived tokens (up to 6 months) are accepted only for scoped GET requests against Xcode Cloud/CI resources: build actions, build runs, git references, issues, macOS versions, products, providers, power-and-performance-metrics-and-logs, pull requests, repositories, test results, workflows, and Xcode versions. All other resources reject `exp - iat > 1200`.

## One-shot signing

For single-use tokens (e.g., pre-signing in CI):

```ts
import { signASCToken } from "@bradford-tech/asc-auth";

const token = await signASCToken({
  issuerId: "...",
  keyId: "...",
  privateKey: process.env.ASC_PRIVATE_KEY!,
});
```

`signASCToken` is the low-level function. It signs once, returns the token string, and does no caching.

## Error handling

Two error classes distinguish key-material problems from other auth failures:

```ts
import { ASCAuthError, ASCAuthPEMError } from "@bradford-tech/asc-auth";

try {
  const token = await auth();
} catch (err) {
  if (err instanceof ASCAuthPEMError) {
    // Key parsing failed -- bad PEM format, corrupt key data
    console.error("Key error:", err.message);
  } else if (err instanceof ASCAuthError) {
    // Other auth error -- missing options, crypto unavailable, signing failure
    console.error("Auth error:", err.message);
  }
}
```

`ASCAuthPEMError` extends `ASCAuthError`, so catching `ASCAuthError` covers both.

## Clock skew

Token timestamps use the local system clock. Apple tolerates approximately 60 seconds of skew. On systems with unreliable NTP, set `expiration: 1140` (19 minutes) rather than the full 1200 to leave margin.

## Runtime support

| Runtime            | Status                                                |
| ------------------ | ----------------------------------------------------- |
| Node.js 20+        | Supported                                             |
| Deno               | Supported                                             |
| Bun                | Supported                                             |
| Cloudflare Workers | Supported                                             |
| Vercel Edge        | Supported                                             |
| Browsers           | Not supported (private keys must not run client-side) |

If `crypto.subtle` is not available, the library throws an `ASCAuthError` immediately with a descriptive message.

## When to pick something else

If you already depend on `jose` for other JWT work, [`appstore-connect-sdk`](https://www.npmjs.com/package/appstore-connect-sdk) is a reasonable choice with more download history. This package is for cases where at least one of these matters: zero runtime dependencies, concurrent request deduplication, KMS-resident keys, scoped or long-lived tokens, or forgiving PEM parsing from environment variables.

## Contributing

Bug reports and pull requests are welcome on [GitHub](https://github.com/bradford-tech/asc-sdk).

## License

[MIT](https://github.com/bradford-tech/asc-sdk/blob/main/LICENSE)
