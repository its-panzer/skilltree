# Skilltree

Personal skill library and Jev-guided MCP framework. This file applies inside this repository.

## Privacy boundary

- Framework source and fictional examples are tracked. Personal skill bundles, catalog, source paths, activity, and credentials live in ignored `data/private/` or `.env`.
- Never commit private data or publish without the user's instruction.
- Imports preserve original bytes and supporting files. Keep provenance and version-selection reasons. Do not rewrite original skills.

## Development

- `npm run dev` serves the app, API, and MCP on one origin.
- `npm run build`, `npm test`, and `npm run check:public` verify the implementation.
- MCP uses the same service layer as the website. Routing selects instructions; it does not execute skills.
- Jev returns typed judgments. Validate responses, gate low confidence, and label local fallback honestly.
- Read `.impeccable.md` before changing the interface.
- Use direct, specific interface copy. Do not apply editorial rewrites to imported instructions.
