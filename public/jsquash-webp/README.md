# jsquash-webp — self-hosted libwebp encoder

WebP encoder used by `app/apps/webp` (`lib/video-to-webp.ts`) on browsers whose
canvas can't produce WebP — Safari, today.

## Files

Copied verbatim from `node_modules/@jsquash/webp@1.5.0/codec/enc/`. The package is
a **devDependency pinned to `1.5.0`** — nothing imports it at runtime, it only
supplies these files:

| File | Purpose |
|---|---|
| `webp_enc.js` / `webp_enc.wasm` | Emscripten glue + wasm, baseline build |
| `webp_enc_simd.js` / `webp_enc_simd.wasm` | Same, SIMD build (used when `WebAssembly.validate` accepts a SIMD probe) |

Refresh after bumping the pin:

```sh
cp node_modules/@jsquash/webp/codec/enc/webp_enc*.{js,wasm} public/jsquash-webp/
```

## Why self-hosted

Same trap as `public/ffmpeg/`: letting the bundler see the module load breaks it.
`await import("@jsquash/webp")` makes Turbopack chunk the Emscripten glue, and in
dev the glue's `import.meta.url` resolves to a `file://` path — the wasm 404s
(`ERR_FILE_NOT_FOUND`) and the glue gets evaluated twice
(`Identifier 'Module' has already been declared`). Worse, the failure surfaces as
an uncaught error rather than a rejected `import()`, so the caller hangs forever.

Serving the glue from `public/` and importing it through a **variable** URL
(`` `${window.location.origin}/jsquash-webp/webp_enc_simd.js` ``) keeps the
bundler out of it: the browser loads it natively, `import.meta.url` becomes
`http://…/jsquash-webp/webp_enc_simd.js`, and the glue resolves its own `.wasm`
from this directory (no `locateFile` needed).

No CDN: this app processes everything locally and must not fetch from third
parties.

## Licenses

- `LICENSE` — Apache-2.0, @jsquash/webp (Jamie Sinclair / Google Inc., repackaged from Squoosh)
- `LICENSE.codec.md` — BSD-3-Clause, libwebp (Google Inc.)
