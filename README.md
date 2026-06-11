# Kompakkt Server

<p align="center">
    <img src="https://github.com/Kompakkt/Assets/raw/main/server-logo.png" alt="Kompakkt Logo" width="600">
</p>

## Requirements

- **[Bun](https://bun.sh/)** - runtime and package manager. `npm` / `yarn` / `pnpm` are **not** supported.
- **[MongoDB](https://www.mongodb.com/)** - primary data store.
- **[Redis](https://redis.io/)** (or a compatible drop-in such as [Dragonfly](https://www.dragonflydb.io/)) - cache layer.
- **[Sonic](https://github.com/valeriansaliou/sonic)** - full-text search backend.
- **[Kompressor](https://github.com/Kompakkt/Kompressor)** - mesh processing backend (3d meshes, gaussian splatting, point clouds, ...).

The Kompakkt configuration for Sonic is available at [`sonic-config.cfg`](https://github.com/Kompakkt/Mono/blob/main/sonic-config.cfg) in the Kompakkt/Mono repository.

## Development setup

Clone the repository, then install the dependencies with Bun:

```bash
git clone https://github.com/Kompakkt/Server
cd Server
bun install
```

Shared code from upstream Kompakkt packages (`@kompakkt/common`) is pulled in automatically as a git-pinned npm dependency.

### Starting the supporting services

Make sure MongoDB, Redis/Dragonfly, Sonic and Kompressor are running locally (see the `CONFIGURATION_*` environment variables in `src/configuration.ts` for the hostnames, ports and credentials the server expects by default). Also see "Running the full stack" below.

### Starting the server

For local development with hot reload:

```bash
bun run dev
```

The server listens on port **3030** by default.

## Running the full stack

This repository only contains the Server. To run Server, Repo and Viewer together (with all required supporting services such as Redis, Sonic, MongoDB and Kompressor), use the [Kompakkt/Mono](https://github.com/Kompakkt/Mono) development environment.
