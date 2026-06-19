const { readRecentEmails } = require("../context/gmail");

async function readEmail(step) {
    try {
        console.log(`[ACTION]: Reading ${step.count || 5} emails...`);
        const result = await readRecentEmails(step.count || 5);
        return result;
    } catch (error) {
        console.error('[ACTION] Read email failed:', error);
        throw new Error(`Failed to read emails: ${error.message}`);
    }
}

module.exports = { readEmail };
