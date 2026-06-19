const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("taskPilotDesktop", {
  isDesktop: true,
  captureScreen: (teeEnvelope) => ipcRenderer.invoke("taskpilot:capture-screen", teeEnvelope),
  getBackendConfig: () => ipcRenderer.invoke("taskpilot:backend-config"),
  googleLogin: (role) => ipcRenderer.invoke("taskpilot:google-login", { role }),
  summarizeVision: (payload) => ipcRenderer.invoke("taskpilot:vision-summary", payload),
  detectContext: () => ipcRenderer.invoke("taskpilot:detect-context"),
  teeAttest: () => ipcRenderer.invoke("taskpilot:tee-attest")
});

contextBridge.exposeInMainWorld("taskPilotFloating", {
  togglePanel: () => ipcRenderer.send("taskpilot-floating:toggle-panel"),
  hidePanel: () => ipcRenderer.send("taskpilot-floating:hide-panel"),
  moveDock: (point) => ipcRenderer.send("taskpilot-floating:move-dock", point),
  restoreMain: () => ipcRenderer.send("taskpilot-floating:restore-main"),
  detectContext: () => ipcRenderer.invoke("taskpilot:detect-context"),
  captureScreen: () => ipcRenderer.invoke("taskpilot-floating:capture-screen"),
  createPlan: (payload) => ipcRenderer.invoke("taskpilot-floating:create-plan", payload),
  executePlan: (payload) => ipcRenderer.invoke("taskpilot-floating:execute-plan", payload),
  onCursorMove: (callback) => ipcRenderer.on("taskpilot-floating:cursor-move", (_event, point) => callback(point))
});
