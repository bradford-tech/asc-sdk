# @bradford-tech/asc-sdk

TypeScript SDK for the Apple App Store Connect API, auto-generated from Apple's official OpenAPI spec.

## Usage Notes

### Date Handling

Dates in API responses are automatically converted from ISO 8601 strings to native `Date` objects for endpoints whose schemas contain `date-time` fields (261 of 1055 endpoints). This includes fields like `createdDate`, `expirationDate`, `startDate`, and `earliestReleaseDate`.

**Exceptions**:

- **`included` arrays**: Dates inside JSON:API `included` arrays remain as ISO strings. Apple's `included` uses `oneOf` unions for polymorphic resources, and Hey API's transformer plugin does not process union types.
- **Top-level schemas without dates**: Some endpoints' top-level response schemas have no `date-time` fields themselves — dates live on related sub-resources accessed via separate relationship endpoints. `appsGetCollection`, `appsGetInstance`, and `buildsGetCollection` are examples. For these endpoints, no transformer runs at all. Access dates via the dedicated relationship endpoints (e.g., `appsAppStoreVersionsGetToManyRelated`) or parse `included` items manually.

If you access dates from either case, parse them yourself:

```ts
const createdDate = new Date(includedItem.attributes.createdDate);
```

### int64 Fields

Fields marked as `int64` in Apple's spec (file sizes, disk metrics, upload offsets, part numbers) are returned as `number`, not `BigInt`. All observed ASC `int64` values are safely within `Number.MAX_SAFE_INTEGER` (~9 petabytes for file sizes; ASC apps are <10GB in practice). If you have a use case requiring `BigInt` precision, please [file an issue](https://github.com/bradford-tech/asc-sdk/issues).

## Development

### Known Issues

We patched `@hey-api/shared` to fix a bug where `parser.filters.deprecated: false` silently drops non-deprecated operations that transitively reference deprecated schemas via `oneOf` unions. See [`patches/README.md`](patches/README.md) for details and removal criteria.
