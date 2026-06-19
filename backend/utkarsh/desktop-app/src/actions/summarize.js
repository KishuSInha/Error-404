const OllamaClient = require('../ai/ollama-client');

const ollama = new OllamaClient();

async function summarize(data) {
    console.log("[ACTION]: Summarizing context...");

    let textToSummarize = "";
    if (Array.isArray(data)) {
        textToSummarize = data.map(e => `${e.sender}: ${e.subject}`).join("\n");
    } else {
        textToSummarize = String(data);
    }

    if (!textToSummarize || textToSummarize.trim().length === 0) {
        return "No text content available to summarize.";
    }

    try {
        const availableModels = await ollama.getAvailableModels();
        console.log('[SUMMARIZE] Available models:', availableModels);

        if (availableModels.length === 0) {
            console.log('[SUMMARIZE] No models available, using simple summary');
            return generateSimpleSummary(textToSummarize);
        }

        // Try available models - llava works too for text
        for (const model of availableModels) {
            try {
                console.log(`[SUMMARIZE] Trying model: ${model}`);
                const result = await ollama.generate(
                    `Summarize the following clearly and concisely:\n\n${textToSummarize.substring(0, 2000)}`,
                    { model: model, maxTokens: 300 }
                );
                console.log(`[SUMMARIZE] Success with ${model}`);
                return result;
            } catch (e) {
                console.log(`[SUMMARIZE] Model ${model} failed: ${e.message}`);
                // Try next model
            }
        }

        // If all models fail, return simple summary
        return generateSimpleSummary(textToSummarize);
    } catch (error) {
        console.error('[SUMMARIZE] Error:', error.message);
        return generateSimpleSummary(textToSummarize);
    }
}

function generateSimpleSummary(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length <= 3) {
        return text.substring(0, 500);
    }
    const firstFew = sentences.slice(0, 3).join('. ').trim();
    return firstFew + (text.length > 300 ? '...' : '');
}

module.exports = { summarize, ollama };
