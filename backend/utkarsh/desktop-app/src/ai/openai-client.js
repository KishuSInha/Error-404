/**
 * OpenAI HTTP Client for Metrixa AI
 * Uses direct HTTP (no SDK) via node-fetch
 * Supports streaming for real-time UI updates
 */

require('dotenv').config();
const https = require('https');

class OpenAIClient {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY || '';
        this.baseUrl = 'https://api.openai.com/v1';
        this.defaultModel = 'gpt-4o-mini';
        this.isChecked = false;
        this.isAvailableCache = null;
    }

    async isAvailable() {
        if (!this.apiKey || this.apiKey.length < 20) {
            console.log('[OPENAI] No valid API key found');
            return false;
        }
        if (this.isAvailableCache !== null) return this.isAvailableCache;

        try {
            // Quick ping to models endpoint
            const result = await this._request('GET', '/models', null, { timeout: 5000 });
            this.isAvailableCache = !!result.data;
            return this.isAvailableCache;
        } catch (e) {
            console.log('[OPENAI] Not available:', e.message);
            this.isAvailableCache = false;
            return false;
        }
    }

    /**
     * Chat completion (non-streaming)
     */
    async chat(messages, options = {}) {
        if (!this.apiKey) throw new Error('No OpenAI API key configured');

        const body = {
            model: options.model || this.defaultModel,
            messages,
            temperature: options.temperature ?? 0.4,
            max_tokens: options.maxTokens || 1000,
            stream: false
        };

        const response = await this._request('POST', '/chat/completions', body);
        return response.choices?.[0]?.message?.content || '';
    }

    /**
     * Generate from a simple text prompt
     */
    async generate(prompt, options = {}) {
        const messages = [
            {
                role: 'system',
                content: 'You are Metrixa AI, a helpful macOS desktop assistant. Be concise and actionable.'
            },
            { role: 'user', content: prompt }
        ];
        return this.chat(messages, options);
    }

    /**
     * Streaming chat — calls onChunk(text) for each token, returns full text
     */
    async chatStream(messages, options = {}, onChunk) {
        if (!this.apiKey) throw new Error('No OpenAI API key configured');

        const body = JSON.stringify({
            model: options.model || this.defaultModel,
            messages,
            temperature: options.temperature ?? 0.4,
            max_tokens: options.maxTokens || 1000,
            stream: true
        });

        return new Promise((resolve, reject) => {
            const url = new URL('/v1/chat/completions', 'https://api.openai.com');
            const reqOptions = {
                hostname: url.hostname,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            };

            let fullText = '';
            const req = https.request(reqOptions, (res) => {
                if (res.statusCode !== 200) {
                    let errBody = '';
                    res.on('data', c => errBody += c);
                    res.on('end', () => reject(new Error(`OpenAI HTTP ${res.statusCode}: ${errBody}`)));
                    return;
                }

                let buffer = '';
                res.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep incomplete line

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === 'data: [DONE]') continue;
                        if (!trimmed.startsWith('data: ')) continue;

                        try {
                            const json = JSON.parse(trimmed.slice(6));
                            const delta = json.choices?.[0]?.delta?.content;
                            if (delta) {
                                fullText += delta;
                                if (onChunk) onChunk(delta);
                            }
                        } catch (e) {
                            // Skip malformed chunks
                        }
                    }
                });

                res.on('end', () => resolve(fullText));
                res.on('error', reject);
            });

            req.on('error', reject);
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('OpenAI request timed out'));
            });

            req.write(body);
            req.end();
        });
    }

    /**
     * Stream a simple prompt with context
     */
    async generateStream(prompt, options = {}, onChunk) {
        const messages = [
            {
                role: 'system',
                content: options.systemPrompt ||
                    'You are Metrixa AI, a smart macOS desktop assistant. Be concise, helpful and actionable. Use markdown formatting with **bold** for emphasis.'
            },
            { role: 'user', content: prompt }
        ];
        return this.chatStream(messages, options, onChunk);
    }

    /**
     * Low-level HTTP request
     */
    _request(method, path, body, options = {}) {
        return new Promise((resolve, reject) => {
            const bodyStr = body ? JSON.stringify(body) : null;
            const reqOptions = {
                hostname: 'api.openai.com',
                path: `/v1${path}`,
                method,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
                }
            };

            const req = https.request(reqOptions, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode >= 400) {
                            reject(new Error(`OpenAI ${res.statusCode}: ${json.error?.message || data}`));
                        } else {
                            resolve(json);
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse OpenAI response: ${data.substring(0, 200)}`));
                    }
                });
                res.on('error', reject);
            });

            req.on('error', reject);
            req.setTimeout(options.timeout || 15000, () => {
                req.destroy();
                reject(new Error('OpenAI request timeout'));
            });

            if (bodyStr) req.write(bodyStr);
            req.end();
        });
    }
}

module.exports = OpenAIClient;
