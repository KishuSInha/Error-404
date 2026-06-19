// Use the exposed API from preload
const ipc = window.api;

let openaiClient = null;
let currentScreenshot = null;
let isMonitoring = false;

// Initialize with .env API key if available
const envApiKey = process.env.OPENAI_API_KEY;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Try to use .env key first
    if (envApiKey && envApiKey !== 'your_openai_api_key_here') {
        openaiClient = new OpenAI({
            apiKey: envApiKey,
            dangerouslyAllowBrowser: true
        });
        console.log('✅ OpenAI API key loaded from .env');
    } else {
        loadSettings();
    }

    setupEventListeners();
    setupEventListeners();
    startMonitoring();

    setupEventListeners();
    setupEventListeners();
    startMonitoring();
});

// Load settings from store
function loadSettings() {
    ipc.send('get-settings');
}

ipc.on('settings-loaded', (settings) => {
    if (settings.apiKey && !openaiClient) {
        // We can't use 'require' for OpenAI in renderer without nodeIntegration
        // For now, we'll rely on the main process or extensive preload
        console.log('✅ OpenAI API key loaded from settings');
    }

    if (settings.autoStart) {
        startMonitoring();
    }
});

// Setup event listeners
function setupEventListeners() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const automationBtn = document.getElementById('automation-btn');
    const actionBtn = document.getElementById('action-btn');

    if (analyzeBtn) analyzeBtn.addEventListener('click', analyzeCurrentScreen);
    if (settingsBtn) settingsBtn.addEventListener('click', showSettings);

    if (automationBtn) {
        automationBtn.addEventListener('click', () => {
            alert('Automation workflows coming soon!');
        });
    }

    if (actionBtn) {
        actionBtn.addEventListener('click', () => {
            alert('Action Center is empty right now.');
        });
    }
}

// Start monitoring
function startMonitoring() {
    if (isMonitoring) return;

    isMonitoring = true;
    ipc.send('start-monitoring');
    updateStatus('Monitoring Active', true);
}

// Stop monitoring
function stopMonitoring() {
    isMonitoring = false;
    ipc.send('stop-monitoring');
    updateStatus('Monitoring Paused', false);
}

// Update status indicator
function updateStatus(text, active) {
    const statusText = document.getElementById('status-text');
    const statusDot = document.querySelector('.status-dot');
    if (statusDot) statusDot.style.background = active ? '#10b981' : '#ef4444';
}

// Listen for analysis results (from auto or manual)
ipc.on('analysis-result', (suggestionsText) => {
    updateStatus('Analysis Complete', true);
    const suggestions = parseSuggestions(suggestionsText);
    displaySuggestions(suggestions);
});

// Analyze current screen manually
function analyzeCurrentScreen() {
    updateStatus('Analyzing...', true);
    ipc.send('manual-analysis');
}

// Remove local analyzeScreen function as it's moved to main

function generateMockSuggestions() {
    const titles = [
        "Use Spotlight Search",
        "Clean up Desktop",
        "Enable Do Not Disturb",
        "Organize Windows",
        "Clear Clipboard"
    ];

    const descs = [
        "Press Cmd + Space to launch apps faster.",
        "You have many files on your desktop. Consider grouping them.",
        "Focus mode helps reduce distractions.",
        "Use Rectangle or Magnet to snap windows.",
        "Your clipboard history is getting long."
    ];

    // Pick 2 random suggestions
    const suggestions = [];
    for (let i = 0; i < 2; i++) {
        const idx = Math.floor(Math.random() * titles.length);
        suggestions.push({
            title: titles[idx],
            description: descs[idx],
            category: 'Efficiency'
        });
    }
    return suggestions;
}

// Parse AI response into suggestions
function parseSuggestions(text) {
    const suggestions = [];
    const blocks = text.split('\n\n');

    for (const block of blocks) {
        const titleMatch = block.match(/TITLE:\s*(.+)/);
        const descMatch = block.match(/DESCRIPTION:\s*(.+)/);
        const categoryMatch = block.match(/CATEGORY:\s*(.+)/);

        if (titleMatch && descMatch) {
            suggestions.push({
                title: titleMatch[1].trim(),
                description: descMatch[1].trim(),
                category: categoryMatch ? categoryMatch[1].trim() : 'tip'
            });
        }
    }

    // Fallback parsing if structured format not found
    if (suggestions.length === 0) {
        const lines = text.split('\n').filter(line => line.trim());
        for (let i = 0; i < Math.min(3, lines.length); i++) {
            suggestions.push({
                title: `Suggestion ${i + 1}`,
                description: lines[i],
                category: 'tip'
            });
        }
    }

    return suggestions;
}

// Display suggestions in UI
function displaySuggestions(suggestions) {
    const container = document.getElementById('suggestions-container');
    container.innerHTML = '';

    if (suggestions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✨</div>
                <div class="empty-state-text">No suggestions at the moment</div>
            </div>
        `;
        return;
    }

    suggestions.forEach(suggestion => {
        const div = document.createElement('div');
        div.className = 'suggestion';
        div.innerHTML = `
            <div class="suggestion-title">${escapeHtml(suggestion.title)}</div>
            <div class="suggestion-desc">${escapeHtml(suggestion.description)}</div>
            <span class="suggestion-tag">${escapeHtml(suggestion.category)}</span>
        `;
        container.appendChild(div);
    });
}

// Show error message
function showError(message) {
    const container = document.getElementById('suggestions-container');
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <div class="empty-state-text" style="white-space: pre-line; line-height: 1.6;">${escapeHtml(message)}</div>
        </div>
    `;
}

// Analyze current screen manually
async function analyzeCurrentScreen() {
    if (currentScreenshot) {
        await analyzeScreen(currentScreenshot);
    } else {
        showError('No screen capture available.\n\nPlease grant Screen Recording permission in System Settings.');
    }
}

// Show settings dialog
function showSettings() {
    const currentKey = envApiKey && envApiKey !== 'your_openai_api_key_here' ?
        '(Using .env key)' :
        'Enter your key';

    const apiKey = prompt(`OpenAI API Key:\n\nCurrent: ${currentKey}\n\nEnter new key (or leave blank to keep current):`);

    if (apiKey && apiKey.trim()) {
        ipcRenderer.send('save-settings', {
            apiKey: apiKey.trim(),
            captureInterval: 3000,
            autoStart: true
        });

        openaiClient = new OpenAI({
            apiKey: apiKey.trim(),
            dangerouslyAllowBrowser: true
        });

        alert('✅ API Key saved!\n\nThe app will now use this key for analysis.');
    }
}

// Utility: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
