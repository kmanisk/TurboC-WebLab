(() => {
  "use strict";

  const SOURCE_ARCHIVE_URL = "Turboc3.zip";
  const SAVE_KEY = "turbo-c3-web-lab-v2";
  const EMULATORS_PATH_PREFIX = "https://v8.js-dos.com/latest/emulators/";
  const DOSBOX_CONF = `[sdl]
fullscreen=false
autolock=true

[dosbox]
memsize=32

[autoexec]
@echo off
mount c .
c:
cd TURBOC3
cd BIN
TC.EXE
`;

  const $ = (id) => document.getElementById(id);
  const ui = {
    container: $("dos-container"),
    startBtn: $("startBtn"),
    runtimeControls: $("runtimeControls"),
    restartBtn: $("restartBtn"),
    pauseBtn: $("pauseBtn"),
    saveBtn: $("saveBtn"),
    fullscreenBtn: $("fullscreenBtn"),
    stopBtn: $("stopBtn"),
    diagnosticsBtn: $("diagnosticsBtn"),
    diagnosticsPanel: $("diagnosticsPanel"),
    runDiagnosticsBtn: $("runDiagnosticsBtn"),
    checks: $("checks"),
    clearLogBtn: $("clearLogBtn"),
    log: $("log"),
  };

  let player = null;
  let commandInterface = null;
  let paused = false;
  let booting = false;
  let running = false;
  let initFsPromise = null;

  function timestamp() {
    return new Date().toISOString().replace("T", " ").replace("Z", " UTC");
  }

  function log(message, data) {
    const suffix = data === undefined
      ? ""
      : ` ${typeof data === "string" ? data : JSON.stringify(data)}`;
    ui.log.textContent += `[${timestamp()}] ${message}${suffix}\n`;
    ui.log.scrollTop = ui.log.scrollHeight;
    console.log(`[Turbo C3] ${message}`, data ?? "");
  }

  function setControls(isRunning) {
    ui.startBtn.hidden = isRunning;
    ui.startBtn.disabled = booting;
    ui.startBtn.textContent = booting ? "Starting…" : "Start Turbo C3";

    ui.runtimeControls.hidden = !isRunning;
    const disabled = !isRunning || booting;
    ui.restartBtn.disabled = disabled;
    ui.pauseBtn.disabled = disabled;
    ui.saveBtn.disabled = disabled;
    ui.fullscreenBtn.disabled = disabled;
    ui.stopBtn.disabled = disabled;
  }

  function showEmptyState() {
    if (document.getElementById("emptyState")) return;

    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.id = "emptyState";
    empty.innerHTML = `
      <div class="terminal-mark" aria-hidden="true">C:\\&gt;_</div>
      <span class="empty-label">Turbo C3</span>`;
    ui.container.appendChild(empty);
  }

  function renderChecks(checks) {
    ui.checks.replaceChildren();
    for (const check of checks) {
      const card = document.createElement("div");
      card.className = "check";
      card.dataset.result = check.result;

      const title = document.createElement("strong");
      title.textContent = check.name;

      const detail = document.createElement("span");
      detail.textContent = check.detail;

      card.append(title, detail);
      ui.checks.appendChild(card);
    }
  }

  async function probeArchive() {
    const response = await fetch(SOURCE_ARCHIVE_URL, {
      method: "HEAD",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`${SOURCE_ARCHIVE_URL} returned HTTP ${response.status}`);
    }

    const bytes = Number(response.headers.get("content-length"));
    return Number.isFinite(bytes) && bytes > 0
      ? `${(bytes / 1024 / 1024).toFixed(2)} MiB`
      : "reachable";
  }

  async function prepareInitFs() {
    if (initFsPromise) return initFsPromise;

    initFsPromise = (async () => {
      if (typeof window.fflate?.unzipSync !== "function") {
        throw new Error("ZIP loader failed to load.");
      }

      log("Downloading Turbo C3 archive...");
      const response = await fetch(SOURCE_ARCHIVE_URL, { cache: "force-cache" });
      if (!response.ok) {
        throw new Error(`${SOURCE_ARCHIVE_URL} returned HTTP ${response.status}`);
      }

      const compressed = new Uint8Array(await response.arrayBuffer());
      log("Turbo C3 archive downloaded", `${(compressed.byteLength / 1024 / 1024).toFixed(2)} MiB`);

      const files = window.fflate.unzipSync(compressed);
      if (!files["TURBOC3/BIN/TC.EXE"]) {
        throw new Error("TURBOC3/BIN/TC.EXE is missing from the archive.");
      }

      const initFs = Object.entries(files)
        .filter(([path]) => !path.endsWith("/"))
        .map(([path, contents]) => ({ path, contents }));

      if (!initFs.length) {
        throw new Error("Turbo C3 archive extracted with no files.");
      }

      log("Turbo C3 filesystem prepared", `${initFs.length} files`);
      return initFs;
    })();

    try {
      return await initFsPromise;
    } catch (error) {
      initFsPromise = null;
      throw error;
    }
  }

  async function runDiagnostics() {
    ui.runDiagnosticsBtn.disabled = true;
    log("Running environment checks...");

    const checks = [];
    const add = (name, result, detail) => checks.push({ name, result, detail });

    add(
      "Protocol",
      location.protocol === "file:" ? "fail" : "pass",
      location.protocol === "file:"
        ? "Use an HTTP server; file:// cannot run js-dos correctly."
        : `${location.protocol}//`
    );

    add(
      "WebAssembly",
      typeof WebAssembly === "object" ? "pass" : "fail",
      typeof WebAssembly === "object" ? "Available" : "Required but unavailable"
    );

    add(
      "js-dos",
      typeof window.Dos === "function" ? "pass" : "fail",
      typeof window.Dos === "function" ? "Player API loaded" : "js-dos.js did not load"
    );

    add(
      "ZIP loader",
      typeof window.fflate?.unzipSync === "function" ? "pass" : "fail",
      typeof window.fflate?.unzipSync === "function" ? "Ready" : "fflate did not load"
    );

    add(
      "IndexedDB",
      "indexedDB" in window ? "pass" : "warn",
      "indexedDB" in window ? "Available for local persistence" : "Local persistence may be unavailable"
    );

    add(
      "SharedArrayBuffer",
      typeof SharedArrayBuffer === "function" ? "pass" : "warn",
      typeof SharedArrayBuffer === "function"
        ? "Available"
        : "Unavailable; not required for the direct filesystem loader"
    );

    try {
      const archiveInfo = await probeArchive();
      add("Turbo C3 archive", "pass", `${SOURCE_ARCHIVE_URL} • ${archiveInfo}`);
    } catch (error) {
      add("Turbo C3 archive", "fail", error.message);
    }

    renderChecks(checks);
    const failed = checks.filter((check) => check.result === "fail");

    if (failed.length) {
      log("Diagnostics completed with failures", failed.map((item) => item.name));
    } else {
      log("Diagnostics complete");
    }

    ui.runDiagnosticsBtn.disabled = false;
    return failed.length === 0;
  }

  async function stopPlayer({ quiet = false } = {}) {
    const current = player;
    player = null;
    commandInterface = null;
    paused = false;
    running = false;
    booting = false;

    if (current) {
      try {
        await current.stop();
        if (!quiet) log("Emulator stopped");
      } catch (error) {
        log("Stop warning", error?.message || String(error));
      }
    }

    ui.container.replaceChildren();
    showEmptyState();
    ui.pauseBtn.textContent = "Pause";
    setControls(false);
  }

  async function boot() {
    if (booting || player) return;

    booting = true;
    running = false;
    setControls(false);
    log("Starting Turbo C3");

    try {
      if (location.protocol === "file:") {
        throw new Error("Open this project through HTTP/HTTPS, not file://.");
      }
      if (typeof window.Dos !== "function") {
        throw new Error("js-dos failed to load.");
      }

      const initFs = await prepareInitFs();
      ui.container.replaceChildren();
      log("Launching DOSBox with prepared filesystem...");

      player = window.Dos(ui.container, {
        dosboxConf: DOSBOX_CONF,
        initFs,
        pathPrefix: EMULATORS_PATH_PREFIX,
        autoStart: true,
        autoSave: true,
        theme: "dark",
        backend: "dosbox",
        backendLocked: true,
        imageRendering: "pixelated",
        renderAspect: "4/3",
        fsChanges: {
          local: true,
          urlToKey: async () => SAVE_KEY,
        },
        onEvent: (event, arg) => {
          log(`js-dos event: ${event}`);

          if (event === "emu-ready") {
            const version = typeof player?.getVersion === "function" ? player.getVersion() : null;
            if (version) log("js-dos version", version);
          }

          if (event === "ci-ready") {
            commandInterface = arg || null;
            running = true;
            booting = false;
            setControls(true);
            ui.container.focus?.();
          }

          if (event === "exit") {
            log("DOSBox exited", arg);
          }
        },
      });

      if (typeof player.setNoCloud === "function") {
        player.setNoCloud(true);
      }
    } catch (error) {
      log("Startup failed", error?.stack || error?.message || String(error));
      booting = false;
      running = false;
      await stopPlayer({ quiet: true });
      setControls(false);
      ui.diagnosticsPanel.hidden = false;
      ui.diagnosticsBtn.setAttribute("aria-expanded", "true");
      await runDiagnostics();
    }
  }

  async function restart() {
    log("Restart requested");
    await stopPlayer({ quiet: true });
    await boot();
  }

  async function saveState() {
    if (!player) return;

    try {
      const saved = await player.save();
      log(saved ? "Local emulator state saved" : "Save request completed without new changes");
    } catch (error) {
      log("Save failed", error?.message || String(error));
    }
  }

  function togglePause() {
    if (!player || typeof player.setPaused !== "function") return;

    paused = !paused;
    player.setPaused(paused);
    ui.pauseBtn.textContent = paused ? "Resume" : "Pause";
    log(paused ? "Emulation paused" : "Emulation resumed");
  }

  function enterFullscreen() {
    if (!player || typeof player.setFullScreen !== "function") return;
    player.setFullScreen(true);
    log("Fullscreen requested");
  }

  function toggleDiagnostics() {
    const willOpen = ui.diagnosticsPanel.hidden;
    ui.diagnosticsPanel.hidden = !willOpen;
    ui.diagnosticsBtn.setAttribute("aria-expanded", String(willOpen));

    if (willOpen && ui.checks.childElementCount === 0) {
      void runDiagnostics();
    }
  }

  ui.startBtn.addEventListener("click", boot);
  ui.restartBtn.addEventListener("click", restart);
  ui.pauseBtn.addEventListener("click", togglePause);
  ui.saveBtn.addEventListener("click", saveState);
  ui.fullscreenBtn.addEventListener("click", enterFullscreen);
  ui.stopBtn.addEventListener("click", () => stopPlayer());
  ui.diagnosticsBtn.addEventListener("click", toggleDiagnostics);
  ui.runDiagnosticsBtn.addEventListener("click", runDiagnostics);
  ui.clearLogBtn.addEventListener("click", () => { ui.log.textContent = ""; });

  window.addEventListener("error", (event) => {
    log("Window error", event.message || String(event.error || event));
  });

  window.addEventListener("unhandledrejection", (event) => {
    log("Unhandled promise rejection", event.reason?.stack || event.reason?.message || String(event.reason));
  });

  document.addEventListener("DOMContentLoaded", () => {
    setControls(false);
    log("Turbo C3 Web Lab initialized");
  });
})();
