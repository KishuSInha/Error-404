const Summarizer = require('../ai/summarizer');
const TaskExtractor = require('../ai/task-extractor');
const MetrixaDatabase = require('../storage/database');

class DailySummaryFeature {
    constructor() {
        this.summarizer = new Summarizer();
        this.db = null;
    }

    async initialize() {
        if (!this.db) {
            this.db = new MetrixaDatabase();
        }
        this.summarizer.initialize();
    }

    /**
     * Get daily summary for today or specific date
     */
    async getDailySummary(date = null) {
        await this.initialize();
        return await this.summarizer.generateDailySummary(date);
    }

    /**
     * Get weekly summary
     */
    async getWeeklySummary() {
        await this.initialize();
        return await this.summarizer.generateWeeklySummary();
    }

    /**
     * Get summary for custom date range
     */
    async getCustomSummary(startDate, endDate) {
        await this.initialize();

        const summaries = [];
        const current = new Date(startDate);
        const end = new Date(endDate);

        while (current <= end) {
            const summary = await this.summarizer.generateDailySummary(new Date(current));
            summaries.push(summary);
            current.setDate(current.getDate() + 1);
        }

        return {
            period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
            dailySummaries: summaries,
            totalDays: summaries.length
        };
    }
}

module.exports = DailySummaryFeature;
