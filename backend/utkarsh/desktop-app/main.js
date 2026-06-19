require('dotenv').config();
const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, Notification } = require('electron');
app.setName('Metrixa AI');
const path = require('path');

// Handle uncaught errors to prevent crashes
process.on('uncaughtException', (error) => {
    console.error('[MAIN] Uncaught Exception:', error);
    // Don't exit - keep the app running
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[MAIN] Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit - keep the app running
});
const fs = require('fs');
const http = require('http');
const activeWin = require('active-win');

// New monitoring and AI components
const SmartMonitor = require('./src/core/smart-monitor');
const PermissionsManager = require('./src/core/permissions');
const LLMRouter = require('./src/ai/llm-router');
const IntentClassifier = require('./src/ai/intent-classifier');
const Summarizer = require('./src/ai/summarizer');
const TaskExtractor = require('./src/ai/task-extractor');
const AgentRunner = require('./src/orchestrator/runner');
const Store = require('electron-store');

// Enhanced Agent Components
const ContextDetector = require('./src/context/context-detector');
const TaskPlanner = require('./src/planning/task-planner');
const ActionExecutor = require('./src/execution/action-executor');

// Feature modules
const DailySummaryFeature = require('./src/features/daily-summary');
const TaskListFeature = require('./src/features/task-list');
const SearchFeature = require('./src/features/search');
const EmailDigestFeature = require('./src/features/email-digest');

// Core Utilities
const { getScreenText } = require('./src/context/screen');
const TextCleaner = require('./src/utils/text-cleaner');
const { detectEmailContext, extractEmailMetadata } = require('./src/utils/email-detector');
const { guiClick, guiType, guiMove } = require('./src/actions/gui');

const store = new Store();

// Initialize feature instances
let dailySummaryFeature = null;
let taskListFeature = null;
let searchFeature = null;
let emailDigestFeature = null;

// Initialize agent instances
let contextDetector = null;
let taskPlanner = null;
let actionExecutor = null;

// Keep a global reference of the window object
let mainWindow;
let floatingPanel = null;
let floatingIcon = null;
let cursorTimer = null;
let monitoringService;
let agentRunner;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false,
            preload: path.join(__dirname, 'preload.js')
        },
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true,
        hasShadow: true
    });

    // LOAD CORRECT FILE
    mainWindow.loadFile('onboarding.html');

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.on('minimize', () => {
        console.log('[MAIN] mainWindow minimized');
        showFloatingIcon();
    });

    mainWindow.on('hide', () => {
        console.log('[MAIN] mainWindow hidden');
        showFloatingIcon();
    });

    // Initialize Permissions
    const permissionsManager = new PermissionsManager();
    permissionsManager.requestScreenRecordingPermission();
    permissionsManager.requestAccessibilityPermission();

    // Verify Ollama on startup
    checkOllamaStatus();
}

function createFloatingIcon() {
    try {
        console.log('[MAIN] createFloatingIcon starting');
        if (floatingIcon && !floatingIcon.isDestroyed()) {
            console.log('[MAIN] floatingIcon already exists');
            return;
        }

        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
        console.log(`[MAIN] Screen size: ${screenWidth}x${screenHeight}`);

        const iconSize = 60;
        const x = 30; // Closer to corner on left
        const y = screenHeight - iconSize - 30; // Bottom-left corner
        console.log(`[MAIN] Creating floating icon at: ${x}, ${y}`);

        floatingIcon = new BrowserWindow({
            width: iconSize,
            height: iconSize,
            x: x,
            y: y,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                backgroundThrottling: false,
                webSecurity: false
            },
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            focusable: false,
            resizable: false,
            hasShadow: false,
            show: false,
            skipTaskbar: true,
            backgroundColor: '#00000000',
            roundedCorners: false,
            fullscreenable: false
        });

        // Forced transparency
        floatingIcon.setBackgroundColor('#00000000');
        floatingIcon.setOpacity(0.999);
        
        // Ensure it stays on top
        floatingIcon.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        floatingIcon.setAlwaysOnTop(true, 'floating');

        floatingIcon.loadFile('floating-icon.html');
        console.log('[MAIN] floatingIcon loaded floating-icon.html');

        floatingIcon.on('closed', () => {
            console.log('[MAIN] floatingIcon closed');
            floatingIcon = null;
        });
        
        floatingIcon.on('error', (err) => {
            console.error('[MAIN] floatingIcon error:', err);
        });
        
        floatingIcon.once('ready-to-show', () => {
            console.log('[MAIN] floatingIcon ready to show');
        });
    } catch (error) {
        console.error('[MAIN] Error creating floating icon:', error);
    }
}

function showFloatingIcon() {
    console.log('[MAIN] showFloatingIcon called');
    if (!floatingIcon || floatingIcon.isDestroyed()) {
        console.log('[MAIN] Creating new floating icon from showFloatingIcon');
        createFloatingIcon();
    }
    
    if (floatingIcon) {
        if (!floatingIcon.isVisible()) {
            console.log('[MAIN] Showing floating icon');
            floatingIcon.show();
        }
        
        // Start cursor tracking
        if (!cursorTimer) {
            cursorTimer = setInterval(() => {
                const cursor = screen.getCursorScreenPoint();
                if (floatingIcon && !floatingIcon.isDestroyed()) {
                    floatingIcon.webContents.send('cursor-move', cursor);
                }
            }, 50); // 20fps tracking
        }
    } else {
        console.error('[MAIN] Failed to show floating icon: floatingIcon is null');
    }
}

function hideFloatingIcon() {
    console.log('[MAIN] hideFloatingIcon called');
    if (cursorTimer) {
        clearInterval(cursorTimer);
        cursorTimer = null;
    }
    if (floatingIcon && !floatingIcon.isDestroyed()) {
        console.log('[MAIN] Hiding floating icon');
        floatingIcon.hide();
    }
}


// Create Floating Panel Window - Centered at bottom
function createFloatingPanel() {
    try {
        console.log('[MAIN] createFloatingPanel called');
        
        if (floatingPanel && !floatingPanel.isDestroyed()) {
            console.log('[MAIN] Panel already exists, showing it');
            floatingPanel.show();
            floatingPanel.focus();
            return;
        }

        // Get primary display dimensions
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

        const panelWidth = 720;
        const panelHeight = Math.min(600, screenHeight * 0.7);
        const x = Math.round((screenWidth - panelWidth) / 2);
        const y = Math.round(screenHeight - panelHeight - 40);

        console.log('[MAIN] Creating new BrowserWindow');
        floatingPanel = new BrowserWindow({
            width: panelWidth,
            height: panelHeight,
            x: x,
            y: y,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                preload: path.join(__dirname, 'preload.js'),
                backgroundThrottling: false
            },
            frame: false,
            backgroundColor: '#00000000',
            alwaysOnTop: true,
            resizable: true,
            hasShadow: true,
            show: false,
            roundedCorners: true
        });

        floatingPanel.loadFile('floating-panel.html');

        floatingPanel.on('closed', () => {
            console.log('[MAIN] Floating panel closed');
            floatingPanel = null;
        });

        floatingPanel.on('error', (error) => {
            console.error('[MAIN] Floating panel error:', error);
        });

        // Show when ready
        floatingPanel.once('ready-to-show', () => {
            console.log('[MAIN] Panel ready to show');
            floatingPanel.show();
            floatingPanel.focus();
        });
        
        console.log('[MAIN] Floating panel created successfully');
    } catch (error) {
        console.error('[MAIN] Error creating floating panel:', error);
        floatingPanel = null;
    }
}

// Show Floating Panel - Recenter on show
function showFloatingPanel() {
    try {
        console.log('[MAIN] showFloatingPanel called');
        
        if (!floatingPanel || floatingPanel.isDestroyed()) {
            console.log('[MAIN] Creating new floating panel');
            createFloatingPanel();
        } else {
            console.log('[MAIN] Showing existing floating panel');
            // Recenter the window
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
            const bounds = floatingPanel.getBounds();
            const x = Math.round((screenWidth - bounds.width) / 2);
            const y = Math.round(screenHeight - bounds.height - 40);
            floatingPanel.setPosition(x, y);
            floatingPanel.show();
            floatingPanel.focus();
        }
        
        // Notify panel to refresh context (with delay to ensure it's ready)
        setTimeout(() => {
            if (floatingPanel && !floatingPanel.isDestroyed()) {
                try {
                    floatingPanel.webContents.send('panel-show');
                    console.log('[MAIN] Sent panel-show event');
                } catch (err) {
                    console.error('[MAIN] Failed to send panel-show event:', err);
                }
            }
        }, 100);
    } catch (error) {
        console.error('[MAIN] Error in showFloatingPanel:', error);
    }
}

app.on('ready', () => {
    createWindow();

    // Register global shortcuts
    // ⌘ + Shift + Space - Manual analysis (existing)
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
        captureAndAnalyze();
    });

    // ⌘ + Shift + M - Open Metrixa Agent (NEW)
    globalShortcut.register('CommandOrControl+Shift+M', () => {
        showFloatingPanel();
    });

    // Hide dock icon initially if preferred, or keep it
    if (app.dock) app.dock.setIcon(path.join(__dirname, 'assets', 'icon.png'));
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// --- IPC Handlers ---

ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('restore-main-window', () => {
    // In this new design, clicking the icon opens the Agent panel
    showFloatingPanel();
});


// Force show floating panel - emergency recovery
ipcMain.on('force-show-panel', () => {
    console.log('[MAIN] Force show panel requested');
    try {
        // Destroy existing panel if it's in a bad state
        if (floatingPanel) {
            try {
                if (!floatingPanel.isDestroyed()) {
                    floatingPanel.destroy();
                }
            } catch (e) {
                console.log('[MAIN] Error destroying old panel:', e.message);
            }
            floatingPanel = null;
        }
        
        // Create fresh panel
        createFloatingPanel();
    } catch (error) {
        console.error('[MAIN] Force show panel failed:', error);
    }
});

ipcMain.on('force-show-icon', () => {
    console.log('[MAIN] Force show icon requested');
    showFloatingIcon();
});

ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.hide();
});

ipcMain.on('start-monitoring', async () => {
    console.log('Starting new monitoring service...');

    if (!monitoringService) {
        monitoringService = new SmartMonitor(mainWindow);
        await monitoringService.initialize();

        // Notify user about Smart Monitor
        new Notification({
            title: '🧠 Smart Monitor Active',
            body: 'Metrixa is now intelligently capturing your work context.',
            silent: true
        }).show();
    }

    monitoringService.start();
    mainWindow.webContents.send('monitoring-status', 'active');
});

ipcMain.on('stop-monitoring', () => {
    if (monitoringService) {
        monitoringService.stop();
    }
    mainWindow.webContents.send('monitoring-status', 'inactive');
});

ipcMain.handle('get-status', () => {
    return monitoringService && monitoringService.isMonitoring ? 'active' : 'inactive';
});

// Manual Analysis Trigger
ipcMain.on('manual-analysis', async (event, payload) => {
    // Payload might be { query: "text" } or just "text"
    const query = typeof payload === 'object' && payload.query ? payload.query : payload;
    console.log('Manual analysis requested:', query);
    captureAndAnalyze(query);
});

// Settings & Profile Handlers
ipcMain.handle('get-user-profile', () => {
    return store.get('userProfile') || { name: '', role: '', tone: 'professional', preferences: '' };
});

ipcMain.on('save-user-profile', (event, profile) => {
    store.set('userProfile', profile);
    console.log('User profile saved:', profile);
});

// --- PIXELS MODE & AUTOMATION HANDLERS ---

ipcMain.handle('get-screen-text', async () => {
    try {
        console.log('Pixels Mode: Scanning screen...');
        return await getScreenText(mainWindow);
    } catch (error) {
        console.error('Pixels Mode Scan Failed:', error);
        return { error: error.message };
    }
});

ipcMain.on('gui-click', (event, { x, y }) => {
    guiClick(x, y);
});

ipcMain.on('gui-type', (event, { text }) => {
    guiType(text);
});

ipcMain.on('gui-move', (event, { x, y }) => {
    guiMove(x, y);
});

ipcMain.on('approve-plan', (event, plan) => {
    console.log('Plan approved, starting execution...');
    if (!agentRunner) {
        agentRunner = new AgentRunner(mainWindow);
    }
    agentRunner.runPlan(plan).catch(err => {
        console.error('Plan execution failed:', err);
        mainWindow.webContents.send('analysis-result', `Error executing plan: ${err.message}`);
    });
});

// Check Ollama Status
async function checkOllamaStatus() {
    try {
        const OllamaClient = require('./src/ai/ollama-client');
        const ollama = new OllamaClient();
        
        const installed = await ollama.isAvailable();
        console.log('Ollama Installed:', installed);

        let models = [];
        if (installed) {
            models = await ollama.getAvailableModels();
            console.log('Available Models:', models);
            
            // Warm up the model for faster first response
            setTimeout(async () => {
                console.log('[STARTUP] Warming up Ollama model...');
                await ollama.warmup();
            }, 2000);
        }

        if (mainWindow) {
            mainWindow.webContents.send('ollama-status', {
                status: installed ? 'ready' : 'missing',
                models: models
            });
        }
    } catch (e) {
        console.error('Ollama check failed:', e);
        if (mainWindow) {
            mainWindow.webContents.send('ollama-status', { status: 'error', error: e.message });
        }
    }
}

// IPC Listener for frontend check
ipcMain.on('check-ollama', () => {
    console.log('IPC: check-ollama received');
    checkOllamaStatus();
});

ipcMain.on('check-llm-status', async (event) => {
    const router = new LLMRouter();
    await router.isAvailable();
    const primary = await router._detectPrimary();
    
    if (primary === 'openai') {
        event.reply('llm-status', { status: 'ready', provider: 'OpenAI GPT-4o-mini' });
    } else if (primary === 'ollama') {
        event.reply('llm-status', { status: 'ready', provider: 'Ollama' });
    } else {
        event.reply('llm-status', { status: 'error', provider: 'None' });
    }
});

// Complete Setup Handler
ipcMain.on('complete-setup', () => {
    console.log('Setup complete, loading main app...');
    if (mainWindow) {
        mainWindow.loadFile('main-app.html');
        // Enable resizing for main app
        mainWindow.setResizable(true);
        mainWindow.setSize(1200, 800);
        
        // ONLY center and show if not minimized/hidden
        if (!mainWindow.isMinimized() && mainWindow.isVisible()) {
            mainWindow.center();
        } else {
            console.log('[MAIN] Setup complete, staying minimized/hidden as per user state');
        }
    }
});

// Helper for Ollama Check
function isOllamaInstalled() {
    return new Promise((resolve) => {
        const req = http.get({
            hostname: '127.0.0.1',
            port: 11434,
            path: '/'
        }, (res) => {
            resolve(res.statusCode === 200 || res.statusCode === 404);
        });
        req.on('error', () => resolve(false));
    });
}
// Placeholder for checkOllamaModel since I removed the require
async function checkOllamaModel(modelName) { return true; }


// AI Service - Multi-tier approach
async function analyzeWithOllama(base64Image, query = null) {
    return new Promise((resolve, reject) => {
        console.log('Sending to Ollama (127.0.0.1:11434)...');

        const userProfile = store.get('userProfile') || {};
        const profileContext = userProfile.name ? `User: ${userProfile.name}, Role: ${userProfile.role}, Tone Preference: ${userProfile.tone}, Extra Info: ${userProfile.preferences}` : "No specific user profile provided.";

        // If query is a STRICT PROMPT (from captureAndAnalyze), use it directly
        // Otherwise, construct a standard prompt
        let finalPrompt;
        if (query && query.includes('STRICT RULES')) {
            finalPrompt = query;
        } else {
            const defaultPrompt = `
Analyze this screen and provide 2 short, actionable productivity tips. 
USER PROFILE: ${profileContext}
Format exactly like this:
TITLE: [Title]
DESCRIPTION: [One sentence description]
CATEGORY: [Category]`;

            const orchestrationPrompt = `
User Query: ${query}
USER PROFILE: ${profileContext}
Analyze the screen to answer the query.`;

            finalPrompt = query ? orchestrationPrompt : defaultPrompt;
        }

        const data = JSON.stringify({
            model: "llava",
            prompt: finalPrompt,
            images: [base64Image],
            stream: false
        });

        console.log('Ollama Request Payload (truncated):', JSON.stringify({
            model: "llava",
            prompt: finalPrompt,
            images: [base64Image.substring(0, 50) + '...'],
            stream: false
        }));

        const req = http.request({
            hostname: '127.0.0.1',
            port: 11434,
            path: '/api/generate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(responseBody);
                        resolve(parsed.response);
                    } catch (e) {
                        reject(new Error('Failed to parse Ollama response'));
                    }
                } else {
                    reject(new Error(`Ollama returned status ${res.statusCode}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

function getMockAnalysis() {
    return `
TITLE: Organize Your Workspace
DESCRIPTION: Using virtual desktops (Mission Control) can help separate work contexts.
CATEGORY: Productivity

TITLE: Keyboard Shortcuts
DESCRIPTION: Learn Cmd+Tab for quick app switching to boost efficiency.
CATEGORY: Workflow
    `;
}

// Main Capture and Analyze Logic - Simplified with Intent Classification
let llmRouter = null;
let intentClassifier = null;

async function getLLMRouter() {
    if (!llmRouter) {
        llmRouter = new LLMRouter();
    }
    return llmRouter;
}

async function captureAndAnalyze(query = null) {
    if (!mainWindow) return;

    const userQuery = typeof query === 'object' && query.query ? query.query : (query || 'summarize this');
    console.log('[ANALYZE] User query:', userQuery);

    mainWindow.webContents.send('analysis-result', 'Analyzing screen...');

    new Notification({
        title: '🔍 Analyzing Screen',
        body: 'Metrixa AI is processing your request...',
        silent: true
    }).show();

    try {
        // Minimize window for clean capture
        // Minimize window for clean capture if it's currently showing
        const wasMinimized = mainWindow.isMinimized() || !mainWindow.isVisible();
        if (!wasMinimized) {
            mainWindow.minimize();
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Capture screen
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1280, height: 720 }
        });

        if (sources.length === 0) throw new Error('No screen sources found');

        // Restore window ONLY if it was NOT already minimized
        if (!wasMinimized && mainWindow.isMinimized()) {
            mainWindow.restore();
        }

        // Get OCR text
        const screenTextRaw = await getScreenText(mainWindow);
        const cleanedText = TextCleaner.clean(screenTextRaw ? screenTextRaw.text : "");

        console.log(`[ANALYZE] OCR confidence: ${screenTextRaw.confidence || 0}%`);
        console.log(`[ANALYZE] Text length: ${cleanedText.length}`);

        // Handle low confidence
        if (screenTextRaw.lowConfidence) {
            console.log('[ANALYZE] Low OCR confidence - continuing anyway');
        }

        // Check minimum text
        if (cleanedText.length < 20) {
            mainWindow.webContents.send('analysis-result', 
                "I can't see much text on the screen. Try having more content visible.");
            return;
        }

        // Get context (optional - don't fail if unavailable)
        let context = '';
        try {
            const windowInfo = await activeWin();
            if (windowInfo) {
                context = `Looking at ${windowInfo.owner.name}: ${windowInfo.title}`;
            }
        } catch (e) {
            // Silently ignore permission errors - context is optional
        }

        // Process with intent classification
        const llm = await getLLMRouter();
        
        const result = await llm.processWithIntent(userQuery, cleanedText);
        
        let response = result.response;
        
        // Add context prefix if available
        if (context && !response.includes(context)) {
            response = `[${context}]\n\n${response}`;
        }

        // Send result
        new Notification({
            title: '✅ Analysis Complete',
            body: response.substring(0, 80) + (response.length > 80 ? '...' : ''),
            silent: false
        }).show();

        mainWindow.webContents.send('analysis-result', response);

    } catch (error) {
        console.error('[ANALYZE] Failed:', error);
        
        mainWindow.webContents.send('analysis-result', 
            `Error: ${error.message}\n\nMake sure Ollama is running: 'ollama serve'`);
    }
}

// Initialize feature modules
function initializeFeatures() {
    if (!dailySummaryFeature) dailySummaryFeature = new DailySummaryFeature();
    if (!taskListFeature) taskListFeature = new TaskListFeature();
    if (!searchFeature) searchFeature = new SearchFeature();
    if (!emailDigestFeature) emailDigestFeature = new EmailDigestFeature();
}

// --- FEATURE IPC HANDLERS ---

// Daily Summary Handlers
ipcMain.handle('get-daily-summary', async (event, date) => {
    try {
        initializeFeatures();
        const result = await dailySummaryFeature.getDailySummary(date ? new Date(date) : null);
        return { success: true, data: result };
    } catch (error) {
        console.error('Failed to get daily summary:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-weekly-summary', async () => {
    try {
        initializeFeatures();
        const result = await dailySummaryFeature.getWeeklySummary();
        return { success: true, data: result };
    } catch (error) {
        console.error('Failed to get weekly summary:', error);
        return { success: false, error: error.message };
    }
});

// Task List Handlers
ipcMain.handle('get-pending-tasks', async () => {
    try {
        initializeFeatures();
        const tasks = await taskListFeature.getPendingTasks();
        return { success: true, data: tasks };
    } catch (error) {
        console.error('Failed to get pending tasks:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('extract-tasks-from-activity', async () => {
    try {
        initializeFeatures();
        const tasks = await taskListFeature.extractTasksFromRecentActivity();
        return { success: true, data: tasks };
    } catch (error) {
        console.error('Failed to extract tasks:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.on('complete-task', async (event, taskId) => {
    try {
        initializeFeatures();
        await taskListFeature.completeTask(taskId);
        mainWindow.webContents.send('task-completed', taskId);
    } catch (error) {
        console.error('Failed to complete task:', error);
    }
});

ipcMain.handle('add-task', async (event, description, priority) => {
    try {
        initializeFeatures();
        const taskId = await taskListFeature.addTask(description, priority || 'medium');
        return { success: true, data: taskId };
    } catch (error) {
        console.error('Failed to add task:', error);
        return { success: false, error: error.message };
    }
});

// Search Handlers
ipcMain.handle('search', async (event, query, options) => {
    try {
        initializeFeatures();
        const results = await searchFeature.search(query, options || {});
        return { success: true, data: results };
    } catch (error) {
        console.error('Search failed:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('natural-language-search', async (event, query) => {
    try {
        initializeFeatures();
        const results = await searchFeature.naturalLanguageSearch(query);
        return { success: true, data: results };
    } catch (error) {
        console.error('Natural language search failed:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('search-by-app', async (event, appName, limit) => {
    try {
        initializeFeatures();
        const results = await searchFeature.searchByApp(appName, limit || 50);
        return { success: true, data: results };
    } catch (error) {
        console.error('Search by app failed:', error);
        return { success: false, error: error.message };
    }
});

// Email Digest Handlers
ipcMain.handle('get-email-digest', async (event, date) => {
    try {
        initializeFeatures();
        const result = await emailDigestFeature.getEmailDigest(date ? new Date(date) : null);
        return { success: true, data: result };
    } catch (error) {
        console.error('Failed to get email digest:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-emails-needing-reply', async (event, date) => {
    try {
        initializeFeatures();
        const result = await emailDigestFeature.getEmailsNeedingReply(date ? new Date(date) : null);
        return { success: true, data: result };
    } catch (error) {
        console.error('Failed to get emails needing reply:', error);
        return { success: false, error: error.message };
    }
});

// Monitoring Stats Handler
ipcMain.handle('get-monitoring-stats', async () => {
    try {
        if (!monitoringService || !monitoringService.db) {
            return { success: false, error: 'Monitoring not initialized' };
        }
        const stats = monitoringService.db.getStats();
        return { success: true, data: stats };
    } catch (error) {
        console.error('Failed to get monitoring stats:', error);
        return { success: false, error: error.message };
    }
});

// Permissions Handlers
ipcMain.handle('check-permissions', async () => {
    try {
        const permissionsManager = new PermissionsManager();
        const screenPermission = await permissionsManager.checkScreenRecordingPermission();
        const accessibilityPermission = await permissionsManager.checkAccessibilityPermission();
        return {
            success: true,
            data: {
                screenRecording: screenPermission,
                accessibility: accessibilityPermission
            }
        };
    } catch (error) {
        console.error('Failed to check permissions:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.on('request-screen-recording-permission', () => {
    const permissionsManager = new PermissionsManager();
    permissionsManager.requestScreenRecordingPermission();
});

ipcMain.on('open-permission-settings', (event, type) => {
    const permissionsManager = new PermissionsManager();
    if (type === 'screen-recording') {
        permissionsManager.openScreenRecordingSettings();
    } else if (type === 'accessibility') {
        permissionsManager.openAccessibilitySettings();
    }
});

// Ollama Check Handler
ipcMain.handle('is-ollama-installed', async () => {
    try {
        const installed = await isOllamaInstalled();
        return { success: true, data: installed };
    } catch (error) {
        return { success: false, data: false };
    }
});

// Monitoring Control Handlers
ipcMain.on('pause-monitoring', () => {
    if (monitoringService) {
        monitoringService.stop();
        mainWindow.webContents.send('monitoring-status', 'paused');
    }
});

ipcMain.on('resume-monitoring', () => {
    if (monitoringService) {
        monitoringService.start();
        mainWindow.webContents.send('monitoring-status', 'active');
    }
});

ipcMain.on('set-capture-interval', (event, intervalMs) => {
    if (monitoringService) {
        monitoringService.minCaptureIntervalMs = intervalMs;
    }
});

ipcMain.on('add-excluded-app', (event, appName) => {
    if (monitoringService) {
        monitoringService.excludedApps.add(appName);
        if (monitoringService.db) {
            const excluded = Array.from(monitoringService.excludedApps).join(',');
            monitoringService.db.setSetting('excludedApps', excluded);
        }
    }
});

ipcMain.on('remove-excluded-app', (event, appName) => {
    if (monitoringService) {
        monitoringService.excludedApps.delete(appName);
        if (monitoringService.db) {
            const excluded = Array.from(monitoringService.excludedApps).join(',');
            monitoringService.db.setSetting('excludedApps', excluded);
        }
    }
});

// ============= ENHANCED AGENT IPC HANDLERS =============

// Floating Panel Control
ipcMain.on('show-floating-panel', () => {
    showFloatingPanel();
});

ipcMain.on('hide-floating-panel', () => {
    if (floatingPanel) {
        floatingPanel.hide();
    }
});

ipcMain.on('minimize-floating-panel', () => {
    if (floatingPanel) {
        floatingPanel.minimize();
    }
});

// Panel ping to keep connection alive
ipcMain.on('panel-ping', () => {
    // Just acknowledge the panel is alive
});

ipcMain.on('open-chat-with-result', (event, result) => {
    if (mainWindow) {
        // Send result to chat
        mainWindow.webContents.send('analysis-result', result);
        
        // ONLY show/focus if user isn't actively working elsewhere 
        // This prevents the 'forces open' feeling if they are in another app
        // But for now, let's keep it simple: just send the data.
        
        console.log('[MAIN] Result sent to chat. Window state handled by user.');
        
        // Hide floating panel
        if (floatingPanel) {
            floatingPanel.hide();
        }
    }
});

ipcMain.on('minimize-window', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.on('maximize-window', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window-maximized-changed', (event, isMaximized) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('maximized-state-changed', isMaximized);
    }
});

ipcMain.on('close-window', () => {
    if (mainWindow) {
        mainWindow.close();
    }
});

ipcMain.on('toggle-floating-panel', () => {
    if (floatingPanel) {
        if (floatingPanel.isVisible()) {
            floatingPanel.hide();
        } else {
            floatingPanel.show();
            floatingPanel.focus();
        }
    } else {
        createFloatingPanel();
    }
});

// Context Detection
ipcMain.handle('detect-context', async () => {
    try {
        if (!contextDetector) {
            contextDetector = new ContextDetector(mainWindow);
        }
        const context = await contextDetector.detect();
        return { success: true, data: context };
    } catch (error) {
        console.error('Context detection failed:', error);
        return { success: false, error: error.message };
    }
});

// Task Planning
ipcMain.handle('create-plan', async (event, { intent, context }) => {
    try {
        if (!taskPlanner) {
            taskPlanner = new TaskPlanner();
        }
        const safeContext = context || {};
        const plan = await taskPlanner.createPlan(intent, safeContext);
        return { success: true, data: plan };
    } catch (error) {
        console.error('Plan creation failed:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('edit-plan', async (event, { plan, edits }) => {
    try {
        if (!taskPlanner) {
            taskPlanner = new TaskPlanner();
        }
        const modifiedPlan = taskPlanner.editPlan(plan, edits);
        return { success: true, data: modifiedPlan };
    } catch (error) {
        console.error('Plan editing failed:', error);
        return { success: false, error: error.message };
    }
});

// Plan Execution
ipcMain.handle('execute-plan', async (event, { plan, context }) => {
    try {
        if (!actionExecutor) {
            actionExecutor = new ActionExecutor(mainWindow);
        }

        console.log(`[MAIN] Executing plan with ${plan.steps.length} steps:`, plan.steps.map(s => s.action));
        
        const results = [];
        
        for (const step of plan.steps) {
            try {
                const result = await actionExecutor.executeStep(step, context, results);
                results.push(result);
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    failedAt: step.id,
                    results
                };
            }
        }

        const finalResult = results[results.length - 1];
        const finalSummary = finalResult?.summaryText || finalResult?.summary || 'Task completed';
        
        return {
            success: true,
            results,
            summary: finalSummary
        };

    } catch (error) {
        console.error('Plan execution failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

// Workflow Learning (placeholder for now)
ipcMain.handle('detect-workflow', async (event, { intent, context }) => {
    try {
        // TODO: Implement workflow detection
        // For now, return no workflow found
        return {
            success: true,
            data: { found: false }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-workflow', async (event, { name, intent, plan, context }) => {
    try {
        // TODO: Implement workflow saving
        console.log('[MAIN] Workflow saved:', name);
        return { success: true, data: { id: Date.now(), name } };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

app.whenReady().then(() => {
    // Initialize features on app ready
    initializeFeatures();
});
