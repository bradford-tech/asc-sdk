// Type-check smoke test: verify types resolve correctly for consumers.
// Run with: npx tsc --noEmit

import type { App, AppsGetCollectionData } from "@bradford-tech/asc-sdk";
import { appsGetCollection, client } from "@bradford-tech/asc-sdk";

// Verify client config accepts auth callback
client.setConfig({
  auth: () => "test-token",
});

// Verify SDK function is callable with correct types
const _call: Promise<unknown> = appsGetCollection();

// Verify data types are accessible
type _AppType = App;
type _RequestData = AppsGetCollectionData;
