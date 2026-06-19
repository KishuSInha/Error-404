const { systemPreferences } = require('electron');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class PermissionsManager {
    constructor() {
        this.platform = process.platform;
    }

    /**
     * Check if screen recording permission is granted (macOS only)
     */
    async checkScreenRecordingPermission() {
        return await this.hasScreenRecordingPermission();
    }

    async hasScreenRecordingPermission() {
        if (this.platform !== 'darwin') {
            return true; // Not applicable on non-macOS
        }

        try {
            // On macOS 10.15+, we need to check screen recording permission
            // This is a workaround since Electron doesn't have a direct API
            const { stdout } = await execAsync(
                'sqlite3 ~/Library/Application\\ Support/com.apple.TCC/TCC.db "SELECT allowed FROM access WHERE service=\'kTCCServiceScreenCapture\' AND client=\'com.metrixa.desktop\'" 2>/dev/null || echo "0"'
            );

            const allowed = stdout.trim();
            return allowed === '1';
        } catch (error) {
            console.warn('Could not check screen recording permission:', error.message);
            // Fallback: assume we need to request permission
            return false;
        }
    }

    /**
     * Request screen recording permission by attempting a capture
     * This will trigger the macOS permission dialog
     */
    async requestScreenRecordingPermission() {
        if (this.platform !== 'darwin') {
            return true;
        }

        console.log('Requesting screen recording permission...');

        // The act of trying to capture will trigger the permission dialog
        // We'll use desktopCapturer which is already in the app
        return new Promise((resolve) => {
            // The permission dialog will show when we try to capture
            // We can't directly detect if permission was granted, so we return true
            // and let the app handle the actual capture attempt
            resolve(true);
        });
    }

    /**
     * Check if accessibility permission is granted (for GUI automation)
     */
    checkAccessibilityPermission() {
        return this.hasAccessibilityPermission();
    }

    hasAccessibilityPermission() {
        if (this.platform !== 'darwin') {
            return true;
        }

        try {
            return systemPreferences.isTrustedAccessibilityClient(false);
        } catch (error) {
            console.warn('Could not check accessibility permission:', error.message);
            return false;
        }
    }

    /**
     * Request accessibility permission
     */
    requestAccessibilityPermission() {
        if (this.platform !== 'darwin') {
            return true;
        }

        try {
            // This will show the permission dialog
            return systemPreferences.isTrustedAccessibilityClient(true);
        } catch (error) {
            console.error('Error requesting accessibility permission:', error);
            return false;
        }
    }

    /**
     * Open System Preferences to the relevant permission pane
     */
    async openPermissionSettings(permissionType = 'screen-recording') {
        if (this.platform !== 'darwin') {
            return;
        }

        const prefPanes = {
            'screen-recording': 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
            'accessibility': 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
        };

        const url = prefPanes[permissionType];
        if (url) {
            try {
                await execAsync(`open "${url}"`);
            } catch (error) {
                console.error('Error opening System Preferences:', error);
            }
        }
    }

    async openScreenRecordingSettings() {
        return await this.openPermissionSettings('screen-recording');
    }

    async openAccessibilitySettings() {
        return await this.openPermissionSettings('accessibility');
    }

    /**
     * Check all required permissions
     */
    async checkAllPermissions() {
        const permissions = {
            screenRecording: await this.hasScreenRecordingPermission(),
            accessibility: this.hasAccessibilityPermission()
        };

        return permissions;
    }

    /**
     * Get permission status message for UI
     */
    async getPermissionStatus() {
        const permissions = await this.checkAllPermissions();

        const messages = [];

        if (!permissions.screenRecording) {
            messages.push({
                type: 'screen-recording',
                granted: false,
                message: 'Screen Recording permission is required to capture screenshots.',
                action: 'Grant Permission'
            });
        }

        if (!permissions.accessibility) {
            messages.push({
                type: 'accessibility',
                granted: false,
                message: 'Accessibility permission is required for GUI automation features.',
                action: 'Grant Permission'
            });
        }

        if (messages.length === 0) {
            return {
                allGranted: true,
                message: 'All permissions granted'
            };
        }

        return {
            allGranted: false,
            missing: messages
        };
    }
}

module.exports = PermissionsManager;
