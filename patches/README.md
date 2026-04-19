# Patches

Applied via [patch-package](https://github.com/ds300/patch-package). These patches are automatically applied on `npm install` via the `postinstall` script.

## `@hey-api/shared` v0.4.0

**File:** `@hey-api+shared+0.4.0.patch`

**What:** Fixes `collectOperations` in the parser filter logic to re-add implicitly-filtered schemas (e.g. deprecated schemas) to the output set instead of silently dropping the entire operation.

**Why:** When `parser.filters.deprecated: false` is set, the parser walks the full schema graph. If a non-deprecated operation's response schema contains a `oneOf` union with a deprecated member (common in JSON:API `included` fields), the deprecated schema is removed from the schemas set. `collectOperations` then sees the missing schema dependency and excludes the entire non-deprecated operation. This causes 48 non-deprecated operations to silently disappear from the generated SDK when used with Apple's App Store Connect OpenAPI spec.

**Root cause:** The three sibling functions (`collectParameters`, `collectRequestBodies`, `collectResponses`) all re-add implicitly-filtered schemas via `schemas.add(dependency)`. Only `collectOperations` treats a missing schema as fatal (`return !schemas.has(dependency)`). The patch aligns `collectOperations` with the established pattern.

**Upstream:**

- Issue: https://github.com/hey-api/openapi-ts/issues/3790
- PR: https://github.com/hey-api/openapi-ts/pull/3791

**Removal criteria:** Delete this patch and remove the `overrides` entry in `package.json` once `@hey-api/shared` ships a version containing the upstream fix. Verify by checking that `npm run generate` produces all expected operations with `deprecated: false` enabled.
