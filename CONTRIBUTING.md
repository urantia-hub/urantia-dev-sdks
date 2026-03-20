# Contributing

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)

## Setup

```bash
npm install
npm run build
```

## Project Structure

This is a monorepo with two packages:

- `packages/api` — Typed fetch client for the Urantia API (`@urantia/api`)
- `packages/auth` — OAuth client for accounts.urantiahub.com (`@urantia/auth`)

## Submitting Changes

1. Fork the repo
2. Create a feature branch (`git checkout -b my-feature`)
3. Make your changes and run `npm run build` to verify the build passes
4. Open a pull request against `main`

## Notes

- No tests yet -- contributions welcome.
