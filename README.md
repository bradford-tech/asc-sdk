# asc-sdk

TypeScript SDK for the Apple App Store Connect API.

## Packages

| Package                                          | Description                                  |
| ------------------------------------------------ | -------------------------------------------- |
| [`@bradford-tech/asc-sdk`](./packages/asc-sdk)   | Auto-generated SDK from Apple's OpenAPI spec |
| [`@bradford-tech/asc-auth`](./packages/asc-auth) | JWT authentication helper (ES256 signing)    |

## Development

### Known Issues

We patched `@hey-api/shared` to fix a bug where `parser.filters.deprecated: false` silently drops non-deprecated operations that transitively reference deprecated schemas via `oneOf` unions. See [`patches/README.md`](patches/README.md) for details and removal criteria.

## License

[MIT](./LICENSE)
