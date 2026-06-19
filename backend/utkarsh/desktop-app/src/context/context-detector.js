const activeWin = require('active-win');
const { getScreenText } = require('./screen');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ContextDetector {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
    }

    /**
     * Detect comprehensive context
     */
    async detect() {
        try {
            const [app, selection, screenText] = await Promise.all([
                this.getActiveApp(),
                this.getSelectedText().catch(err => null), // Don't fail if selection fails
                this.getScreenText().catch(err => ({ text: '', confidence: 0 })) // Don't fail if OCR fails
            ]);

            // Ensure app has required fields
            const safeApp = app || { name: 'Unknown', bundleId: null, window: { title: 'Unknown', id: null } };
            const appType = this.detectAppType(safeApp.name);

            return {
                app: {
                    name: safeApp.name || 'Unknown',
                    bundleId: safeApp.bundleId || null
                },
                window: safeApp.window || { title: 'Unknown', id: null },
                appType,
                selection,
                visibleText: screenText?.text || '',
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Context detection failed:', error);
            return {
                app: { name: 'Unknown', bundleId: null },
                window: { title: 'Unknown', id: null },
                appType: 'general',
                selection: null,
                visibleText: '',
                timestamp: Date.now()
            };
        }
    }

    /**
     * Get active application info
     */
    async getActiveApp() {
        try {
            const window = await activeWin();
            
            if (!window) {
                throw new Error('No active window found');
            }

            return {
                name: window.owner.name,
                bundleId: window.owner.bundleId,
                window: {
                    title: window.title,
                    id: window.id
                }
            };
        } catch (error) {
            // Silently return unknown context - permission not granted
            return {
                name: 'Unknown',
                bundleId: null,
                window: { title: 'Unknown', id: null }
            };
        }
    }

    /**
     * Get selected text (macOS specific)
     */
    async getSelectedText() {
        try {
            // Save current clipboard
            const { stdout: oldClipboard } = await execAsync('pbpaste').catch(() => ({ stdout: '' }));

            // Try to copy selection to clipboard
            await execAsync(`osascript -e 'tell application "System Events" to keystroke "c" using command down'`).catch(() => {});
            
            // Wait a bit for clipboard to update
            await this.sleep(100);

            // Get clipboard content
            const { stdout: newClipboard } = await execAsync('pbpaste').catch(() => ({ stdout: '' }));

            // Restore old clipboard if it changed
            if (oldClipboard && oldClipboard !== newClipboard) {
                const escaped = oldClipboard.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
                await execAsync(`printf "%s" "${escaped}" | pbcopy`).catch(() => {});
            }

            // Return selection if it's different and not empty
            if (newClipboard && newClipboard !== oldClipboard && newClipboard.trim().length > 0) {
                return newClipboard;
            }

            return null;
        } catch (error) {
            console.error('Failed to get selected text:', error);
            return null;
        }
    }

    /**
     * Get screen text via OCR
     */
    async getScreenText(region = null) {
        try {
            if (region) {
                return await this.getScreenTextInRegion(region);
            }
            
            console.log('[CONTEXT] Getting fresh screen text...');
            const result = await getScreenText(this.mainWindow);
            console.log(`[CONTEXT] Got screen text: ${result.text?.length || 0} chars`);
            return result;
        } catch (error) {
            console.error('Failed to get screen text:', error);
            return { text: '', confidence: 0 };
        }
    }

    /**
     * Get text from specific screen region
     */
    async getScreenTextInRegion(region) {
        // TODO: Implement region-specific OCR
        // For now, just return full screen text
        return await getScreenText(this.mainWindow);
    }

    /**
     * Detect application type for smart context
     */
    detectAppType(appName) {
        const lower = (appName || '').toLowerCase();

        const types = {
            'mail': 'email',
            'gmail': 'email',
            'outlook': 'email',
            'spark': 'email',
            'chrome': 'browser',
            'safari': 'browser',
            'firefox': 'browser',
            'edge': 'browser',
            'excel': 'spreadsheet',
            'numbers': 'spreadsheet',
            'sheets': 'spreadsheet',
            'vscode': 'code',
            'code': 'code',
            'xcode': 'code',
            'terminal': 'terminal',
            'iterm': 'terminal',
            'slack': 'communication',
            'discord': 'communication',
            'teams': 'communication',
            'zoom': 'communication',
            'notes': 'notes',
            'notion': 'notes',
            'bear': 'notes',
            'word': 'document',
            'pages': 'document',
            'docs': 'document',
            'keynote': 'presentation',
            'powerpoint': 'presentation'
        };

        for (const [key, type] of Object.entries(types)) {
            if (lower.includes(key)) {
                return type;
            }
        }

        return 'general';
    }

    /**
     * Ask user to select context mode
     */
    async askContextMode() {
        // Return options for user to choose
        return {
            options: [
                { id: 'current_window', label: 'Current Window', description: 'Analyze active window' },
                { id: 'select_region', label: 'Select Region', description: 'Draw a rectangle on screen' },
                { id: 'full_screen', label: 'Full Screen', description: 'Analyze entire screen' },
                { id: 'selected_text', label: 'Selected Text', description: 'Use highlighted text only' }
            ]
        };
    }

    /**
     * Detect if user is viewing email
     */
    isEmailContext(context) {
        if (context.appType === 'email') return true;
        
        const emailKeywords = ['inbox', 'mail', 'gmail', 'compose', 'reply', 'from:', 'to:', 'subject:'];
        const text = (context.visibleText || '').toLowerCase();
        
        return emailKeywords.some(keyword => text.includes(keyword));
    }

    /**
     * Detect if user is viewing spreadsheet
     */
    isSpreadsheetContext(context) {
        return context.appType === 'spreadsheet';
    }

    /**
     * Extract email metadata from context
     */
    extractEmailMetadata(context) {
        if (!this.isEmailContext(context)) return null;

        const text = context.visibleText || '';
        
        const metadata = {
            from: null,
            to: null,
            subject: null,
            hasAttachments: false
        };

        // Extract From
        const fromMatch = text.match(/from:\s*([^\n]+)/i);
        if (fromMatch) {
            metadata.from = fromMatch[1].trim();
        }

        // Extract To
        const toMatch = text.match(/to:\s*([^\n]+)/i);
        if (toMatch) {
            metadata.to = toMatch[1].trim();
        }

        // Extract Subject
        const subjectMatch = text.match(/subject:\s*([^\n]+)/i);
        if (subjectMatch) {
            metadata.subject = subjectMatch[1].trim();
        }

        // Check for attachments
        metadata.hasAttachments = /attachment|attached|\.pdf|\.docx|\.xlsx/i.test(text);

        return metadata;
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ContextDetector;
