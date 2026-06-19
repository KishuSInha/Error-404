const http = require('http');

class OllamaClient {
    constructor() {
        this.host = '127.0.0.1';
        this.port = 11434;
        this.availableModels = [];
        this.currentModel = null;
    }

    async getAvailableModels() {
        if (this.availableModels.length > 0) {
            return this.availableModels;
        }

        return new Promise((resolve) => {
            const req = http.get({
                hostname: this.host,
                port: this.port,
                path: '/api/tags'
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.models && Array.isArray(parsed.models)) {
                            this.availableModels = parsed.models.map(m => m.name.replace(':latest', ''));
                            resolve(this.availableModels);
                        } else {
                            this.availableModels = ['llava'];
                            resolve(this.availableModels);
                        }
                    } catch (e) {
                        this.availableModels = ['llava'];
                        resolve(this.availableModels);
                    }
                });
            });
            req.on('error', () => {
                this.availableModels = ['llava'];
                resolve(this.availableModels);
            });
            req.setTimeout(5000, () => {
                req.destroy();
                this.availableModels = ['llava'];
                resolve(this.availableModels);
            });
        });
    }

    async getBestModel() {
        if (!this.currentModel) {
            const models = await this.getAvailableModels();
            // Prefer text models over vision models
            const textModels = ['mistral', 'llama3', 'llama2', 'phi', 'codellama'];
            const foundTextModel = models.find(m => textModels.includes(m));
            this.currentModel = foundTextModel || models[0] || 'llava';
        }
        return this.currentModel;
    }

    async isAvailable() {
        return new Promise((resolve) => {
            const req = http.get({
                hostname: this.host,
                port: this.port,
                path: '/'
            }, (res) => {
                resolve(res.statusCode === 200 || res.statusCode === 404);
            });
            req.on('error', () => resolve(false));
            req.setTimeout(3000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    async generate(prompt, options = {}) {
        const model = options.model || await this.getBestModel();
        const temperature = options.temperature || 0.3;
        const maxTokens = options.maxTokens || 500;

        const payload = JSON.stringify({
            model: model,
            prompt: prompt,
            stream: false
        });

        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: this.host,
                port: this.port,
                path: '/api/generate',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                },
                timeout: 120000
            }, (res) => {
                let responseBody = '';
                res.on('data', (chunk) => responseBody += chunk);
                res.on('end', () => {
                    if (res.statusCode === 400) {
                        try {
                            const err = JSON.parse(responseBody);
                            reject(new Error(err.error || `Model '${model}' not found. Run: ollama pull ${model}`));
                        } catch (e) {
                            reject(new Error(`Model '${model}' not found. Run: ollama pull ${model}`));
                        }
                        return;
                    }
                    if (res.statusCode !== 200) {
                        reject(new Error(`Ollama returned status ${res.statusCode}`));
                        return;
                    }
                    try {
                        const parsed = JSON.parse(responseBody);
                        if (parsed.response) {
                            resolve(parsed.response.trim());
                        } else if (parsed.error) {
                            reject(new Error(parsed.error));
                        } else {
                            reject(new Error('No response from Ollama'));
                        }
                    } catch (e) {
                        reject(new Error('Failed to parse Ollama response'));
                    }
                });
            });

            req.on('error', (e) => reject(e));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Ollama request timeout'));
            });
            req.write(payload);
            req.end();
        });
    }

    async chat(messages, options = {}) {
        const model = options.model || await this.getBestModel();

        const payload = JSON.stringify({
            model: model,
            messages: messages,
            stream: false
        });

        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: this.host,
                port: this.port,
                path: '/api/chat',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                },
                timeout: 120000
            }, (res) => {
                let responseBody = '';
                res.on('data', (chunk) => responseBody += chunk);
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`Ollama returned status ${res.statusCode}`));
                        return;
                    }
                    try {
                        const parsed = JSON.parse(responseBody);
                        if (parsed.message && parsed.message.content) {
                            resolve(parsed.message.content.trim());
                        } else if (parsed.error) {
                            reject(new Error(parsed.error));
                        } else {
                            reject(new Error('No response from Ollama'));
                        }
                    } catch (e) {
                        reject(new Error('Failed to parse Ollama response'));
                    }
                });
            });

            req.on('error', (e) => reject(e));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Ollama request timeout'));
            });
            req.write(payload);
            req.end();
        });
    }

    async warmup() {
        try {
            const model = await this.getBestModel();
            await this.generate('Hello', { model, maxTokens: 5 });
            console.log(`[OLLAMA] Model ${model} warmed up`);
        } catch (e) {
            console.log('[OLLAMA] Warmup failed:', e.message);
        }
    }
}

module.exports = OllamaClient;
