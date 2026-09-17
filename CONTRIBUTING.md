# Contributing to Skilltree

Use Node.js 22.13 or newer. The archive-import tests also require Python 3.9 or newer. Run `npm ci`, then `npm run dev` for the app or `npm run demo` for an isolated fictional library.

## Changes

Keep changes focused and describe the observable behavior they change. Run:

```sh
npm run format:check
npm test
npm run build
npm run check:public
```

MCP and the website share the service layer. A routing decision selects instructions; it does not execute them. Keep provider failures and confidence limits visible.

## Example skills

Each example lives in `examples/skills/<name>/SKILL.md`. Keep its purpose narrow, its instructions self-contained, and its metadata accurate. Use original fictional content with no personal source paths or private records. The examples are MIT licensed.

After editing example sources, run `npm run examples:build`. Tests verify the generated catalog and retrieve every example through the library's file interface.

## Privacy and media

Private catalogs, bundles, activity, `.env`, and local artifacts are ignored. The release check examines tracked files and reachable history for common credential and path patterns; manual review is still required.

For a new preview image, use only fictional examples. Inspect the complete image and metadata, then add its exact SHA-256 to `docs/reviewed-media.json`. A changed image needs another review. Keep its generation prompt or capture provenance alongside it.
