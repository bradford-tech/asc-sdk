import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./spec/openapi.oas.json",
  output: {
    header: (ctx) => ["/* eslint-disable */", ...ctx.defaultValue],
    path: "./src/client",
    clean: false,
    postProcess: [
      { command: "prettier", args: ["{{path}}", "--write"] },
      { command: "eslint", args: ["{{path}}", "--fix"] },
    ],
  },
  parser: {
    validate_EXPERIMENTAL: true,
    filters: {
      deprecated: false,
      preserveOrder: true,
    },
  },
  plugins: [
    "@hey-api/typescript",
    "@hey-api/client-fetch",
    {
      name: "@hey-api/sdk",
      auth: true,
      operations: {
        strategy: "byTags",
        containerName: "{{name}}",
      },
    },
    {
      name: "@hey-api/transformers",
      bigInt: true,
      dates: true,
    },
  ],
});
