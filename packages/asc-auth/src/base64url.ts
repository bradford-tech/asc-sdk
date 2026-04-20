/** Encode an ArrayBuffer or Uint8Array as a base64url string (RFC 4648 Section 5). */
export function encodeBase64url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Encode a UTF-8 string as a base64url string. */
export function encodeBase64urlString(str: string): string {
  return encodeBase64url(new TextEncoder().encode(str));
}
