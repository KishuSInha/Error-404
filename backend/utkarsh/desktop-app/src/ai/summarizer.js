const LLMRouter = require('./llm-router');
const MetrixaDatabase = require('../storage/database');

class Summarizer {
    constructor() {
        this.llm = new LLMRouter();
        this.db = null;
    }

    initialize() {
        if (!this.db) {
            this.db = new MetrixaDatabase();
        }
    }

    /**
     * Generate daily work summary
     */
    async generateDailySummary(date = null) {
        this.initialize();

        const targetDate = date || new Date();
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const startTimestamp = Math.floor(startOfDay.getTime() / 1000);
        const endTimestamp = Math.floor(endOfDay.getTime() / 1000);

        // Get all sessions for the day
        const sessions = this.db.db.prepare(`
            SELECT * FROM sessions
            WHERE start_time >= ? AND start_time <= ?
            ORDER BY start_time ASC
        `).all(startTimestamp, endTimestamp);

        if (sessions.length === 0) {
            return {
                summary: 'No activity recorded for this day.',
                sessions: [],
                totalTime: 0
            };
        }

        // Calculate time spent in each context
        const contextTime = {};
        let totalTime = 0;

        for (const session of sessions) {
            const duration = (session.end_time || endTimestamp) - session.start_time;
            const context = session.context_type || 'general';

            contextTime[context] = (contextTime[context] || 0) + duration;
            totalTime += duration;
        }

        // Get sample text from sessions for AI summary
        const sampleTexts = [];
        for (const session of sessions.slice(0, 5)) { // Sample first 5 sessions
            const screenshots = this.db.db.prepare(`
                SELECT et.text
                FROM session_screenshots ss
                JOIN extracted_text et ON ss.screenshot_id = et.screenshot_id
                WHERE ss.session_id = ?
                LIMIT 3
            `).all(session.id);

            for (const screenshot of screenshots) {
                if (screenshot.text) {
                    sampleTexts.push(screenshot.text.substring(0, 500));
                }
            }
        }

        // Generate AI summary
        const contextSummary = Object.entries(contextTime)
            .map(([context, seconds]) => {
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                return `${context}: ${hours}h ${minutes}m`;
            })
            .join(', ');

        const prompt = `Generate a concise daily work summary based on the following information:

Time breakdown: ${contextSummary}
Total sessions: ${sessions.length}

Sample activities:
${sampleTexts.slice(0, 3).join('\n\n')}

Provide a 2-3 sentence summary of what the user worked on today. Be specific and actionable.

Summary:`;

        let aiSummary = '';
        try {
            aiSummary = await this.llm.route(prompt, 'medium', {
                temperature: 0.5,
                maxTokens: 200
            });
        } catch (error) {
            console.error('AI summary generation failed:', error);
            aiSummary = `You had ${sessions.length} work sessions today, spending most time on ${Object.keys(contextTime)[0]}.`;
        }

        return {
            summary: aiSummary.trim(),
            contextBreakdown: contextTime,
            sessions: sessions.length,
            totalTime: Math.floor(totalTime / 60), // in minutes
            date: targetDate.toISOString().split('T')[0]
        };
    }

    /**
     * Generate email digest
     */
    async generateEmailDigest(date = null) {
        this.initialize();

        const targetDate = date || new Date();
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const startTimestamp = Math.floor(startOfDay.getTime() / 1000);
        const endTimestamp = Math.floor(endOfDay.getTime() / 1000);

        // Get email-related screenshots
        const emailScreenshots = this.db.db.prepare(`
            SELECT s.*, et.text
            FROM screenshots s
            JOIN extracted_text et ON s.id = et.screenshot_id
            WHERE s.timestamp >= ? AND s.timestamp <= ?
            AND (s.app_name LIKE '%Mail%' OR s.app_name LIKE '%Gmail%' OR s.app_name LIKE '%Outlook%')
            ORDER BY s.timestamp DESC
        `).all(startTimestamp, endTimestamp);

        if (emailScreenshots.length === 0) {
            return {
                summary: 'No email activity detected today.',
                emails: [],
                needsReply: []
            };
        }

        // Extract email information
        const emails = this.extractEmailInfo(emailScreenshots);

        // Identify emails needing reply
        const needsReply = emails.filter(email =>
            email.text && this.detectNeedsReply(email.text)
        );

        const prompt = `Summarize the following email activity:

Total emails viewed: ${emails.length}
Emails needing reply: ${needsReply.length}

Sample email subjects/content:
${emails.slice(0, 5).map(e => e.subject || e.text?.substring(0, 100)).join('\n')}

Provide a brief 2-sentence summary of email activity.

Summary:`;

        let aiSummary = '';
        try {
            aiSummary = await this.llm.route(prompt, 'medium', {
                temperature: 0.5,
                maxTokens: 150
            });
        } catch (error) {
            aiSummary = `You viewed ${emails.length} emails today${needsReply.length > 0 ? `, ${needsReply.length} may need replies` : ''}.`;
        }

        return {
            summary: aiSummary.trim(),
            totalEmails: emails.length,
            needsReply: needsReply.slice(0, 10), // Top 10
            date: targetDate.toISOString().split('T')[0]
        };
    }

    /**
     * Extract email information from screenshots
     */
    extractEmailInfo(screenshots) {
        const emails = [];
        const seenSubjects = new Set();

        for (const screenshot of screenshots) {
            // Try to extract subject from window title or text
            const subject = screenshot.window_title ||
                this.extractSubjectFromText(screenshot.text);

            if (subject && !seenSubjects.has(subject)) {
                seenSubjects.add(subject);
                emails.push({
                    subject,
                    text: screenshot.text,
                    timestamp: screenshot.timestamp,
                    app: screenshot.app_name
                });
            }
        }

        return emails;
    }

    /**
     * Extract email subject from text
     */
    extractSubjectFromText(text) {
        if (!text) return null;

        // Look for common email subject patterns
        const subjectPatterns = [
            /Subject:\s*(.+?)(?:\n|$)/i,
            /Re:\s*(.+?)(?:\n|$)/i,
            /Fwd:\s*(.+?)(?:\n|$)/i
        ];

        for (const pattern of subjectPatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1].trim().substring(0, 100);
            }
        }

        // Fallback: use first line if it looks like a subject
        const firstLine = text.split('\n')[0];
        if (firstLine && firstLine.length < 100 && firstLine.length > 5) {
            return firstLine.trim();
        }

        return null;
    }

    /**
     * Detect if email needs reply
     */
    detectNeedsReply(text) {
        const replyIndicators = [
            /\?/,
            /please\s+(?:let me know|respond|reply|confirm)/i,
            /waiting\s+(?:for|to hear)/i,
            /can you/i,
            /would you/i,
            /could you/i,
            /need\s+(?:your|you to)/i
        ];

        return replyIndicators.some(pattern => pattern.test(text));
    }

    /**
     * Generate weekly summary
     */
    async generateWeeklySummary() {
        this.initialize();

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const dailySummaries = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);

            try {
                const summary = await this.generateDailySummary(date);
                dailySummaries.push(summary);
            } catch (error) {
                console.error(`Failed to generate summary for ${date}:`, error);
            }
        }

        // Aggregate weekly stats
        const totalSessions = dailySummaries.reduce((sum, day) => sum + day.sessions, 0);
        const totalTime = dailySummaries.reduce((sum, day) => sum + day.totalTime, 0);

        return {
            period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
            totalSessions,
            totalTime,
            dailySummaries
        };
    }
}

module.exports = Summarizer;
