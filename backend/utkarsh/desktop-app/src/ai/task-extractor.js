const LLMRouter = require('./llm-router');

class TaskExtractor {
    constructor() {
        this.llm = new LLMRouter();

        // Patterns for task detection
        this.taskPatterns = [
            /(?:need to|have to|must|should|todo:?)\s+(.+?)(?:\.|$)/gi,
            /(?:reply to|respond to|email|message)\s+(.+?)(?:\.|$)/gi,
            /(?:follow up with|check with|contact)\s+(.+?)(?:\.|$)/gi,
            /(?:finish|complete|work on)\s+(.+?)(?:\.|$)/gi,
            /(?:review|check|verify)\s+(.+?)(?:\.|$)/gi,
            /\[\s*\]\s+(.+?)(?:\n|$)/gi, // Markdown checkboxes
            /^[-*]\s+(.+?)(?:\n|$)/gim // Bullet points
        ];

        // Priority keywords
        this.urgentKeywords = ['urgent', 'asap', 'immediately', 'critical', 'important', 'deadline'];
        this.highKeywords = ['soon', 'today', 'priority', 'needed'];
    }

    /**
     * Extract tasks from text using pattern matching and AI
     */
    async extractTasks(text, source = 'screen') {
        const tasks = [];

        // First pass: Pattern-based extraction
        const patternTasks = this.extractWithPatterns(text);
        tasks.push(...patternTasks);

        // Second pass: AI-based extraction for more nuanced tasks
        try {
            const aiTasks = await this.extractWithAI(text);
            tasks.push(...aiTasks);
        } catch (error) {
            console.warn('AI task extraction failed, using pattern-based only:', error.message);
        }

        // Deduplicate and prioritize
        const uniqueTasks = this.deduplicateTasks(tasks);
        const prioritizedTasks = uniqueTasks.map(task => ({
            ...task,
            source,
            priority: this.determinePriority(task.description)
        }));

        return prioritizedTasks;
    }

    /**
     * Extract tasks using regex patterns
     */
    extractWithPatterns(text) {
        const tasks = [];
        const seenDescriptions = new Set();

        for (const pattern of this.taskPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const description = match[1].trim();

                // Filter out very short or very long matches
                if (description.length < 5 || description.length > 200) {
                    continue;
                }

                // Avoid duplicates
                if (seenDescriptions.has(description.toLowerCase())) {
                    continue;
                }

                seenDescriptions.add(description.toLowerCase());
                tasks.push({ description });
            }
        }

        return tasks;
    }

    /**
     * Extract tasks using AI for more nuanced understanding
     */
    async extractWithAI(text) {
        // Only use AI if text is substantial
        if (text.length < 50) {
            return [];
        }

        const prompt = `Extract actionable tasks from the following text. Return ONLY a JSON array of task descriptions, nothing else.

Text:
${text.substring(0, 2000)}

Return format: ["task 1", "task 2", ...]

Tasks:`;

        try {
            const response = await this.llm.route(prompt, 'simple', {
                temperature: 0.3,
                maxTokens: 300
            });

            // Parse JSON from response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const taskDescriptions = JSON.parse(jsonMatch[0]);
                return taskDescriptions
                    .filter(desc => typeof desc === 'string' && desc.length > 5)
                    .map(description => ({ description }));
            }
        } catch (error) {
            console.error('AI task extraction error:', error);
        }

        return [];
    }

    /**
     * Deduplicate tasks based on similarity
     */
    deduplicateTasks(tasks) {
        const unique = [];
        const seen = new Set();

        for (const task of tasks) {
            const normalized = task.description.toLowerCase().trim();

            // Simple deduplication based on exact match
            if (!seen.has(normalized)) {
                seen.add(normalized);
                unique.push(task);
            }
        }

        return unique;
    }

    /**
     * Determine task priority based on keywords
     */
    determinePriority(description) {
        const lower = description.toLowerCase();

        for (const keyword of this.urgentKeywords) {
            if (lower.includes(keyword)) {
                return 'high';
            }
        }

        for (const keyword of this.highKeywords) {
            if (lower.includes(keyword)) {
                return 'medium';
            }
        }

        return 'low';
    }

    /**
     * Extract tasks from email-specific text
     */
    async extractEmailTasks(emailText, sender) {
        const tasks = await this.extractTasks(emailText, `email:${sender}`);

        // Add implicit "reply to" task if email seems to need response
        if (this.needsReply(emailText)) {
            tasks.unshift({
                description: `Reply to ${sender}`,
                source: `email:${sender}`,
                priority: 'medium'
            });
        }

        return tasks;
    }

    /**
     * Detect if email needs a reply
     */
    needsReply(emailText) {
        const replyIndicators = [
            /\?/g, // Questions
            /please\s+(?:let me know|respond|reply|confirm)/i,
            /waiting\s+(?:for|to hear)/i,
            /can you/i,
            /would you/i,
            /could you/i
        ];

        return replyIndicators.some(pattern => pattern.test(emailText));
    }
}

module.exports = TaskExtractor;
