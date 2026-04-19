/** Encode an ArrayBuffer as a base64url string (RFC 4648 Section 5). */
export function encodeBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Encode a UTF-8 string as a base64url string. */
export function encodeBase64urlString(str: string): string {
  return encodeBase64url(new TextEncoder().encode(str).buffer);
}
