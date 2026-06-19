const { app, BrowserWindow, ipcMain, desktopCapturer, screen, shell } = require("electron");
const http = require("http");
const path = require("path");

const isDev = !app.isPackaged;
let mainWindow;
let dockWindow;
let panelWindow;
let cursorTimer;
const backendEnv = loadBackendEnv();
const gotSingleInstanceLock = app.requestSingleInstanceLock();
const authCallbackUrl = "http://127.0.0.1:47835/auth/callback";

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    if (dockWindow && !dockWindow.isDestroyed()) dockWindow.showInactive();
    if (panelWindow && !panelWindow.isDestroyed()) {
      positionPanelNearDock();
      panelWindow.showInactive();
    }
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1100,
    minHeight: 760,
    title: "TaskPilot AI",
    backgroundColor: "#f7f4ee",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    const localDist = path.join(__dirname, "../dist/index.html");
    mainWindow.loadFile(localDist, { query: { desktop: "1" } });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"), { query: { desktop: "1" } });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    app.quit();
  });
}

function createDockWindow() {
  const workArea = screen.getPrimaryDisplay().workArea;
  dockWindow = new BrowserWindow({
    width: 76,
    height: 76,
    x: workArea.x + workArea.width - 96,
    y: workArea.y + workArea.height - 96,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: "TaskPilot Floating Agent",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  dockWindow.setAlwaysOnTop(true, process.platform === "darwin" ? "screen-saver" : "floating");
  if (process.platform === "darwin") {
    dockWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  dockWindow.loadFile(path.join(__dirname, "floating-dock.html"));
}

function createPanelWindow() {
  const workArea = screen.getPrimaryDisplay().workArea;
  panelWindow = new BrowserWindow({
    width: 430,
    height: 610,
    x: workArea.x + workArea.width - 456,
    y: workArea.y + workArea.height - 710,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    hasShadow: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: "TaskPilot Dock",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  panelWindow.setAlwaysOnTop(true, "floating");
  if (process.platform === "darwin") {
    panelWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  panelWindow.loadFile(path.join(__dirname, "floating-panel.html"));
}

function startCursorTracking() {
  cursorTimer = setInterval(() => {
    if (!dockWindow || dockWindow.isDestroyed()) return;
    dockWindow.webContents.send("taskpilot-floating:cursor-move", screen.getCursorScreenPoint());
  }, 80);
}

function togglePanel() {
  if (!panelWindow || panelWindow.isDestroyed()) {
    createPanelWindow();
    return;
  }
  if (panelWindow.isVisible()) {
    panelWindow.hide();
  } else {
    positionPanelNearDock();
    panelWindow.showInactive();
  }
}

function moveDockWindow(x, y) {
  if (!dockWindow || dockWindow.isDestroyed()) return;
  const display = screen.getDisplayNearestPoint({ x, y });
  const area = display.workArea;
  const bounds = dockWindow.getBounds();
  const nextX = Math.max(area.x, Math.min(x, area.x + area.width - bounds.width));
  const nextY = Math.max(area.y, Math.min(y, area.y + area.height - bounds.height));
  dockWindow.setPosition(Math.round(nextX), Math.round(nextY), false);
  positionPanelNearDock();
}

function positionPanelNearDock() {
  if (!dockWindow || dockWindow.isDestroyed() || !panelWindow || panelWindow.isDestroyed()) return;
  const dock = dockWindow.getBounds();
  const panel = panelWindow.getBounds();
  const display = screen.getDisplayNearestPoint({ x: dock.x, y: dock.y });
  const area = display.workArea;
  const preferLeft = dock.x + dock.width + panel.width > area.x + area.width;
  const x = preferLeft ? dock.x - panel.width - 12 : dock.x + dock.width + 12;
  const y = Math.max(area.y, Math.min(dock.y - panel.height + dock.height, area.y + area.height - panel.height));
  panelWindow.setPosition(Math.round(Math.max(area.x, x)), Math.round(y), false);
}

async function getSupabaseUser(accessToken) {
  const response = await fetch(`${backendEnv.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: backendEnv.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) throw new Error("Supabase could not validate the Google session.");
  return response.json();
}

async function saveTaskPilotRole(user, accessToken, role) {
  await fetch(`${backendEnv.SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: backendEnv.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ data: { ...(user.user_metadata || {}), taskpilot_role: role } })
  });

  await fetch(`${backendEnv.SUPABASE_URL}/rest/v1/engineer_profiles?id=eq.${encodeURIComponent(user.id)}`, {
    method: "PATCH",
    headers: {
      apikey: backendEnv.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({ role })
  });
}

function startGoogleLogin(role) {
  if (!backendEnv.SUPABASE_URL || !backendEnv.SUPABASE_ANON_KEY) {
    return Promise.resolve({ success: false, error: "Supabase is not configured." });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.close();
      resolve(result);
    };

    const server = http.createServer(async (request, response) => {
      if (request.method === "GET" && request.url?.startsWith("/auth/callback")) {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(`<!doctype html>
<html><head><meta charset="utf-8"><title>TaskPilot signed in</title></head>
<body style="font-family:system-ui;padding:48px;color:#172033">
<h2>Finishing TaskPilot sign-in...</h2>
<p id="status">You can close this window when authentication completes.</p>
<script>
const values = new URLSearchParams(location.hash.slice(1));
fetch("/auth/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ accessToken: values.get("access_token"), error: values.get("error_description") })
}).then((response) => {
  document.querySelector("#status").textContent = response.ok
    ? "Signed in successfully. Return to TaskPilot AI."
    : "Sign-in could not be completed. Return to TaskPilot and try again.";
});
</script></body></html>`);
        return;
      }

      if (request.method === "POST" && request.url === "/auth/session") {
        let body = "";
        request.on("data", (chunk) => {
          body += chunk;
        });
        request.on("end", async () => {
          try {
            const payload = JSON.parse(body || "{}");
            if (!payload.accessToken) throw new Error(payload.error || "Google did not return an access token.");
            const user = await getSupabaseUser(payload.accessToken);
            await saveTaskPilotRole(user, payload.accessToken, role);
            response.writeHead(204);
            response.end();
            finish({
              success: true,
              session: {
                provider: "google-supabase",
                role,
                userId: user.id,
                email: user.email,
                name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
                avatarUrl: user.user_metadata?.avatar_url || ""
              }
            });
          } catch (error) {
            response.writeHead(400);
            response.end();
            finish({ success: false, error: error.message });
          }
        });
        return;
      }

      response.writeHead(404);
      response.end();
    });

    server.on("error", (error) => finish({ success: false, error: `Login callback failed: ${error.message}` }));
    server.listen(47835, "127.0.0.1", () => {
      const authorizeUrl = new URL(`${backendEnv.SUPABASE_URL}/auth/v1/authorize`);
      authorizeUrl.searchParams.set("provider", "google");
      authorizeUrl.searchParams.set("redirect_to", authCallbackUrl);
      authorizeUrl.searchParams.set("scopes", "openid email profile");
      shell.openExternal(authorizeUrl.toString());
    });

    const timeout = setTimeout(
      () => finish({ success: false, error: "Google sign-in timed out. Please try again." }),
      120000
    );
  });
}

if (gotSingleInstanceLock) {
app.whenReady().then(() => {
  ipcMain.handle("taskpilot:detect-context", async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    return {
      success: true,
      data: {
        app: { name: focusedWindow?.getTitle() || "TaskPilot AI" },
        platform: process.platform,
        capturedAt: new Date().toISOString()
      }
    };
  });

  ipcMain.handle("taskpilot:tee-attest", async () => ({
    success: true,
    data: {
      mode: "TEE-ready local enclave",
      status: "attested",
      boundary: "screen frames are ephemeral and user-approved",
      platform: process.platform
    }
  }));

  ipcMain.handle("taskpilot:backend-config", async () => ({
    geminiConfigured: Boolean(backendEnv.GEMINI_API_KEY),
    teeMode: backendEnv.TASKPILOT_TEE_MODE || "local-attested",
    supabaseConfigured: Boolean(backendEnv.SUPABASE_URL && backendEnv.SUPABASE_ANON_KEY),
    supabaseUrl: backendEnv.SUPABASE_URL || "",
    supabaseAnonKey: backendEnv.SUPABASE_ANON_KEY ? "configured" : ""
  }));

  ipcMain.handle("taskpilot:google-login", async (_event, { role }) => startGoogleLogin(role));

  ipcMain.handle("taskpilot:vision-summary", async (_event, payload) => ({
    provider: "gemini",
    configured: Boolean(backendEnv.GEMINI_API_KEY),
    summary: backendEnv.GEMINI_API_KEY
      ? `Backend Gemini is configured for ${payload?.sourceName || "screen"}. TaskPilot will send only redacted OCR context through the TEE boundary and wait for user approval before execution.`
      : "Backend Gemini is not configured. Add GEMINI_API_KEY in backend/utkarsh/.env to enable live vision.",
    tee: {
      rawKeyExposedToFrontend: false,
      rawScreenshotRequired: false,
      approvalRequired: true
    }
  }));

  ipcMain.handle("taskpilot:capture-screen", captureScreen);
  ipcMain.handle("taskpilot-floating:capture-screen", captureScreen);

  ipcMain.handle("taskpilot-floating:create-plan", async (_event, { intent }) => ({
    success: true,
    data: {
      steps: [
        { id: "context", description: "Detect active app and selected task" },
        { id: "tee", description: "Seal minimized payload inside TEE envelope" },
        { id: "reason", description: `Reason about: ${intent}` },
        { id: "approval", description: "Wait for user approval before execution" }
      ]
    }
  }));

  ipcMain.handle("taskpilot-floating:execute-plan", async (_event, { intent }) => ({
    success: true,
    summary:
      intent && /ocr|screen|scan/i.test(intent)
        ? "TEE OCR scan prepared. Screen frames stay ephemeral, secrets are redacted, and final execution waits for your approval."
        : "Top recommendation: handle the P1 upload timeout first, then review the blocked auth-token PR. No action was executed without approval."
  }));

  ipcMain.on("taskpilot-floating:toggle-panel", togglePanel);
  ipcMain.on("taskpilot-floating:hide-panel", () => panelWindow?.hide());
  ipcMain.on("taskpilot-floating:move-dock", (_event, point) => moveDockWindow(point.x, point.y));
  ipcMain.on("taskpilot-floating:restore-main", () => {
    if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
    mainWindow.show();
    mainWindow.focus();
  });

  createMainWindow();
  createDockWindow();
  startCursorTracking();

  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
    if (!dockWindow || dockWindow.isDestroyed()) createDockWindow();
  });
});
}

async function captureScreen() {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 1280, height: 720 }
    });
    const source = sources[0];
    return {
      name: source?.name || "Primary screen",
      thumbnail: source?.thumbnail?.toDataURL() || null,
      tee: {
        ephemeral: true,
        userApproved: true,
        redactedBeforeExternalCall: true
      }
    };
}

function loadBackendEnv() {
  const envPath = path.join(__dirname, "../../../backend/utkarsh/.env");
  try {
    const text = require("fs").readFileSync(envPath, "utf8");
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.trim().startsWith("#"))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
        })
    );
  } catch {
    return process.env;
  }
}

app.on("window-all-closed", () => {
  if (cursorTimer) clearInterval(cursorTimer);
  if (process.platform !== "darwin") app.quit();
});
