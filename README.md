# TurboC Web Lab

Browser-based **Turbo C/C++ + Borland `graphics.h` / BGI** environment powered by js-dos and WebAssembly.

**Live:** https://kmanisk.github.io/TurboC-WebLab/

## What it does

TurboC Web Lab runs the legacy Turbo C3 development environment directly in a modern browser. It is aimed at computer-graphics coursework and other older programs that depend on Borland's DOS-era `graphics.h` / BGI stack.

The deployed environment has been verified end-to-end with a real BGI program: `SHOWCASE.C` compiles with Turbo C, links against `GRAPHICS.LIB`, loads `EGAVGA.BGI`, and renders graphics in the browser.

## Verified graphics.h support

The runtime contains and validates:

- `TURBOC3/INCLUDE/GRAPHICS.H`
- `TURBOC3/LIB/GRAPHICS.LIB`
- `TURBOC3/BGI/EGAVGA.BGI`
- the Turbo C compiler/linker toolchain

The included `examples/SHOWCASE.C` draws a rectangle, circle, crosshair lines, and BGI text. The same source is included in the runtime as `C:\TURBOC3\PROJECTS\SHOWCASE.C` and opens automatically when Turbo C starts.

A developer-only automatic verification mode is available at:

```text
https://kmanisk.github.io/TurboC-WebLab/?bgi-test=1
```

That mode compiles and runs `SHOWCASE.C` directly through the DOS toolchain, bypassing IDE interaction. It is intended for regression testing rather than normal use.

## Current architecture

```text
Browser
  |
  +-- index.html
  +-- styles.css
  +-- app.js
  |
  +-- fetch same-origin Turboc3.zip (~2.46 MiB)
  +-- fflate async ZIP extraction
  +-- js-dos initFs (~128 files)
  +-- js-dos 8.5.3 / WebAssembly
        |
        +-- Turbo C3 IDE
        +-- graphics.h / GRAPHICS.LIB / BGI drivers
        +-- Projects/SHOWCASE.C
```

The site no longer builds a `.jsdos` bundle in the browser. The old bundle-builder path was unreliable with legacy DOS filenames, so the runtime is unpacked in JavaScript and passed directly to js-dos through `initFs`.

## Runtime optimizations

- js-dos is pinned to **8.5.3** instead of `latest`.
- ZIP extraction uses asynchronous `fflate.unzip()` rather than blocking synchronous extraction.
- Runtime payload is reduced to roughly **2.46 MiB / 128 files**.
- Legacy documentation, class-library samples, compiled sample outputs, and unused demo files are excluded from the browser runtime.
- Runtime downloading begins early when the Start button is hovered or focused.
- WebGL rendering is requested when supported.
- `SharedArrayBuffer` is optional; the app uses js-dos's render-thread fallback when cross-origin isolation is unavailable.

## Clean sessions

The public lab intentionally disables js-dos filesystem restore/persistence. Each page load starts from a known clean Turbo C filesystem.

This prevents Turbo C desktop/session state from previous browser runs from reopening old source files or unrelated tabs. It also makes classroom/demo behavior deterministic.

## Controls

Before launch the UI stays minimal: **Start Turbo C3** and **Diagnostics**.

After the emulator starts, the following controls are available:

- Restart
- Pause / Resume
- Fullscreen
- Stop

## Run locally

Serve the repository over HTTP; do not open `index.html` with `file://`.

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Repository layout

```text
.
├── examples/
│   └── SHOWCASE.C
├── Turboc3.zip        # optimized browser runtime
├── app.js             # runtime loader + js-dos controller
├── index.html
└── styles.css
```

js-dos and fflate are loaded from pinned CDN versions; the Turbo C runtime ZIP is served from the same GitHub Pages origin.

## Scope

This is a compatibility environment for legacy Turbo C/C++ and Borland BGI coursework. It is **not** a modern C++ compiler or modern graphics API.

## Redistribution notice

Turbo C/Turbo C++ is legacy third-party software. Verify that you have the legal right to redistribute any included compiler/runtime binaries. The web wrapper and third-party legacy binaries have separate licensing considerations.
