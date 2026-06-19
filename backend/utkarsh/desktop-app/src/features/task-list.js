const TaskExtractor = require('../ai/task-extractor');
const MetrixaDatabase = require('../storage/database');

class TaskListFeature {
    constructor() {
        this.extractor = new TaskExtractor();
        this.db = null;
    }

    async initialize() {
        if (!this.db) {
            this.db = new MetrixaDatabase();
        }
    }

    /**
     * Get all pending tasks
     */
    async getPendingTasks() {
        await this.initialize();
        return this.db.getPendingTasks();
    }

    /**
     * Extract tasks from recent activity
     */
    async extractTasksFromRecentActivity(limit = 20) {
        await this.initialize();

        const recentScreenshots = this.db.getRecentScreenshots(limit);
        const allTasks = [];

        for (const screenshot of recentScreenshots) {
            const textData = this.db.getTextByScreenshotId(screenshot.id);

            if (textData && textData.text) {
                const tasks = await this.extractor.extractTasks(
                    textData.text,
                    `${screenshot.app_name}:${screenshot.timestamp}`
                );

                // Save new tasks to database
                for (const task of tasks) {
                    const taskId = this.db.insertTask(
                        task.description,
                        task.source,
                        task.priority
                    );
                    allTasks.push({ id: taskId, ...task });
                }
            }
        }

        return allTasks;
    }

    /**
     * Mark task as complete
     */
    async completeTask(taskId) {
        await this.initialize();
        return this.db.completeTask(taskId);
    }

    /**
     * Add manual task
     */
    async addTask(description, priority = 'medium') {
        await this.initialize();
        return this.db.insertTask(description, 'manual', priority);
    }

    /**
     * Get tasks by priority
     */
    async getTasksByPriority(priority) {
        await this.initialize();
        const allTasks = this.db.getPendingTasks();
        return allTasks.filter(task => task.priority === priority);
    }
}

module.exports = TaskListFeature;
