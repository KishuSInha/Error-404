/**
 * LLM Router — Priority: OpenAI → Ollama → Simple fallback
 * Now supports streaming via callbacks
 */

require('dotenv').config();
const OpenAIClient = require('./openai-client');
const OllamaClient = require('./ollama-client');
const IntentClassifier = require('./intent-classifier');

let openai = null;
let ollama = null;
let intentClassifier = null;

function getOpenAI() {
    if (!openai) openai = new OpenAIClient();
    return openai;
}
function getOllama() {
    if (!ollama) ollama = new OllamaClient();
    return ollama;
}
function getClassifier() {
    if (!intentClassifier) intentClassifier = new IntentClassifier();
    return intentClassifier;
}

class LLMRouter {
    constructor() {
        this._primaryLLM = null; // cached after first check
    }

    async isAvailable() {
        return await this._detectPrimary() !== null;
    }

    async warmup() {
        const primary = await this._detectPrimary();
        if (primary === 'openai') {
            // OpenAI needs no warmup
        } else if (primary === 'ollama') {
            await getOllama().warmup();
        }
    }

    /**
     * Detect which LLM to use (cached after first call)
     */
    async _detectPrimary() {
        if (this._primaryLLM !== undefined) return this._primaryLLM;

        // Try OpenAI first
        try {
            const ok = await getOpenAI().isAvailable();
            if (ok) {
                console.log('[LLM ROUTER] Using OpenAI GPT-4o-mini');
                this._primaryLLM = 'openai';
                return 'openai';
            }
        } catch (e) {
            console.log('[LLM ROUTER] OpenAI check failed:', e.message);
        }

        // Try Ollama
        try {
            const ok = await getOllama().isAvailable();
            if (ok) {
                console.log('[LLM ROUTER] Using Ollama (local)');
                this._primaryLLM = 'ollama';
                return 'ollama';
            }
        } catch (e) {
            console.log('[LLM ROUTER] Ollama check failed:', e.message);
        }

        console.log('[LLM ROUTER] No LLM available — using simple fallback');
        this._primaryLLM = null;
        return null;
    }

    /**
     * Route a prompt — tries primary, falls back automatically
     */
    async route(prompt, taskType = 'simple', options = {}) {
        const primary = await this._detectPrimary();

        if (primary === 'openai') {
            try {
                return await getOpenAI().generate(prompt, options);
            } catch (error) {
                console.log('[LLM ROUTER] OpenAI failed, trying Ollama:', error.message);
                try {
                    const model = await getOllama().getBestModel();
                    return await getOllama().generate(prompt, { model, ...options });
                } catch (e2) {
                    throw new Error(`All LLMs failed. OpenAI: ${error.message}. Ollama: ${e2.message}`);
                }
            }
        }

        if (primary === 'ollama') {
            try {
                const model = await getOllama().getBestModel();
                return await getOllama().generate(prompt, { model, ...options });
            } catch (error) {
                throw new Error(`Ollama failed: ${error.message}`);
            }
        }

        // Fallback: tell the user
        const lines = prompt.split('\n').filter(l => l.trim()).slice(0, 3);
        return `**No AI available.** Install Ollama (ollama.ai) or add an OpenAI key.\n\nYour request: _${lines.join(' ')}..._`;
    }

    /**
     * Stream a response — yields chunks to onChunk(text)
     * Falls back to non-streaming if needed
     */
    async routeStream(prompt, options = {}, onChunk) {
        const primary = await this._detectPrimary();

        if (primary === 'openai') {
            try {
                return await getOpenAI().generateStream(prompt, options, onChunk);
            } catch (error) {
                console.log('[LLM ROUTER] OpenAI stream failed, trying Ollama:', error.message);
            }
        }

        if (primary === 'ollama') {
            // Ollama doesn't have streaming in current client — do regular then call onChunk once
            try {
                const model = await getOllama().getBestModel();
                const result = await getOllama().generate(prompt, { model, ...options });
                if (onChunk) onChunk(result);
                return result;
            } catch (error) {
                throw new Error(`Ollama failed: ${error.message}`);
            }
        }

        const fallback = 'Please install Ollama or configure an OpenAI API key to use Metrixa AI.';
        if (onChunk) onChunk(fallback);
        return fallback;
    }

    /**
     * Process user input with intent classification
     * Supports streaming via onChunk callback
     */
    async processWithIntent(userInput, ocrText = null, onChunk = null) {
        const classifier = getClassifier();
        const intent = classifier.classify(userInput);
        console.log('[LLM ROUTER] Intent:', intent.name);

        classifier.addToMemory('user', userInput);

        let prompt;
        if (intent.requiresOCR && ocrText && ocrText.length > 20) {
            prompt = classifier.buildPromptWithContext(intent, ocrText);
        } else {
            prompt = userInput;
        }

        try {
            let response;
            if (onChunk) {
                response = await this.routeStream(prompt, { temperature: 0.4, maxTokens: 800 }, onChunk);
            } else {
                response = await this.route(prompt, 'medium', { temperature: 0.4, maxTokens: 800 });
            }

            classifier.addToMemory('assistant', response);
            return { intent, response };
        } catch (error) {
            const errMsg = `Sorry, I couldn't process that. ${error.message}`;
            if (onChunk) onChunk(errMsg);
            return { intent, response: errMsg, error: error.message };
        }
    }

    getMemory() {
        return getClassifier().getMemory();
    }

    clearMemory() {
        getClassifier().clearMemory();
    }

    // Force re-detect LLM on next call (useful after API key changes)
    reset() {
        this._primaryLLM = undefined;
        openai = null;
        ollama = null;
    }
}

module.exports = LLMRouter;
