const Summarizer = require('../ai/summarizer');

class EmailDigestFeature {
    constructor() {
        this.summarizer = new Summarizer();
    }

    async initialize() {
        this.summarizer.initialize();
    }

    /**
     * Get email digest for today or specific date
     */
    async getEmailDigest(date = null) {
        await this.initialize();
        return await this.summarizer.generateEmailDigest(date);
    }

    /**
     * Get emails that need replies
     */
    async getEmailsNeedingReply(date = null) {
        const digest = await this.getEmailDigest(date);
        return digest.needsReply || [];
    }
}

module.exports = EmailDigestFeature;
