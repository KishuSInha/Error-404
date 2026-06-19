const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class MetrixaDatabase {
    constructor() {
        try {
            const userDataPath = app.getPath('userData');
            const dbPath = path.join(userDataPath, 'metrixa.db');

            // Ensure directory exists
            if (!fs.existsSync(userDataPath)) {
                fs.mkdirSync(userDataPath, { recursive: true });
            }

            console.log(`Initializing database at: ${dbPath}`);
            this.db = new Database(dbPath);
            this.db.pragma('journal_mode = WAL');
            this.initSchema();
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw new Error(`Database initialization failed: ${error.message}`);
        }
    }

    initSchema() {
        try {
            // Screenshots metadata table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS screenshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp INTEGER NOT NULL,
                    app_name TEXT,
                    window_title TEXT,
                    file_path TEXT,
                    created_at INTEGER DEFAULT (strftime('%s', 'now'))
                );
            `);

            // Extracted text table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS extracted_text (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    screenshot_id INTEGER,
                    text TEXT,
                    confidence REAL,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    FOREIGN KEY (screenshot_id) REFERENCES screenshots(id) ON DELETE CASCADE
                );
            `);

            // Sessions table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    start_time INTEGER NOT NULL,
                    end_time INTEGER,
                    context_type TEXT,
                    summary TEXT,
                    created_at INTEGER DEFAULT (strftime('%s', 'now'))
                );
            `);

            // Session screenshots mapping
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS session_screenshots (
                    session_id INTEGER,
                    screenshot_id INTEGER,
                    PRIMARY KEY (session_id, screenshot_id),
                    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                    FOREIGN KEY (screenshot_id) REFERENCES screenshots(id) ON DELETE CASCADE
                );
            `);

            // Tasks table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    description TEXT NOT NULL,
                    source TEXT,
                    priority TEXT DEFAULT 'medium',
                    status TEXT DEFAULT 'pending',
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    completed_at INTEGER
                );
            `);

            // Settings table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
            `);

            // Create indexes for performance
            this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_screenshots_timestamp ON screenshots(timestamp);
                CREATE INDEX IF NOT EXISTS idx_screenshots_app_name ON screenshots(app_name);
                CREATE INDEX IF NOT EXISTS idx_extracted_text_screenshot_id ON extracted_text(screenshot_id);
                CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
                CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            `);

            console.log('✓ Database schema initialized');
        } catch (error) {
            console.error('Failed to initialize database schema:', error);
            throw new Error(`Schema initialization failed: ${error.message}`);
        }
    }

    // Screenshot operations
    insertScreenshot(timestamp, appName, windowTitle, filePath) {
        const stmt = this.db.prepare(`
            INSERT INTO screenshots (timestamp, app_name, window_title, file_path)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(timestamp, appName, windowTitle, filePath);
        return result.lastInsertRowid;
    }

    getRecentScreenshots(limit = 10) {
        const stmt = this.db.prepare(`
            SELECT * FROM screenshots 
            ORDER BY timestamp DESC 
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    getScreenshotsByTimeRange(startTime, endTime) {
        const stmt = this.db.prepare(`
            SELECT * FROM screenshots 
            WHERE timestamp BETWEEN ? AND ?
            ORDER BY timestamp ASC
        `);
        return stmt.all(startTime, endTime);
    }

    // Extracted text operations
    insertExtractedText(screenshotId, text, confidence) {
        const stmt = this.db.prepare(`
            INSERT INTO extracted_text (screenshot_id, text, confidence)
            VALUES (?, ?, ?)
        `);
        return stmt.run(screenshotId, text, confidence);
    }

    getTextByScreenshotId(screenshotId) {
        const stmt = this.db.prepare(`
            SELECT * FROM extracted_text 
            WHERE screenshot_id = ?
        `);
        return stmt.get(screenshotId);
    }

    searchText(query, limit = 50) {
        const stmt = this.db.prepare(`
            SELECT s.*, et.text, et.confidence
            FROM screenshots s
            JOIN extracted_text et ON s.id = et.screenshot_id
            WHERE et.text LIKE ?
            ORDER BY s.timestamp DESC
            LIMIT ?
        `);
        return stmt.all(`%${query}%`, limit);
    }

    // Session operations
    createSession(startTime, contextType) {
        const stmt = this.db.prepare(`
            INSERT INTO sessions (start_time, context_type)
            VALUES (?, ?)
        `);
        const result = stmt.run(startTime, contextType);
        return result.lastInsertRowid;
    }

    updateSession(sessionId, endTime, summary) {
        const stmt = this.db.prepare(`
            UPDATE sessions 
            SET end_time = ?, summary = ?
            WHERE id = ?
        `);
        return stmt.run(endTime, summary, sessionId);
    }

    getActiveSession() {
        const stmt = this.db.prepare(`
            SELECT * FROM sessions 
            WHERE end_time IS NULL 
            ORDER BY start_time DESC 
            LIMIT 1
        `);
        return stmt.get();
    }

    linkScreenshotToSession(sessionId, screenshotId) {
        const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO session_screenshots (session_id, screenshot_id)
            VALUES (?, ?)
        `);
        return stmt.run(sessionId, screenshotId);
    }

    // Task operations
    insertTask(description, source, priority = 'medium') {
        const stmt = this.db.prepare(`
            INSERT INTO tasks (description, source, priority)
            VALUES (?, ?, ?)
        `);
        const result = stmt.run(description, source, priority);
        return result.lastInsertRowid;
    }

    getPendingTasks() {
        const stmt = this.db.prepare(`
            SELECT * FROM tasks 
            WHERE status = 'pending'
            ORDER BY 
                CASE priority 
                    WHEN 'high' THEN 1 
                    WHEN 'medium' THEN 2 
                    WHEN 'low' THEN 3 
                END,
                created_at DESC
        `);
        return stmt.all();
    }

    completeTask(taskId) {
        const stmt = this.db.prepare(`
            UPDATE tasks 
            SET status = 'completed', completed_at = strftime('%s', 'now')
            WHERE id = ?
        `);
        return stmt.run(taskId);
    }

    // Settings operations
    getSetting(key, defaultValue = null) {
        const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
        const result = stmt.get(key);
        return result ? result.value : defaultValue;
    }

    setSetting(key, value) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO settings (key, value)
            VALUES (?, ?)
        `);
        return stmt.run(key, value);
    }

    // Data retention and cleanup
    deleteOldScreenshots(daysToKeep = 30) {
        const cutoffTime = Math.floor(Date.now() / 1000) - (daysToKeep * 24 * 60 * 60);
        const stmt = this.db.prepare(`
            DELETE FROM screenshots 
            WHERE timestamp < ?
        `);
        return stmt.run(cutoffTime);
    }

    // Get statistics
    getStats() {
        const screenshotCount = this.db.prepare('SELECT COUNT(*) as count FROM screenshots').get().count;
        const sessionCount = this.db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
        const taskCount = this.db.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = "pending"').get().count;

        return {
            screenshots: screenshotCount,
            sessions: sessionCount,
            pendingTasks: taskCount
        };
    }

    close() {
        this.db.close();
    }
}

module.exports = MetrixaDatabase;
