const { app, BrowserWindow, globalShortcut, ipcMain, screen, desktopCapturer } = require('electron');
const path = require('path');
const Store = require('electron-store');
const screenshot = require('screenshot-desktop');

const store = new Store();
let mainWindow = null;
let isCapturing = false;

// Create the main floating window
function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        x: width - 420,
        y: 80,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadFile('index.html');

    // Hide window initially
    mainWindow.hide();

    // Prevent window from being minimized
    mainWindow.on('minimize', (event) => {
        event.preventDefault();
        mainWindow.hide();
    });
}

// Register global shortcut (⌘+K or Ctrl+K)
function registerShortcuts() {
    const shortcut = process.platform === 'darwin' ? 'Command+K' : 'Control+K';

    const registered = globalShortcut.register(shortcut, () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });

    if (!registered) {
        console.error('Shortcut registration failed');
    }
}

// Screen capture function
async function captureScreen() {
    try {
        const imgBuffer = await screenshot({ format: 'png' });
        const base64Image = imgBuffer.toString('base64');
        return base64Image;
    } catch (error) {
        console.error('Screen capture error:', error);
        return null;
    }
}

// Start continuous screen monitoring
function startScreenMonitoring() {
    if (isCapturing) return;

    isCapturing = true;

    // Capture every 3 seconds
    const captureInterval = setInterval(async () => {
        if (!isCapturing) {
            clearInterval(captureInterval);
            return;
        }

        const screenshot = await captureScreen();
        if (screenshot && mainWindow) {
            mainWindow.webContents.send('screen-captured', screenshot);
        }
    }, 3000);
}

// Stop screen monitoring
function stopScreenMonitoring() {
    isCapturing = false;
}

// IPC Handlers
ipcMain.on('start-monitoring', () => {
    startScreenMonitoring();
});

ipcMain.on('stop-monitoring', () => {
    stopScreenMonitoring();
});

ipcMain.on('analyze-screen', async (event, base64Image) => {
    // This will be handled by the renderer process with OpenAI API
    // We just relay the message
    event.reply('analysis-ready');
});

ipcMain.on('get-settings', (event) => {
    const settings = {
        apiKey: store.get('openai_api_key', ''),
        captureInterval: store.get('capture_interval', 3000),
        autoStart: store.get('auto_start', false),
    };
    event.reply('settings-loaded', settings);
});

ipcMain.on('save-settings', (event, settings) => {
    store.set('openai_api_key', settings.apiKey);
    store.set('capture_interval', settings.captureInterval);
    store.set('auto_start', settings.autoStart);
    event.reply('settings-saved');
});

// App lifecycle
app.whenReady().then(() => {
    createWindow();
    registerShortcuts();

    // Auto-start monitoring if enabled
    if (store.get('auto_start', false)) {
        startScreenMonitoring();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    stopScreenMonitoring();
});

// Handle app quit
app.on('before-quit', () => {
    stopScreenMonitoring();
});
