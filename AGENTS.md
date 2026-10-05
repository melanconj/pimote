# Pimote

## Vision

Pimote is a PWA and Node.js server for remote pi coding-agent sessions, complemented by a native Android voice-first client. This repository develops the shared protocol, server, web client, SDK, mobile app, and deployment tooling as one product.

## Lookup table

- **Codemap**: [codemap.md](codemap.md) — modules, responsibilities, dependencies, and key files
- **Glossary**: [glossary.md](glossary.md) — project terminology
- **Fork maintenance**: [docs/fork-maintenance.md](docs/fork-maintenance.md) — remotes, release-based resynchronization, recovered changes, and deployment
- **Local deployment overrides**: [Makefile.local.example](Makefile.local.example) — machine-local settings and deployment targets

## Maintenance Instructions

If `codemap.md` is missing or feels stale relative to what you find, say so — don't silently work around it.

## Pulling Features

A product manager persona exists in `../product-manager` if the user asks about pulling features or the backlog. spin up a long lived subagent in that cwd and interact with it.
