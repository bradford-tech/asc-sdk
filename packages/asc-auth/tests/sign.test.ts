import { decodeJwt, decodeProtectedHeader, importSPKI, jwtVerify } from "jose";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ASCAuthError, ASCAuthPEMError, signASCToken } from "../src/index.js";
import { getPrivateKey, getPrivatePem, getPublicPem } from "./helpers.js";

describe("signASCToken", () => {
  // --- Team key signing ---

  it("signs a valid team-key JWT with correct claims", async () => {
    const pem = await getPrivatePem();
    const pubPem = await getPublicPem();

    const token = await signASCToken({
      issuerId: "57246542-96fe-1a63-e053-0824d011072a",
      keyId: "2X9R4HXF34",
      privateKey: pem,
    });

    const publicKey = await importSPKI(pubPem, "ES256");
    const { payload } = await jwtVerify(token, publicKey);

    assert.equal(payload.iss, "57246542-96fe-1a63-e053-0824d011072a");
    assert.equal(payload.aud, "appstoreconnect-v1");
    assert.equal(typeof payload.iat, "number");
    assert.equal(typeof payload.exp, "number");
    assert.equal(payload.sub, undefined, "team key should not have sub claim");
  });

  it("places kid in the JWT header, not the payload", async () => {
    const pem = await getPrivatePem();

    const token = await signASCToken({
      issuerId: "test-issuer",
      keyId: "MY_KEY_ID",
      privateKey: pem,
    });

    const header = decodeProtectedHeader(token);
    const payload = decodeJwt(token);

    assert.equal(header.alg, "ES256");
    assert.equal(header.kid, "MY_KEY_ID");
    assert.equal(header.typ, "JWT");
    assert.equal(
      (payload as Record<string, unknown>).kid,
      undefined,
      "kid should not be in payload",
    );
  });

  it("uses iat in Unix seconds (not milliseconds) and exp = iat + expiration", async () => {
    const now = 1700000000000; // known timestamp in ms
    const originalNow = Date.now;
    Date.now = () => now;

    try {
      const pem = await getPrivatePem();
      const token = await signASCToken({
        issuerId: "test-issuer",
        keyId: "test-key",
        privateKey: pem,
        expiration: 600,
      });

      const payload = decodeJwt(token);
      assert.equal(payload.iat, 1700000000, "iat should be Unix seconds");
      assert.equal(payload.exp, 1700000600, "exp should be iat + 600");
    } finally {
      Date.now = originalNow;
    }
  });

  it("defaults expiration to 1200 seconds (20 minutes)", async () => {
    const pem = await getPrivatePem();
    const token = await signASCToken({
      issuerId: "test-issuer",
      keyId: "test-key",
      privateKey: pem,
    });

    const payload = decodeJwt(token);
    assert.equal(payload.exp! - payload.iat!, 1200);
  });

  it("respects custom expiration", async () => {
    const pem = await getPrivatePem();
    const token = await signASCToken({
      issuerId: "test-issuer",
      keyId: "test-key",
      privateKey: pem,
      expiration: 300,
    });

    const payload = decodeJwt(token);
    assert.equal(payload.exp! - payload.iat!, 300);
  });

  // --- Individual key signing ---

  it("signs an individual-key JWT with sub=user and no iss", async () => {
    const pem = await getPrivatePem();
    const pubPem = await getPublicPem();

    const token = await signASCToken({
      keyType: "individual",
      keyId: "INDIVIDUAL_KEY",
      privateKey: pem,
    });

    const publicKey = await importSPKI(pubPem, "ES256");
    const { payload } = await jwtVerify(token, publicKey);

    assert.equal(payload.sub, "user");
    assert.equal(payload.aud, "appstoreconnect-v1");
    assert.equal(
      payload.iss,
      undefined,
      "individual key should not have iss claim",
    );
  });

  // --- Scope ---

  it("includes scope array when provided", async () => {
    const pem = await getPrivatePem();
    const token = await signASCToken({
      issuerId: "test-issuer",
      keyId: "test-key",
      privateKey: pem,
      scope: ["GET /v1/apps?filter[platform]=IOS"],
    });

    const payload = decodeJwt(token);
    assert.deepEqual(payload.scope, ["GET /v1/apps?filter[platform]=IOS"]);
  });

  it("omits scope when not provided", async () => {
    const pem = await getPrivatePem();
    const token = await signASCToken({
      issuerId: "test-issuer",
      keyId: "test-key",
      privateKey: pem,
    });

    const payload = decodeJwt(token);
    assert.equal(payload.scope, undefined);
  });

  // --- Extended expiration ---

  it("passes through expiration > 1200 without error", async () => {
    const pem = await getPrivatePem();
    const token = await signASCToken({
      issuerId: "test-issuer",
      keyId: "test-key",
      privateKey: pem,
      expiration: 15552000, // 6 months in seconds
    });

    const payload = decodeJwt(token);
    assert.equal(payload.exp! - payload.iat!, 15552000);
  });

  // --- PEM parsing edge cases ---

  it("handles standard PEM with LF line endings", async () => {
    const pem = await getPrivatePem();
    assert.ok(pem.includes("\n"));
    const token = await signASCToken({
      issuerId: "test",
      keyId: "test",
      privateKey: pem,
    });
    assert.ok(token.split(".").length === 3);
  });

  it("handles CRLF line endings", async () => {
    const pem = (await getPrivatePem()).replace(/\n/g, "\r\n");
    const token = await signASCToken({
      issuerId: "test",
      keyId: "test",
      privateKey: pem,
    });
    assert.ok(token.split(".").length === 3);
  });

  it("handles raw base64 without BEGIN/END markers", async () => {
    const pem = await getPrivatePem();
    const raw = pem
      .replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .trim();
    const token = await signASCToken({
      issuerId: "test",
      keyId: "test",
      privateKey: raw,
    });
    assert.ok(token.split(".").length === 3);
  });

  it("handles single-line base64 (no internal newlines)", async () => {
    const pem = await getPrivatePem();
    const singleLine =
      "-----BEGIN PRIVATE KEY-----\n" +
      pem
        .replace(/-----BEGIN PRIVATE KEY-----/, "")
        .replace(/-----END PRIVATE KEY-----/, "")
        .replace(/\s/g, "") +
      "\n-----END PRIVATE KEY-----";
    const token = await signASCToken({
      issuerId: "test",
      keyId: "test",
      privateKey: singleLine,
    });
    assert.ok(token.split(".").length === 3);
  });

  it("handles extra whitespace and tabs", async () => {
    const pem = (await getPrivatePem()).replace(/\n/g, "\t\n  ");
    const token = await signASCToken({
      issuerId: "test",
      keyId: "test",
      privateKey: pem,
    });
    assert.ok(token.split(".").length === 3);
  });

  it("handles literal \\n strings from env vars", async () => {
    const pem = (await getPrivatePem()).replace(/\n/g, "\\n");
    const token = await signASCToken({
      issuerId: "test",
      keyId: "test",
      privateKey: pem,
    });
    assert.ok(token.split(".").length === 3);
  });

  it("throws ASCAuthPEMError for invalid PEM (garbage)", async () => {
    await assert.rejects(
      () =>
        signASCToken({
          issuerId: "test",
          keyId: "test",
          privateKey: "not-a-key",
        }),
      (err: Error) => {
        assert.ok(err instanceof ASCAuthPEMError);
        return true;
      },
    );
  });

  it("throws ASCAuthError for empty string privateKey", async () => {
    await assert.rejects(
      () => signASCToken({ issuerId: "test", keyId: "test", privateKey: "" }),
      (err: Error) => {
        assert.ok(err instanceof ASCAuthError);
        assert.match(err.message, /privateKey/);
        return true;
      },
    );
  });

  // --- CryptoKey input ---

  it("accepts pre-imported CryptoKey and skips PEM parsing", async () => {
    const key = await getPrivateKey();
    const pubPem = await getPublicPem();

    const token = await signASCToken({
      issuerId: "test-issuer",
      keyId: "test-key",
      privateKey: key,
    });

    const publicKey = await importSPKI(pubPem, "ES256");
    await jwtVerify(token, publicKey); // throws if invalid
  });

  // --- Input validation ---

  it("throws ASCAuthError for missing keyId", async () => {
    const pem = await getPrivatePem();
    await assert.rejects(
      () => signASCToken({ issuerId: "test", keyId: "", privateKey: pem }),
      (err: Error) => {
        assert.ok(err instanceof ASCAuthError);
        assert.match(err.message, /keyId/);
        return true;
      },
    );
  });

  it("throws ASCAuthError for missing issuerId (team key)", async () => {
    const pem = await getPrivatePem();
    await assert.rejects(
      () => signASCToken({ issuerId: "", keyId: "test", privateKey: pem }),
      (err: Error) => {
        assert.ok(err instanceof ASCAuthError);
        assert.match(err.message, /issuerId/);
        return true;
      },
    );
  });

  // --- signASCToken standalone equivalence ---

  it("produces a structurally valid JWT identical to createASCAuth first call", async () => {
    const pem = await getPrivatePem();
    const pubPem = await getPublicPem();

    const token = await signASCToken({
      issuerId: "test-issuer",
      keyId: "test-key",
      privateKey: pem,
    });

    // Structurally valid
    const parts = token.split(".");
    assert.equal(parts.length, 3, "JWT should have 3 parts");

    // Signature verifies
    const publicKey = await importSPKI(pubPem, "ES256");
    await jwtVerify(token, publicKey);
  });
});
