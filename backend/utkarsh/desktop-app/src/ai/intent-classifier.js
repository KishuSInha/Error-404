const INTENTS = {
    SUMMARIZE: {
        keywords: ['summarize', 'summary', 'summarise', 'digest', 'brief', 'recap', 'tldr', 'shorten'],
        description: 'Summarize content',
        requiresOCR: true
    },
    EXPLAIN: {
        keywords: ['explain', 'what is', 'what does', 'meaning', 'describe', 'tell me about'],
        description: 'Explain or describe content',
        requiresOCR: true
    },
    EXTRACT_TASKS: {
        keywords: ['tasks', 'action items', 'to-do', 'todo', 'action items', 'follow up', 'deadlines'],
        description: 'Extract action items',
        requiresOCR: true
    },
    EXTRACT_DATA: {
        keywords: ['extract', 'pull', 'get', 'find', 'list', 'show me the', 'numbers', 'emails', 'contacts'],
        description: 'Extract specific data',
        requiresOCR: true
    },
    REWRITE: {
        keywords: ['rewrite', 'rephrase', 'improve', 'fix', 'grammar', 'polish', 'edit'],
        description: 'Rewrite or improve text',
        requiresOCR: true
    },
    TRANSLATE: {
        keywords: ['translate', 'in spanish', 'in french', 'in german', 'to english', 'to hindi'],
        description: 'Translate content',
        requiresOCR: true
    },
    BULLETS: {
        keywords: ['bullet', 'bullet points', 'list', 'convert to', 'make a list', 'key points'],
        description: 'Convert to bullet points',
        requiresOCR: true
    },
    SEARCH_WEB: {
        keywords: ['search', 'look up', 'google', 'find on web', 'web search'],
        description: 'Search the web',
        requiresOCR: false
    },
    GENERAL_CHAT: {
        keywords: [],
        description: 'General conversation',
        requiresOCR: false
    }
};

class IntentClassifier {
    constructor() {
        this.contextMemory = [];
        this.maxMemory = 5;
    }

    classify(userInput) {
        const input = userInput.toLowerCase().trim();
        
        let bestMatch = { intent: 'GENERAL_CHAT', score: 0, ...INTENTS.GENERAL_CHAT };

        for (const [intentName, intentData] of Object.entries(INTENTS)) {
            if (intentName === 'GENERAL_CHAT') continue;

            for (const keyword of intentData.keywords) {
                if (input.includes(keyword)) {
                    const score = keyword.length;
                    if (score > bestMatch.score) {
                        bestMatch = {
                            intent: intentName,
                            score: score,
                            ...intentData
                        };
                    }
                }
            }
        }

        return {
            name: bestMatch.intent,
            description: bestMatch.description,
            requiresOCR: bestMatch.requiresOCR,
            originalInput: userInput
        };
    }

    addToMemory(role, content) {
        this.contextMemory.push({ role, content, timestamp: Date.now() });
        if (this.contextMemory.length > this.maxMemory) {
            this.contextMemory.shift();
        }
    }

    getMemory() {
        return [...this.contextMemory];
    }

    clearMemory() {
        this.contextMemory = [];
    }

    getLastUserMessage() {
        const messages = this.contextMemory.filter(m => m.role === 'user');
        return messages.length > 0 ? messages[messages.length - 1].content : null;
    }

    buildPromptWithContext(intent, ocrText) {
        let prompt = '';

        const lastMessage = this.getLastUserMessage();
        if (lastMessage && lastMessage !== intent.originalInput) {
            prompt += `Previous user request: "${lastMessage}"\n\n`;
        }

        prompt += `Current request: "${intent.originalInput}"\n\n`;

        if (ocrText && intent.requiresOCR) {
            prompt += `Screen content:\n${ocrText}\n\n`;
        }

        switch (intent.name) {
            case 'SUMMARIZE':
                prompt += 'Provide a clear, concise summary of the content above.';
                break;
            case 'EXPLAIN':
                prompt += 'Explain what this content means in simple terms.';
                break;
            case 'EXTRACT_TASKS':
                prompt += 'Extract all action items, tasks, and deadlines. List them clearly.';
                break;
            case 'EXTRACT_DATA':
                prompt += 'Extract the relevant data from this content. Be specific.';
                break;
            case 'REWRITE':
                prompt += 'Rewrite this text to be clearer and more professional.';
                break;
            case 'TRANSLATE':
                prompt += 'Translate this content to the requested language.';
                break;
            case 'BULLETS':
                prompt += 'Convert this content into clear bullet points.';
                break;
            case 'SEARCH_WEB':
                prompt += 'Provide information about this topic.';
                break;
            default:
                prompt += 'Respond helpfully to the user request.';
        }

        return prompt;
    }
}

module.exports = IntentClassifier;
