import { decodeJwt, importSPKI, jwtVerify } from "jose";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createASCAuth } from "../src/index.js";
import { getPrivatePem, getPublicPem } from "./helpers.js";

describe("createASCAuth", () => {
  // --- Caching ---

  it("caches token on second call within refresh buffer", async () => {
    const pem = await getPrivatePem();
    const auth = createASCAuth({
      issuerId: "test-issuer",
      keyId: "test-key",
      privateKey: pem,
      expiration: 1200,
      refreshBuffer: 30,
    });

    const token1 = await auth();
    const token2 = await auth();
    assert.equal(token1, token2, "second call should return cached token");
  });

  it("signs new token when cache expires past refresh buffer", async () => {
    const originalNow = Date.now;
    let now = 1700000000000;
    Date.now = () => now;

    try {
      const pem = await getPrivatePem();
      const auth = createASCAuth({
        issuerId: "test-issuer",
        keyId: "test-key",
        privateKey: pem,
        expiration: 60,
        refreshBuffer: 10,
      });

      const token1 = await auth();

      // Advance time past refresh buffer (60 - 10 = 50s from iat)
      now += 51_000;
      const token2 = await auth();

      assert.notEqual(token1, token2, "should sign a new token");
    } finally {
      Date.now = originalNow;
    }
  });

  it("signs new token at exactly the refresh boundary (strict less-than)", async () => {
    const originalNow = Date.now;
    let now = 1700000000000;
    Date.now = () => now;

    try {
      const pem = await getPrivatePem();
      const auth = createASCAuth({
        issuerId: "test-issuer",
        keyId: "test-key",
        privateKey: pem,
        expiration: 60,
        refreshBuffer: 10,
      });

      const token1 = await auth();

      // Advance time to exactly the boundary: iat + (expiration - refreshBuffer) = +50s
      now += 50_000;
      const token2 = await auth();

      assert.notEqual(
        token1,
        token2,
        "at exact boundary, should sign new token",
      );
    } finally {
      Date.now = originalNow;
    }
  });

  it("refresh() bypasses cache", async () => {
    const pem = await getPrivatePem();
    const auth = createASCAuth({
      issuerId: "test-issuer",
      keyId: "test-key",
      privateKey: pem,
    });

    const token1 = await auth();
    const token2 = await auth.refresh();
    assert.notEqual(token1, token2, "refresh should produce a new token");
  });

  it("clearCache() drops cached token", async () => {
    const originalNow = Date.now;
    const now = 1700000000000;
    Date.now = () => now;

    try {
      const pem = await getPrivatePem();
      const auth = createASCAuth({
        issuerId: "test-issuer",
        keyId: "test-key",
        privateKey: pem,
      });

      const token1 = await auth();
      auth.clearCache();
      const token2 = await auth();

      // Same timestamp so claims will be identical, but it's a fresh signing operation
      // Signature will differ because ECDSA is non-deterministic
      assert.notEqual(token1, token2, "should sign new token after clearCache");
    } finally {
      Date.now = originalNow;
    }
  });

  // --- refreshBuffer >= expiration edge case ---

  it("always signs fresh when refreshBuffer >= expiration", async () => {
    const pem = await getPrivatePem();
    const auth = createASCAuth({
      issuerId: "test-issuer",
      keyId: "test-key",
      privateKey: pem,
      expiration: 30,
      refreshBuffer: 30, // equal to expiration — cache is always stale
    });

    const token1 = await auth();
    const token2 = await auth();
    // ECDSA signatures are non-deterministic, so tokens differ even with same claims
    assert.notEqual(token1, token2, "should sign fresh every time");
  });

  // --- Single-flight ---

  it("10 concurrent calls produce exactly 1 signing operation", async () => {
    const pem = await getPrivatePem();

    // The single-flight test works by observing that all 10 calls return the same token.
    // ECDSA signatures are non-deterministic, so if multiple signing operations ran,
    // we'd see multiple distinct tokens.
    const auth = createASCAuth({
      issuerId: "test-issuer",
      keyId: "test-key",
      privateKey: pem,
      expiration: 1200,
      refreshBuffer: 30,
    });

    // Fire 10 concurrent calls
    const results = await Promise.all(Array.from({ length: 10 }, () => auth()));

    // All should return the same token (the one from the single signing operation)
    const uniqueTokens = new Set(results);
    assert.equal(
      uniqueTokens.size,
      1,
      "all 10 concurrent calls should return the same token",
    );
  });

  it("refresh() while inflight doesn't clobber the new promise", async () => {
    const pem = await getPrivatePem();
    const auth = createASCAuth({
      issuerId: "test-issuer",
      keyId: "test-key",
      privateKey: pem,
      expiration: 1200,
      refreshBuffer: 30,
    });

    // Start a signing operation but don't await yet
    const firstCall = auth();
    // Immediately refresh (starts a second signing operation)
    const refreshCall = auth.refresh();

    const [token1, token2] = await Promise.all([firstCall, refreshCall]);
    // Both should resolve successfully (refresh shouldn't be clobbered)
    assert.ok(token1);
    assert.ok(token2);
    // A third call should return the refresh'd cached token, not re-sign
    const token3 = await auth();
    assert.equal(token3, token2, "should use the refresh'd cached token");
  });

  it("single-flight clears on error, next call retries", async () => {
    const auth = createASCAuth({
      issuerId: "test-issuer",
      keyId: "test-key",
      privateKey: "garbage-key-that-will-fail",
    });

    // First call fails (bad key)
    await assert.rejects(() => auth());

    // If inflight wasn't cleared on error, this would hang forever.
    // Instead it should fail again cleanly (same bad key).
    await assert.rejects(() => auth());
  });

  // --- Clock ---

  it("iat and exp are correct Unix seconds with frozen clock", async () => {
    const originalNow = Date.now;
    const frozenMs = 1700000000000;
    Date.now = () => frozenMs;

    try {
      const pem = await getPrivatePem();
      const auth = createASCAuth({
        issuerId: "test-issuer",
        keyId: "test-key",
        privateKey: pem,
        expiration: 900,
      });

      const token = await auth();
      const payload = decodeJwt(token);

      assert.equal(
        payload.iat,
        1700000000,
        "iat should be frozen time in Unix seconds",
      );
      assert.equal(payload.exp, 1700000900, "exp should be iat + 900");
    } finally {
      Date.now = originalNow;
    }
  });

  // --- Integration: token is valid ---

  it("produces a jose-verifiable JWT via the auth callable", async () => {
    const pem = await getPrivatePem();
    const pubPem = await getPublicPem();

    const auth = createASCAuth({
      issuerId: "test-issuer",
      keyId: "test-key",
      privateKey: pem,
    });

    const token = await auth();
    const publicKey = await importSPKI(pubPem, "ES256");
    const { payload } = await jwtVerify(token, publicKey);

    assert.equal(payload.iss, "test-issuer");
    assert.equal(payload.aud, "appstoreconnect-v1");
  });
});
