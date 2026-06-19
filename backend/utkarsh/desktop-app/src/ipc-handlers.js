// New IPC Handlers for MVP Features
// This file is required from main.js

const DailySummaryFeature = require('./features/daily-summary');
const EmailDigestFeature = require('./features/email-digest');
const TaskListFeature = require('./features/task-list');
const SearchFeature = require('./features/search');
const PermissionsManager = require('./core/permissions');
const { ipcMain } = require('electron');

// Initialize feature instances
const dailySummary = new DailySummaryFeature();
const emailDigest = new EmailDigestFeature();
const taskList = new TaskListFeature();
const searchFeature = new SearchFeature();

// Permission manager (shared with main.js)
let permissionsManager = null;

// Permissions
ipcMain.handle('check-permissions', async () => {
    if (!permissionsManager) {
        permissionsManager = new PermissionsManager();
    }
    return await permissionsManager.getPermissionStatus();
});

ipcMain.on('request-screen-recording-permission', async (event) => {
    if (!permissionsManager) {
        permissionsManager = new PermissionsManager();
    }
    await permissionsManager.requestScreenRecordingPermission();
    event.sender.send('permission-requested');
});

ipcMain.on('open-permission-settings', async (event, permissionType) => {
    if (!permissionsManager) {
        permissionsManager = new PermissionsManager();
    }
    await permissionsManager.openPermissionSettings(permissionType);
});

// Monitoring controls
ipcMain.on('pause-monitoring', () => {
    if (monitoringService) {
        monitoringService.pause();
    }
});

ipcMain.on('resume-monitoring', () => {
    if (monitoringService) {
        monitoringService.resume();
    }
});

ipcMain.on('set-capture-interval', (event, intervalMs) => {
    if (monitoringService) {
        monitoringService.setCaptureInterval(intervalMs);
    }
});

ipcMain.on('add-excluded-app', (event, appName) => {
    if (monitoringService) {
        monitoringService.addExcludedApp(appName);
    }
});

ipcMain.on('remove-excluded-app', (event, appName) => {
    if (monitoringService) {
        monitoringService.removeExcludedApp(appName);
    }
});

ipcMain.handle('get-monitoring-stats', () => {
    if (monitoringService) {
        return monitoringService.getStats();
    }
    return null;
});

// Daily Summary
ipcMain.handle('get-daily-summary', async (event, date) => {
    try {
        const targetDate = date ? new Date(date) : null;
        return await dailySummary.getDailySummary(targetDate);
    } catch (error) {
        console.error('Failed to get daily summary:', error);
        return { error: error.message };
    }
});

ipcMain.handle('get-weekly-summary', async () => {
    try {
        return await dailySummary.getWeeklySummary();
    } catch (error) {
        console.error('Failed to get weekly summary:', error);
        return { error: error.message };
    }
});

// Email Digest
ipcMain.handle('get-email-digest', async (event, date) => {
    try {
        const targetDate = date ? new Date(date) : null;
        return await emailDigest.getEmailDigest(targetDate);
    } catch (error) {
        console.error('Failed to get email digest:', error);
        return { error: error.message };
    }
});

ipcMain.handle('get-emails-needing-reply', async (event, date) => {
    try {
        const targetDate = date ? new Date(date) : null;
        return await emailDigest.getEmailsNeedingReply(targetDate);
    } catch (error) {
        console.error('Failed to get emails needing reply:', error);
        return { error: error.message };
    }
});

// Task List
ipcMain.handle('get-pending-tasks', async () => {
    try {
        return await taskList.getPendingTasks();
    } catch (error) {
        console.error('Failed to get pending tasks:', error);
        return { error: error.message };
    }
});

ipcMain.handle('extract-tasks-from-activity', async () => {
    try {
        return await taskList.extractTasksFromRecentActivity();
    } catch (error) {
        console.error('Failed to extract tasks:', error);
        return { error: error.message };
    }
});

ipcMain.on('complete-task', async (event, taskId) => {
    try {
        await taskList.completeTask(taskId);
        event.sender.send('task-completed', taskId);
    } catch (error) {
        console.error('Failed to complete task:', error);
    }
});

ipcMain.handle('add-task', async (event, description, priority) => {
    try {
        return await taskList.addTask(description, priority);
    } catch (error) {
        console.error('Failed to add task:', error);
        return { error: error.message };
    }
});

// Search
ipcMain.handle('search', async (event, query, options) => {
    try {
        return await searchFeature.search(query, options);
    } catch (error) {
        console.error('Search failed:', error);
        return { error: error.message };
    }
});

ipcMain.handle('natural-language-search', async (event, query) => {
    try {
        return await searchFeature.naturalLanguageSearch(query);
    } catch (error) {
        console.error('Natural language search failed:', error);
        return { error: error.message };
    }
});

ipcMain.handle('search-by-app', async (event, appName, limit) => {
    try {
        return await searchFeature.searchByApp(appName, limit);
    } catch (error) {
        console.error('Search by app failed:', error);
        return { error: error.message };
    }
});
