# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pure vanilla HTML/CSS/JS image resizer — no framework, no build step, no package.json. Open `index.html` directly or serve via any static file server. Deployed to GitHub Pages at `leeyunhome.github.io/Smart-Image-Resizer/`.

**Development**: open `index.html` in a browser, or run `npx serve .` for a local HTTP server (required for HEIC WASM to work — `file://` blocks cross-origin WASM loading).

## Architecture

Three files only: `index.html` (structure + CDN scripts), `style.css` (glassmorphism dark theme), `app.js` (all logic).

### State & Data Flow (`app.js`)

A single `state` object holds `images[]` (item list) and `settings` (ratio, mode, pad color, resolution). Each image item:
```js
{ id, file, previewUrl, status, progress, result, errorMsg, customName, aiLoading }
```
`status` progression: `'converting'` → `'pending'` → `'processing'` → `'done'` / `'error'`

HEIC files enter as `'converting'`; conversion replaces `item.file` with a JPEG `File` object before entering the normal pipeline.

### HEIC Conversion (3-strategy fallback)

`convertHeicToJpeg(file)` tries in order:
1. **`convertViaCanvas`** — native `<img>` tag (works on macOS, Windows with HEIC codec installed)
2. **`convertViaLibheif`** — `libheif-js@1.19.8` WASM via CDN; supports HDR `tmap`/`heix` brands (iPhone 12+). `window.libheif` is set by the script tag as a factory function — call `libheif()` to get the initialized module (Promise).
3. **`heic2any`** — legacy fallback for older HEIC; uses libheif 1.3.2 (fails on HDR files)

> **Why `IMAGE_EXT` regex matters**: Windows drag-and-drop reports HEIC MIME type as `''` (empty), so `f.type.startsWith('image/')` would reject them. `IMAGE_EXT` checks the filename extension as a fallback.

### Canvas Processing (`processOne`)

For each image, draws onto a canvas at the target aspect ratio using either:
- **Padding**: scale-to-fit + fill remaining area with `padColor`
- **Crop**: scale-to-fill + center crop (overflow clipped by canvas)

`calcCanvasSize` preserves original pixel area while changing aspect ratio (not a fixed output size unless "직접 지정" mode is active).

### AI Filename (`callGeminiVision`)

Sends a 768px-max JPEG thumbnail to Gemini Vision API. The model and API key are stored in `localStorage` (`gemini_api_key`, `gemini_model`). Model list is fetched live from the Gemini Models API — supports any future models automatically.

The response is sanitized with `.replace(/[^a-z0-9-]/g, '-')`, so the prompt **must** be in English to avoid Korean characters being stripped to empty string. Prompt uses system-role style instructions with explicit rules and 3 examples for consistent kebab-case output.

## CDN Dependencies (loaded in `index.html`)

| Library | Purpose |
|---------|---------|
| `jszip@3.10.1` | ZIP download of all processed images |
| `heic2any@0.0.4` | HEIC fallback decoder (old libheif, non-HDR only) |
| `libheif-js@1.19.8/libheif-wasm/libheif-bundle.js` | HDR HEIC decoder; creates `window.libheif` factory |

## Key Non-Obvious Behaviors

- `libheif-wasm/libheif-bundle.js` (NOT `libheif-bundle.js` in root — that file doesn't exist in v1.19.8) embeds WASM inline; the root-level `wasm-bundle.js` is just `module.exports = require('./libheif-wasm/libheif-bundle.js')()` (CJS only, no browser global).
- `analyzeImageName` uses `img.file` which is the **converted JPEG** after HEIC processing, not the original HEIC binary.
- `calcCanvasSize` uses `Math.sqrt(area * aspect)` to preserve pixel count — output dimensions will differ from input but maintain total pixels.
- `downloadSingle`/`downloadAll` use `img.customName` (AI-generated) if set, otherwise `originalName_resized.ext`.
