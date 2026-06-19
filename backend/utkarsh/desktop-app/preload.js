const { contextBridge, ipcRenderer } = require('electron');

// Legacy API (keep for backward compatibility)
contextBridge.exposeInMainWorld('api', {
    send: (channel, data) => {
        ipcRenderer.send(channel, data);
    },
    invoke: (channel, data) => {
        return ipcRenderer.invoke(channel, data);
    },
    on: (channel, callback) => {
        ipcRenderer.removeAllListeners(channel);
        ipcRenderer.on(channel, (_event, data) => callback(data));
    },
    once: (channel, callback) => {
        ipcRenderer.once(channel, (_event, data) => callback(data));
    }
});

// New comprehensive API for all Metrixa features
contextBridge.exposeInMainWorld('electronAPI', {
    // Permissions
    checkPermissions: () => ipcRenderer.invoke('check-permissions'),
    requestScreenRecordingPermission: () => ipcRenderer.send('request-screen-recording-permission'),
    openPermissionSettings: (type) => ipcRenderer.send('open-permission-settings', type),

    // Monitoring Controls
    startMonitoring: () => ipcRenderer.send('start-monitoring'),
    stopMonitoring: () => ipcRenderer.send('stop-monitoring'),
    pauseMonitoring: () => ipcRenderer.send('pause-monitoring'),
    resumeMonitoring: () => ipcRenderer.send('resume-monitoring'),
    setCaptureInterval: (intervalMs) => ipcRenderer.send('set-capture-interval', intervalMs),
    addExcludedApp: (appName) => ipcRenderer.send('add-excluded-app', appName),
    removeExcludedApp: (appName) => ipcRenderer.send('remove-excluded-app', appName),
    getMonitoringStats: () => ipcRenderer.invoke('get-monitoring-stats'),
    onMonitoringEvent: (callback) => ipcRenderer.on('monitoring-event', (event, data) => callback(data)),

    // Daily Summary
    getDailySummary: (date) => ipcRenderer.invoke('get-daily-summary', date),
    getWeeklySummary: () => ipcRenderer.invoke('get-weekly-summary'),

    // Email Digest
    getEmailDigest: (date) => ipcRenderer.invoke('get-email-digest', date),
    getEmailsNeedingReply: (date) => ipcRenderer.invoke('get-emails-needing-reply', date),

    // Task List
    getPendingTasks: () => ipcRenderer.invoke('get-pending-tasks'),
    extractTasksFromActivity: () => ipcRenderer.invoke('extract-tasks-from-activity'),
    completeTask: (taskId) => ipcRenderer.send('complete-task', taskId),
    addTask: (description, priority) => ipcRenderer.invoke('add-task', description, priority),
    onTaskCompleted: (callback) => ipcRenderer.on('task-completed', (event, taskId) => callback(taskId)),

    // Search
    search: (query, options) => ipcRenderer.invoke('search', query, options),
    naturalLanguageSearch: (query) => ipcRenderer.invoke('natural-language-search', query),
    searchByApp: (appName, limit) => ipcRenderer.invoke('search-by-app', appName, limit),

    // Ollama
    checkOllama: () => ipcRenderer.send('check-ollama'),
    isOllamaInstalled: () => ipcRenderer.invoke('is-ollama-installed'),
    installOllama: () => ipcRenderer.send('install-ollama'),
    pullModel: () => ipcRenderer.send('pull-model'),
    onOllamaStatus: (callback) => ipcRenderer.on('ollama-status', callback),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),

    // Analysis
    manualAnalysis: (query) => ipcRenderer.send('manual-analysis', { query }),
    getScreenText: () => ipcRenderer.invoke('get-screen-text'),
    onAnalysisResult: (callback) => ipcRenderer.on('analysis-result', callback),
    onPlanReceived: (callback) => ipcRenderer.on('plan-received', callback),
    approvePlan: (plan) => ipcRenderer.send('approve-plan', plan),

    // GUI Automation
    guiClick: (x, y) => ipcRenderer.send('gui-click', { x, y }),
    guiType: (text) => ipcRenderer.send('gui-type', { text }),
    guiMove: (x, y) => ipcRenderer.send('gui-move', { x, y })
});

console.log('✓ Robust Preload script loaded successfully');
console.log('✓ New electronAPI with monitoring, AI, and productivity features available');
