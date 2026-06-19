const { desktopCapturer, screen, powerMonitor } = require('electron');
const activeWin = require('active-win');
const path = require('path');
const fs = require('fs');
const MetrixaDatabase = require('../storage/database');
const { getScreenText } = require('../context/screen');
const TextCleaner = require('../utils/text-cleaner');

/**
 * SmartMonitor
 * 
 * Replaces simple interval monitoring with intelligence:
 * 1. Polls active window frequently (1s)
 * 2. only captures when window is STABLE for > 1.5s
 * 3. Skips capture if user is typing/scrolling rapidly (implied by title changes)
 * 4. Ignores "Metrixa AI" window
 */
class SmartMonitor {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.isMonitoring = false;

        // Polling (checking state)
        this.pollInterval = null;
        this.pollRateMs = 1000; // Check active window every 1s

        // Stability Logic
        this.lastActiveWindow = null;
        this.stableStartTime = 0;
        this.hasCapturedCurrentState = false;
        this.stabilityThresholdMs = 1500; // Must be stable for 1.5s

        // Capture Logic
        this.lastCaptureTime = 0;
        this.minCaptureIntervalMs = 5000; // MAX 1 capture per 5s

        // Data
        this.db = null;
        this.currentSessionId = null;
        this.excludedApps = new Set(['Metrixa AI', 'Electron', 'loginwindow']);

        // Listeners included in init
        this.onBattery = false;
    }

    async initialize() {
        try {
            this.db = new MetrixaDatabase();

            // Load excluded apps
            const excludedStr = this.db.getSetting('excludedApps', '');
            if (excludedStr) {
                excludedStr.split(',').forEach(app => this.excludedApps.add(app.trim()));
            }

            // Battery monitoring
            if (powerMonitor) {
                this.onBattery = powerMonitor.isOnBatteryPower();
                powerMonitor.on('on-battery', () => this.setBatteryMode(true));
                powerMonitor.on('on-ac', () => this.setBatteryMode(false));
            }

            console.log('✓ SmartMonitor initialized');
            return true;
        } catch (error) {
            console.error('Failed to init SmartMonitor:', error);
            return false;
        }
    }

    setBatteryMode(isOnBattery) {
        this.onBattery = isOnBattery;
        // On battery: Poll slower, require longer stability
        this.pollRateMs = isOnBattery ? 2000 : 1000;
        this.stabilityThresholdMs = isOnBattery ? 3000 : 1500;
        console.log(`Power mode changed. Battery: ${isOnBattery}`);

        if (this.isMonitoring) this.restartPolling();
    }

    start() {
        if (this.isMonitoring) return;

        if (!this.db) this.initialize();

        this.isMonitoring = true;
        this.startSession('startup');
        this.restartPolling();

        console.log('Smart Monitoring started.');
        this.notifyUI('monitoring-started', { mode: 'smart' });
    }

    stop() {
        this.isMonitoring = false;
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.endSession();
        this.notifyUI('monitoring-stopped');
    }

    restartPolling() {
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = setInterval(() => this.pollActivity(), this.pollRateMs);
    }

    /**
     * Core Loop: Checks active window. If stable -> Capture.
     */
    async pollActivity() {
        if (!this.isMonitoring) return;

        try {
            const currentWindow = await activeWin();

            if (!currentWindow) return;
            if (this.excludedApps.has(currentWindow.owner.name)) return;
            if (currentWindow.owner.name === 'Metrixa AI') return;

            // Check if context has changed
            const isSameContext = this.isSameWindow(this.lastActiveWindow, currentWindow);

            if (!isSameContext) {
                // Context changed! Reset stability timer
                this.lastActiveWindow = currentWindow;
                this.stableStartTime = Date.now();
                this.hasCapturedCurrentState = false;

                // Handle session switching
                if (this.lastActiveWindow && currentWindow.owner.name !== this.lastActiveWindow.owner.name) {
                    this.switchSession(currentWindow.owner.name);
                }

                // console.log(`Context changed to: ${currentWindow.owner.name} - ${currentWindow.title}`);
                return;
            }

            // Context is same. Is it stable enough?
            const stabilityDuration = Date.now() - this.stableStartTime;

            if (stabilityDuration >= this.stabilityThresholdMs && !this.hasCapturedCurrentState) {
                // Check if we captured too recently
                if (Date.now() - this.lastCaptureTime < this.minCaptureIntervalMs) {
                    return;
                }

                // TRIGGER CAPTURE
                console.log(`Stable for ${stabilityDuration}ms. Capturing: ${currentWindow.title}`);
                await this.captureAndProcess(currentWindow);
                this.hasCapturedCurrentState = true;
                this.lastCaptureTime = Date.now();
            }

        } catch (error) {
            console.error('Polling error:', error);
        }
    }

    isSameWindow(w1, w2) {
        if (!w1 || !w2) return false;
        return w1.owner.name === w2.owner.name && w1.title === w2.title;
    }

    /**
     * Capture, Save, OCR, and Index
     */
    async captureAndProcess(windowInfo) {
        try {
            // 1. Capture screen
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: screen.getPrimaryDisplay().size
            });

            if (!sources.length) return;

            const buffer = sources[0].thumbnail.toPNG();

            // 2. Save file
            const filename = `smart_${Date.now()}.png`;
            const userDataPath = require('electron').app.getPath('userData');
            const screenshotsDir = path.join(userDataPath, 'screenshots');
            if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

            const filepath = path.join(screenshotsDir, filename);
            fs.writeFileSync(filepath, buffer);

            // 3. Save to DB
            const screenshotId = this.db.insertScreenshot(
                Math.floor(Date.now() / 1000),
                windowInfo.owner.name,
                windowInfo.title,
                filepath
            );

            // 4. Link session
            if (this.currentSessionId) {
                this.db.linkScreenshotToSession(this.currentSessionId, screenshotId);
            }

            this.notifyUI('capture-complete', {
                app: windowInfo.owner.name,
                title: windowInfo.title,
                screenshotId
            });

            // 5. OCR Process
            this.processOCR(screenshotId, buffer);

        } catch (e) {
            console.error('Capture failed:', e);
        }
    }

    async processOCR(screenshotId, buffer) {
        try {
            // Pipe into TextCleaner
            const result = await getScreenText(this.mainWindow);

            if (result && result.text) {
                const cleanedText = TextCleaner.clean(result.text);

                // Insert CLEANED text
                this.db.insertExtractedText(
                    screenshotId,
                    cleanedText,
                    result.confidence || 0.8
                );
                console.log(`OCR saved for ${screenshotId} (Raw: ${result.text.length}, Clean: ${cleanedText.length})`);
            }
        } catch (e) {
            console.log('OCR Background Error:', e);
        }
    }

    startSession(appName) {
        this.endSession();
        const type = this.detectContextType(appName);
        this.currentSessionId = this.db.createSession(
            Math.floor(Date.now() / 1000),
            type
        );
    }

    switchSession(appName) {
        this.db.updateSession(
            this.currentSessionId,
            Math.floor(Date.now() / 1000),
            'Switched App'
        );
        this.startSession(appName);
    }

    endSession() {
        if (this.currentSessionId) {
            this.db.updateSession(
                this.currentSessionId,
                Math.floor(Date.now() / 1000),
                'Monitoring Stopped'
            );
            this.currentSessionId = null;
        }
    }

    detectContextType(appName) {
        const lower = (appName || '').toLowerCase();
        if (lower.match(/code|terminal|iterm/)) return 'development';
        if (lower.match(/mail|slack|discord|teams/)) return 'communication';
        if (lower.match(/chrome|safari|firefox|edge/)) return 'browser';
        return 'general';
    }

    notifyUI(event, data) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('monitoring-event', { event, data });
        }
    }
}

module.exports = SmartMonitor;
