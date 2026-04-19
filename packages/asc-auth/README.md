# @bradford-tech/asc-auth

JWT authentication helper for the Apple App Store Connect API. Zero runtime dependencies — uses the Web Crypto API for ES256 signing.

## Installation

```bash
npm install @bradford-tech/asc-auth
```

## Quick Start

```ts
import { client } from "@bradford-tech/asc-sdk";
import { createASCAuth } from "@bradford-tech/asc-auth";

const auth = createASCAuth({
  issuerId: "57246542-96fe-1a63-e053-0824d011072a",
  keyId: "2X9R4HXF34",
  privateKey: process.env.ASC_PRIVATE_KEY!,
});

client.setConfig({ auth });

// All SDK calls now auto-authenticate with cached, auto-refreshing JWTs.
```

## Team Keys vs. Individual Keys

### Team Keys (default)

Team keys are scoped to the organization and require an Issuer ID:

```ts
const auth = createASCAuth({
  issuerId: "57246542-96fe-1a63-e053-0824d011072a",
  keyId: "2X9R4HXF34",
  privateKey: process.env.ASC_PRIVATE_KEY!,
});
```

### Individual Keys

Individual keys are tied to a specific user's apps and permissions:

```ts
const auth = createASCAuth({
  keyType: "individual",
  keyId: "2X9R4HXF34",
  privateKey: process.env.ASC_PRIVATE_KEY!,
});
```

## Key Input Formats

### PEM String (most common)

Pass the `.p8` file contents directly. Works with environment variables:

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

The PEM parser is forgiving: it handles CRLF/LF line endings, missing `BEGIN`/`END` markers, single-line base64, literal `\n` from environment variables, and extra whitespace.

### CryptoKey (pre-imported)

If you import the key yourself (e.g., from a KMS or Vault):

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

## Token Caching

Tokens are cached and automatically refreshed. By default:

- Token lifetime: 1200 seconds (20 minutes — Apple's maximum for standard tokens)
- Refresh buffer: 30 seconds (sign a new token 30s before expiry)

Customize these:

```ts
const auth = createASCAuth({
  issuerId: "...",
  keyId: "...",
  privateKey: "...",
  expiration: 900, // 15-minute tokens
  refreshBuffer: 60, // refresh 60s before expiry
});
```

The `expiration` parameter is the total token lifetime in seconds (`exp - iat`), which is what Apple checks — not wall-clock "seconds from now until expiry."

### Manual Cache Control

```ts
auth.refresh(); // Force sign a new token, bypassing cache
auth.clearCache(); // Drop the cached token (does NOT invalidate it on Apple's side — JWTs are stateless)
```

## Scoped Tokens

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

Long-lived tokens (up to 6 months) are accepted only for scoped GET requests against these Xcode Cloud/CI resources: build actions, build runs, git references, issues, macOS versions, products, providers, power-and-performance-metrics-and-logs, pull requests, repositories, test results, workflows, and Xcode versions. All other resources reject `exp - iat > 1200`.

## One-Shot Signing

For single-use tokens (e.g., pre-signing in CI):

```ts
import { signASCToken } from "@bradford-tech/asc-auth";

const token = await signASCToken({
  issuerId: "...",
  keyId: "...",
  privateKey: "...",
});
```

## Clock Skew

Token timestamps use the local system clock. If your clock runs ahead of Apple's servers, freshly signed tokens may be rejected. Apple tolerates approximately 60 seconds of skew. On systems with unreliable NTP, set `expiration: 1140` (19 minutes) rather than the full 1200 to leave margin.

## Error Handling

```ts
import { ASCAuthError, ASCAuthPEMError } from "@bradford-tech/asc-auth";

try {
  const token = await auth();
} catch (err) {
  if (err instanceof ASCAuthPEMError) {
    // Key parsing failed — bad PEM format, corrupt key data
    console.error("Key error:", err.message);
  } else if (err instanceof ASCAuthError) {
    // Other auth error — missing options, crypto unavailable, signing failure
    console.error("Auth error:", err.message);
  }
}
```

## Security

**Private keys must never run in browser environments.** This package is designed for server-side runtimes: Node.js 20+, Deno, Bun, Cloudflare Workers, and Vercel Edge. If `crypto.subtle` is not available, it throws immediately with a descriptive error.

## Runtime Support

| Runtime            | Status                                                |
| ------------------ | ----------------------------------------------------- |
| Node.js 20+        | Supported                                             |
| Deno               | Supported                                             |
| Bun                | Supported                                             |
| Cloudflare Workers | Supported                                             |
| Vercel Edge        | Supported                                             |
| Browsers           | Not supported (private keys must not run client-side) |

## License

[MIT](./LICENSE)
