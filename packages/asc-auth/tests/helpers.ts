/**
 * Test helpers: key pair generation and PEM export.
 *
 * Generates a fresh ES256 (P-256) key pair for each test run,
 * exports as PEM strings for use with both our signing code and jose verification.
 */

let _keyPair: CryptoKeyPair | null = null;
let _privatePem: string | null = null;
let _publicPem: string | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function toPem(der: ArrayBuffer, label: string): string {
  const b64 = arrayBufferToBase64(der);
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

async function ensureKeyPair(): Promise<void> {
  if (_keyPair) return;

  _keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true, // extractable — needed for PEM export
    ["sign", "verify"],
  );

  const privDer = await crypto.subtle.exportKey("pkcs8", _keyPair.privateKey);
  _privatePem = toPem(privDer, "PRIVATE KEY");

  const pubDer = await crypto.subtle.exportKey("spki", _keyPair.publicKey);
  _publicPem = toPem(pubDer, "PUBLIC KEY");
}

export async function getPrivatePem(): Promise<string> {
  await ensureKeyPair();
  return _privatePem!;
}

export async function getPublicPem(): Promise<string> {
  await ensureKeyPair();
  return _publicPem!;
}

export async function getPrivateKey(): Promise<CryptoKey> {
  await ensureKeyPair();
  return _keyPair!.privateKey;
}
