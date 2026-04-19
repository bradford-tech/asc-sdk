// Smoke test: verify the published package shape works at runtime.
// Run after: npm pack --workspace @bradford-tech/asc-sdk
//            npm install ../packages/asc-sdk/bradford-tech-asc-sdk-*.tgz

import assert from "node:assert/strict";

const sdk = await import("@bradford-tech/asc-sdk");

// Verify key exports exist
assert.equal(
  typeof sdk.appsGetCollection,
  "function",
  "appsGetCollection should be a function",
);
assert.equal(
  typeof sdk.buildsGetCollection,
  "function",
  "buildsGetCollection should be a function",
);
assert.equal(typeof sdk.client, "object", "client should be an object");
assert.equal(
  typeof sdk.client.setConfig,
  "function",
  "client.setConfig should be a function",
);
assert.equal(
  typeof sdk.client.get,
  "function",
  "client.get should be a function",
);

console.log(
  "Smoke test passed: all exports present and correctly typed at runtime.",
);
