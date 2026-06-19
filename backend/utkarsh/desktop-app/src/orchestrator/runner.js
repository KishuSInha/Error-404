const { getScreenText, readScreenText } = require('../context/screen');
const { guiClick, guiType } = require('../actions/gui');
const { readEmail } = require('../actions/readEmail');
const { summarize } = require('../actions/summarize');
const { pasteIntoNotes } = require('../actions/pasteToNotes');
const { verify } = require('../agents/verifier');

const ACTIONS = {
    READ_SCREEN: readScreenText,
    READ_EMAIL: readEmail,
    SUMMARIZE: summarize,
    WRITE_NOTES: pasteIntoNotes
};

class AgentRunner {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.currentPlan = [];
        this.currentStepIndex = 0;
        this.isExecuting = false;
        this.memory = null;
    }

    async runPlan(plan) {
        if (this.isExecuting) throw new Error("Agent is already executing a plan.");

        this.currentPlan = plan;
        this.currentStepIndex = 0;
        this.isExecuting = true;
        this.memory = null;

        this.notify(`Starting mission: ${plan.length} steps planned.`);

        try {
            for (let i = 0; i < plan.length; i++) {
                if (!this.isExecuting) break; // Kill switch check

                this.currentStepIndex = i;
                const step = plan[i];

                this.notify(`⚙️ STEP ${i + 1}: ${step.step || step.action}`);

                const actionFn = ACTIONS[step.action];
                if (!actionFn) throw new Error(`Unknown action type: ${step.action}`);

                // Execute action with step config and previous memory
                const result = await actionFn(step, this.memory);

                // Verify step
                if (!verify(step, result)) {
                    throw new Error(`Step verification failed for ${step.action}`);
                }

                // Update memory for next step
                this.memory = result;

                // Add a small delay between steps for system stability
                await new Promise(r => setTimeout(r, 1500));
            }

            if (this.isExecuting) {
                this.notify("✅ Mission Complete. Task finished end-to-end.");
            }
        } catch (error) {
            console.error("Orchestration failed:", error);
            this.notify(`❌ MISSION FAILED: ${error.message}.`);
        } finally {
            this.isExecuting = false;
        }
    }

    notify(message) {
        console.log(`[AGENT RUNNER]: ${message}`);
        if (this.mainWindow) {
            this.mainWindow.webContents.send('analysis-result', message);
        }
    }
}

module.exports = AgentRunner;
