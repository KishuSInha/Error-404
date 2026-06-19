const { desktopCapturer, screen, powerMonitor } = require('electron');
const activeWin = require('active-win');
const path = require('path');
const fs = require('fs');
const MetrixaDatabase = require('../storage/database');
const { getScreenText } = require('../context/screen');

class MonitoringService {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.captureIntervalMs = 10000; // Default 10 seconds
        this.db = null;
        this.currentSessionId = null;
        this.lastAppName = null;
        this.lastCaptureTime = 0;
        this.excludedApps = new Set();
        this.isPaused = false;
        this.onBattery = false;

        // Initialize battery monitoring
        this.initBatteryMonitoring();
    }

    initBatteryMonitoring() {
        if (powerMonitor.isOnBatteryPower) {
            this.onBattery = powerMonitor.isOnBatteryPower();
        }

        powerMonitor.on('on-battery', () => {
            console.log('Switched to battery power - reducing capture frequency');
            this.onBattery = true;
            this.adjustCaptureInterval();
        });

        powerMonitor.on('on-ac', () => {
            console.log('Switched to AC power - restoring capture frequency');
            this.onBattery = false;
            this.adjustCaptureInterval();
        });
    }

    adjustCaptureInterval() {
        // Double the interval when on battery to save power
        const baseInterval = this.db ?
            parseInt(this.db.getSetting('captureInterval', '10000')) : 10000;

        this.captureIntervalMs = this.onBattery ? baseInterval * 2 : baseInterval;

        // Restart monitoring with new interval if currently running
        if (this.isMonitoring) {
            this.stop();
            this.start();
        }
    }

    async initialize() {
        try {
            this.db = new MetrixaDatabase();
            console.log('✓ Monitoring service initialized');

            // Load excluded apps from settings
            const excludedAppsStr = this.db.getSetting('excludedApps', '');
            if (excludedAppsStr) {
                this.excludedApps = new Set(excludedAppsStr.split(','));
            }

            // Load capture interval from settings
            this.captureIntervalMs = parseInt(
                this.db.getSetting('captureInterval', '10000')
            );

            return true;
        } catch (error) {
            console.error('Failed to initialize monitoring service:', error);
            return false;
        }
    }

    async start() {
        if (this.isMonitoring) {
            console.log('Monitoring already active');
            return;
        }

        if (!this.db) {
            await this.initialize();
        }

        console.log(`Starting monitoring with ${this.captureIntervalMs}ms interval...`);
        this.isMonitoring = true;
        this.isPaused = false;

        // Create initial session
        this.currentSessionId = this.db.createSession(
            Math.floor(Date.now() / 1000),
            'general'
        );

        // Start the monitoring loop
        this.monitoringInterval = setInterval(() => {
            this.captureAndProcess();
        }, this.captureIntervalMs);

        // Do first capture immediately
        this.captureAndProcess();

        this.notifyUI('monitoring-started', { interval: this.captureIntervalMs });
    }

    stop() {
        if (!this.isMonitoring) {
            return;
        }

        console.log('Stopping monitoring...');
        this.isMonitoring = false;

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        // Close current session
        if (this.currentSessionId) {
            this.db.updateSession(
                this.currentSessionId,
                Math.floor(Date.now() / 1000),
                'Session ended'
            );
            this.currentSessionId = null;
        }

        this.notifyUI('monitoring-stopped');
    }

    pause() {
        this.isPaused = true;
        console.log('Monitoring paused');
        this.notifyUI('monitoring-paused');
    }

    resume() {
        this.isPaused = false;
        console.log('Monitoring resumed');
        this.notifyUI('monitoring-resumed');
    }

    async captureAndProcess() {
        if (this.isPaused) {
            return;
        }

        try {
            // Get active window info
            const activeWindow = await this.getActiveWindow();

            if (!activeWindow) {
                console.log('No active window detected');
                return;
            }

            // Check if app is excluded
            if (this.excludedApps.has(activeWindow.owner.name)) {
                console.log(`Skipping excluded app: ${activeWindow.owner.name}`);
                return;
            }

            // Detect context switch (new app or significant time gap)
            const now = Date.now();
            const timeSinceLastCapture = now - this.lastCaptureTime;
            const isContextSwitch = activeWindow.owner.name !== this.lastAppName ||
                timeSinceLastCapture > 300000; // 5 minutes

            if (isContextSwitch && this.currentSessionId) {
                // End current session and start new one
                this.db.updateSession(
                    this.currentSessionId,
                    Math.floor(now / 1000),
                    `Session with ${this.lastAppName}`
                );

                this.currentSessionId = this.db.createSession(
                    Math.floor(now / 1000),
                    this.detectContextType(activeWindow.owner.name)
                );
            }

            // Capture screenshot
            const screenshotData = await this.captureScreenshot();

            if (!screenshotData) {
                return;
            }

            // Save screenshot metadata
            const screenshotId = this.db.insertScreenshot(
                Math.floor(now / 1000),
                activeWindow.owner.name,
                activeWindow.title,
                screenshotData.path
            );

            // Link to current session
            if (this.currentSessionId) {
                this.db.linkScreenshotToSession(this.currentSessionId, screenshotId);
            }

            // Perform OCR in background (don't await to avoid blocking)
            this.performOCR(screenshotId, screenshotData.buffer)
                .catch(err => console.error('OCR failed:', err));

            // Update tracking variables
            this.lastAppName = activeWindow.owner.name;
            this.lastCaptureTime = now;

            this.notifyUI('capture-complete', {
                app: activeWindow.owner.name,
                title: activeWindow.title,
                screenshotId
            });

        } catch (error) {
            console.error('Capture and process error:', error);
        }
    }

    async getActiveWindow() {
        try {
            return await activeWin();
        } catch (error) {
            console.error('Failed to get active window:', error);
            return null;
        }
    }

    async captureScreenshot() {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: screen.getPrimaryDisplay().size
            });

            if (sources.length === 0) {
                throw new Error('No screen sources found');
            }

            const buffer = sources[0].thumbnail.toPNG();

            // Save to disk
            const userDataPath = require('electron').app.getPath('userData');
            const screenshotsDir = path.join(userDataPath, 'screenshots');

            if (!fs.existsSync(screenshotsDir)) {
                fs.mkdirSync(screenshotsDir, { recursive: true });
            }

            const filename = `screenshot_${Date.now()}.png`;
            const filepath = path.join(screenshotsDir, filename);

            fs.writeFileSync(filepath, buffer);

            return {
                buffer,
                path: filepath
            };
        } catch (error) {
            console.error('Screenshot capture failed:', error);
            return null;
        }
    }

    async performOCR(screenshotId, buffer) {
        try {
            // Use existing OCR function
            const result = await getScreenText(this.mainWindow);

            if (result && result.text) {
                this.db.insertExtractedText(
                    screenshotId,
                    result.text,
                    result.confidence || 0.8
                );

                console.log(`OCR complete for screenshot ${screenshotId}`);
            }
        } catch (error) {
            console.error('OCR error:', error);
        }
    }

    detectContextType(appName) {
        const appLower = appName.toLowerCase();

        // Email apps
        if (appLower.includes('mail') || appLower.includes('outlook') ||
            appLower.includes('gmail')) {
            return 'email';
        }

        // Browsers
        if (appLower.includes('safari') || appLower.includes('chrome') ||
            appLower.includes('firefox') || appLower.includes('edge')) {
            return 'browser';
        }

        // Communication
        if (appLower.includes('slack') || appLower.includes('discord') ||
            appLower.includes('messages') || appLower.includes('zoom') ||
            appLower.includes('teams')) {
            return 'communication';
        }

        // Development
        if (appLower.includes('code') || appLower.includes('terminal') ||
            appLower.includes('iterm')) {
            return 'development';
        }

        // Documents
        if (appLower.includes('word') || appLower.includes('pages') ||
            appLower.includes('docs') || appLower.includes('notion')) {
            return 'document';
        }

        return 'general';
    }

    addExcludedApp(appName) {
        this.excludedApps.add(appName);
        this.db.setSetting('excludedApps', Array.from(this.excludedApps).join(','));
        console.log(`Added ${appName} to excluded apps`);
    }

    removeExcludedApp(appName) {
        this.excludedApps.delete(appName);
        this.db.setSetting('excludedApps', Array.from(this.excludedApps).join(','));
        console.log(`Removed ${appName} from excluded apps`);
    }

    setCaptureInterval(intervalMs) {
        this.captureIntervalMs = intervalMs;
        this.db.setSetting('captureInterval', intervalMs.toString());

        // Restart monitoring with new interval
        if (this.isMonitoring) {
            this.stop();
            this.start();
        }
    }

    getStats() {
        return this.db ? this.db.getStats() : null;
    }

    notifyUI(event, data = {}) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('monitoring-event', {
                event,
                data,
                timestamp: Date.now()
            });
        }
    }

    cleanup() {
        this.stop();
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = MonitoringService;
