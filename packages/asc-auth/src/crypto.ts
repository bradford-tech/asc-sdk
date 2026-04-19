import { encodeBase64url } from "./base64url.js";
import { ASCAuthError, ASCAuthPEMError } from "./errors.js";

/**
 * Parse a PKCS#8 PEM string into a DER ArrayBuffer.
 *
 * Handles common edge cases from real-world key sources:
 * - CRLF and LF line endings
 * - Literal `\n` strings from environment variables
 * - Missing BEGIN/END markers (raw base64 from env vars)
 * - Extra whitespace, tabs, trailing whitespace
 */
export function parsePEM(pem: string): ArrayBuffer {
  if (!pem || typeof pem !== "string") {
    throw new ASCAuthPEMError(
      "Invalid PEM: expected a non-empty string containing PKCS#8 private key data",
    );
  }

  // Handle literal \n from environment variables
  const normalized = pem.replace(/\\n/g, "\n");

  // Strip PEM headers/footers and all whitespace
  const b64 = normalized
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/[\r\n\s]/g, "");

  if (b64.length === 0) {
    throw new ASCAuthPEMError(
      "Invalid PEM: no base64 content found after stripping headers and whitespace",
    );
  }

  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    throw new ASCAuthPEMError("Invalid PEM content: base64 decoding failed");
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Import a private key for ES256 signing.
 *
 * Accepts either a PEM string (PKCS#8) or a pre-imported CryptoKey.
 * When a PEM string is provided, the CryptoKey is imported once and cached
 * on subsequent calls via the returned CryptoKey.
 */
export async function importPrivateKey(
  key: string | CryptoKey,
): Promise<CryptoKey> {
  if (key instanceof CryptoKey) {
    return key;
  }

  if (typeof globalThis.crypto?.subtle === "undefined") {
    throw new ASCAuthError(
      "crypto.subtle is not available in this environment. " +
        "ASC auth requires a server-side runtime (Node.js 20+, Deno, Bun, or edge runtime).",
    );
  }

  const der = parsePEM(key);

  try {
    return await crypto.subtle.importKey(
      "pkcs8",
      der,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
  } catch (e) {
    if (e instanceof DOMException && e.name === "DataError") {
      throw new ASCAuthPEMError(
        "Invalid private key: could not import PKCS#8 data as ES256 key",
      );
    }
    throw new ASCAuthError(
      `Failed to import private key: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Sign data with ES256 (ECDSA P-256 + SHA-256) and return the base64url-encoded signature.
 *
 * Web Crypto outputs IEEE P1363 format (raw r||s concatenation, 64 bytes for P-256).
 * This is exactly what JWS ES256 requires per RFC 7518 Section 3.4 — no DER conversion needed.
 * Libraries using OpenSSL output DER-encoded signatures which would need conversion, but
 * Web Crypto's native output matches JWS directly.
 */
export async function signES256(
  key: CryptoKey,
  data: BufferSource,
): Promise<string> {
  try {
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      data,
    );
    return encodeBase64url(signature);
  } catch (e) {
    throw new ASCAuthError(
      `Failed to sign JWT: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
