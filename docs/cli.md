# imshare-cli + +`imshare-cli` provides command-line access to the same configuration parser, defaults, and validation used by the imshare server. +

## Usage + +`sh

imshare-cli config validate
imshare-cli config show server.port
imshare-cli config list
imshare-cli config path
`+
Use`--config`or`-c` to select a specific file: + +`sh
imshare-cli --config ./config.production.imshare config validate
imshare-cli config show site.name --config ./config.production.imshare
`+
The default path remains`config.imshare`relative to the current working directory.`IMSHARE_CONFIG`selects a different path, and`--config`takes precedence over it. Tilde-prefixed paths such as`~/.config/imshare/config.imshare` are expanded. +

## Commands +

### `config validate` +

Checks the configuration DSL, required values, supported types, constraints, and environment overrides. It does not start the server or connect to the database. A validation failure exits with a non-zero status. +

### `config show <propertyPath>` +

Shows one effective property using a dot-separated path: + +`text
Key: server.port
Value: 5454
Source: file
` +
Values reflect defaults and environment overrides, not only the literal contents of the file. +

### `config list` +

Lists leaf properties and their effective values. The source markers are: +

- No marker: value comes from `config.imshare`.
- `[*] (env: IMSHARE__...)`: value is overridden by an environment variable.
- `[!] (default)`: value is supplied by imshare's built-in defaults. +
  Arrays are shown as a single JSON-style value. +

### `config path` +

Prints the resolved configuration file path. It does not require the file to exist. +

## Environment overrides +

Environment variables beginning with `IMSHARE__` can override configuration properties that already have a value in the file or in imshare defaults. Optional properties without a current value must first be added to `config.imshare`. Separate nested property names with double underscores and use uppercase snake case: + +`sh
IMSHARE__SERVER__PORT=5455
IMSHARE__SITE__NAME="My imshare"
IMSHARE__AUTH__REGISTRATION__PUBLIC=true
` +
Numbers accept the same size and duration units as the configuration DSL. Boolean values must be `true` or `false`. Array values use the configuration DSL array syntax, for example: + +`sh
IMSHARE__SERVER__TRUSTED_PROXIES='["127.0.0.1", "::1"]'
` +
Environment values override file values, which override built-in defaults. The CLI loads `.env` through dotenv just like the server's environment-dependent startup path.
