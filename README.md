# @bradford-tech/asc-sdk

TypeScript SDK for the Apple App Store Connect API.

## Development

### Known Issues

We patched `@hey-api/shared` to fix a bug where `parser.filters.deprecated: false` silently drops non-deprecated operations that transitively reference deprecated schemas via `oneOf` unions. See [`patches/README.md`](patches/README.md) for details and removal criteria.
