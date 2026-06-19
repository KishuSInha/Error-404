const MetrixaDatabase = require('../storage/database');

class SearchFeature {
    constructor() {
        this.db = null;
    }

    async initialize() {
        if (!this.db) {
            this.db = new MetrixaDatabase();
        }
    }

    /**
     * Search across all captured text
     */
    async search(query, options = {}) {
        await this.initialize();

        const {
            limit = 50,
            startTime = null,
            endTime = null,
            appName = null
        } = options;

        let results = this.db.searchText(query, limit);

        // Apply time filter if provided
        if (startTime || endTime) {
            results = results.filter(result => {
                if (startTime && result.timestamp < startTime) return false;
                if (endTime && result.timestamp > endTime) return false;
                return true;
            });
        }

        // Apply app filter if provided
        if (appName) {
            results = results.filter(result =>
                result.app_name && result.app_name.toLowerCase().includes(appName.toLowerCase())
            );
        }

        return results;
    }

    /**
     * Search by time range
     */
    async searchByTimeRange(startTime, endTime) {
        await this.initialize();
        return this.db.getScreenshotsByTimeRange(startTime, endTime);
    }

    /**
     * Search by app name
     */
    async searchByApp(appName, limit = 50) {
        await this.initialize();

        const allScreenshots = this.db.getRecentScreenshots(1000); // Get more to filter
        const filtered = allScreenshots
            .filter(s => s.app_name && s.app_name.toLowerCase().includes(appName.toLowerCase()))
            .slice(0, limit);

        return filtered;
    }

    /**
     * Natural language search using AI
     */
    async naturalLanguageSearch(query) {
        await this.initialize();

        // Extract time references from query
        const timeInfo = this.extractTimeFromQuery(query);

        // Extract app references
        const appInfo = this.extractAppFromQuery(query);

        // Extract keywords
        const keywords = this.extractKeywords(query);

        // Perform search with extracted info
        const results = await this.search(keywords, {
            startTime: timeInfo.startTime,
            endTime: timeInfo.endTime,
            appName: appInfo
        });

        return {
            query,
            results,
            interpretation: {
                timeRange: timeInfo.description,
                app: appInfo,
                keywords
            }
        };
    }

    /**
     * Extract time information from natural language query
     */
    extractTimeFromQuery(query) {
        const now = Date.now() / 1000;
        const lowerQuery = query.toLowerCase();

        // Today
        if (lowerQuery.includes('today')) {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            return {
                startTime: Math.floor(startOfDay.getTime() / 1000),
                endTime: now,
                description: 'today'
            };
        }

        // Yesterday
        if (lowerQuery.includes('yesterday')) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);
            const endOfYesterday = new Date(yesterday);
            endOfYesterday.setHours(23, 59, 59, 999);
            return {
                startTime: Math.floor(yesterday.getTime() / 1000),
                endTime: Math.floor(endOfYesterday.getTime() / 1000),
                description: 'yesterday'
            };
        }

        // This week
        if (lowerQuery.includes('this week') || lowerQuery.includes('week')) {
            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            return {
                startTime: Math.floor(startOfWeek.getTime() / 1000),
                endTime: now,
                description: 'this week'
            };
        }

        // Last N hours
        const hoursMatch = lowerQuery.match(/last\s+(\d+)\s+hours?/);
        if (hoursMatch) {
            const hours = parseInt(hoursMatch[1]);
            return {
                startTime: now - (hours * 3600),
                endTime: now,
                description: `last ${hours} hours`
            };
        }

        return {
            startTime: null,
            endTime: null,
            description: 'all time'
        };
    }

    /**
     * Extract app name from query
     */
    extractAppFromQuery(query) {
        const commonApps = [
            'chrome', 'safari', 'firefox', 'edge',
            'mail', 'gmail', 'outlook',
            'slack', 'discord', 'zoom', 'teams',
            'code', 'vscode', 'terminal', 'iterm',
            'word', 'pages', 'docs', 'notion'
        ];

        const lowerQuery = query.toLowerCase();
        for (const app of commonApps) {
            if (lowerQuery.includes(app)) {
                return app;
            }
        }

        return null;
    }

    /**
     * Extract keywords from query
     */
    extractKeywords(query) {
        // Remove common words and time/app references
        const stopWords = ['what', 'when', 'where', 'was', 'were', 'is', 'are', 'the', 'a', 'an',
            'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
            'today', 'yesterday', 'week', 'last', 'this', 'doing', 'working'];

        const words = query.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.includes(word));

        return words.join(' ');
    }
}

module.exports = SearchFeature;
