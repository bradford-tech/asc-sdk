# Changelog

## [0.0.3](https://github.com/bradford-tech/asc-sdk/compare/asc-auth-v0.0.2...asc-auth-v0.0.3) (2026-04-20)


### Bug Fixes

* **auth:** accept Uint8Array directly in encodeBase64url ([9e579ba](https://github.com/bradford-tech/asc-sdk/commit/9e579ba7720b90986e0c7d58902985b27d0f7d0b))
* **auth:** guard single-flight cleanup against stale callbacks ([b192f2e](https://github.com/bradford-tech/asc-sdk/commit/b192f2ee3e8ee81a3c630b245e370178aab2ab84))
* **auth:** prevent stale sign from overwriting refresh cache ([68a3c2b](https://github.com/bradford-tech/asc-sdk/commit/68a3c2bfbfd6a8714a4380ec5f31f59c4986f33d))

## [0.0.2](https://github.com/bradford-tech/asc-sdk/compare/asc-auth-v0.0.1...asc-auth-v0.0.2) (2026-04-19)

### Features

- **auth:** add caching auth provider with auto-refresh ([ec21f84](https://github.com/bradford-tech/asc-sdk/commit/ec21f84cb4fc4690aea689757aa1f1d5f9e30632))
- **auth:** add JWT assembly and signing ([62e292e](https://github.com/bradford-tech/asc-sdk/commit/62e292e8653b917da8c19d73ce900d291fae2f84))
- **auth:** define public types and error classes ([6ec1d67](https://github.com/bradford-tech/asc-sdk/commit/6ec1d670aa18c0e7688edb794de218b8836f980a))
- **auth:** implement PEM parsing and ES256 signing ([3c222ec](https://github.com/bradford-tech/asc-sdk/commit/3c222ec892132d63362aa43f0cb5d12facddce4f))
