import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./spec/openapi.oas.json",
  output: {
    header: (ctx) => ["/* eslint-disable */", ...ctx.defaultValue],
    path: "./src/client",
    clean: false,
    module: {
      extension: ".js", // explicit extensions for Node.js ESM compatibility
    },
    postProcess: [
      { command: "prettier", args: ["{{path}}", "--write"] },
      { command: "eslint", args: ["{{path}}", "--fix"] },
    ],
  },
  parser: {
    // Validate the input spec before generation — catches spec issues early,
    // especially valuable given the daily auto-update workflow from Apple.
    validate_EXPERIMENTAL: true,
    filters: {
      deprecated: false,
      // Stable output ordering across regenerations. Critical for the daily
      // spec-update workflow — without this, diffs become noisy even when
      // Apple hasn't changed the API surface.
      preserveOrder: true,
    },
  },
  plugins: [
    "@hey-api/typescript",
    {
      name: "@hey-api/transformers",
      bigInt: false, // int64 stays as number — all ASC int64 fields are safely within Number.MAX_SAFE_INTEGER
      dates: true, // convert date-time strings to Date objects
    },
    {
      name: "@hey-api/sdk",
      auth: true,
      transformer: true, // wire transformers into SDK response pipeline
      operations: {
        strategy: "flat",
      },
    },
  ],
});
