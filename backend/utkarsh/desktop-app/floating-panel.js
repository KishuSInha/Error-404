/**
 * Floating Panel Logic — Metrixa AI
 * Supports: streaming responses, step-by-step progress, context detection, quick chips
 */

const { ipcRenderer } = require('electron');

window.onerror = (msg, src, line) => {
    console.error('[PANEL ERROR]', msg, 'at', src, ':', line);
    return true;
};

let currentContext = null;
let isProcessing = false;
let hasMessages = false;
let currentAiBubble = null;
let currentPlanSteps = null;

const $ = id => document.getElementById(id);

const closeBtn           = $('closeBtn');
const minimizeBtn        = $('minimizeBtn');
const taskInput          = $('taskInput');
const sendBtn            = $('sendBtn');
const messagesContainer  = $('messagesContainer');
const welcomeContainer   = $('welcomeContainer');
const contextAppName     = $('contextAppName');
const quickChips         = $('quickChips');

// ========================
// Init
// ========================
document.addEventListener('DOMContentLoaded', () => {
    loadContext();
    setupEventListeners();
    taskInput.focus();
});

function setupEventListeners() {
    closeBtn.addEventListener('click', () => ipcRenderer.send('hide-floating-panel'));
    minimizeBtn.addEventListener('click', () => ipcRenderer.send('minimize-floating-panel'));

    sendBtn.addEventListener('click', handleSend);

    taskInput.addEventListener('input', autoResize);
    taskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (isProcessing) {
                // Stop processing
                stopProcessing();
            } else {
                handleSend();
            }
        }
        if (e.key === 'Escape') ipcRenderer.send('hide-floating-panel');
    });

    // Quick chips
    if (quickChips) {
        quickChips.querySelectorAll('.quick-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const query = chip.dataset.query;
                if (query) {
                    taskInput.value = query;
                    autoResize();
                    handleSend();
                }
            });
        });
    }
}

function autoResize() {
    taskInput.style.height = 'auto';
    const h = Math.min(taskInput.scrollHeight, 160);
    taskInput.style.height = h + 'px';
    sendBtn.disabled = taskInput.value.trim().length === 0 || isProcessing;
}

// ========================
// Context
// ========================
async function loadContext() {
    try {
        const result = await ipcRenderer.invoke('detect-context');
        if (result?.success && result.data) {
            currentContext = result.data;
            displayContext(currentContext);
        }
    } catch (e) {
        console.error('[PANEL] Context load failed:', e.message);
    }
}

function displayContext(context) {
    if (!context?.app?.name) {
        contextAppName.textContent = 'Ready';
        return;
    }
    const appName = context.app.name;
    contextAppName.textContent = appName;
}

// ========================
// Messages
// ========================
function hideWelcome() {
    if (!hasMessages && welcomeContainer) {
        welcomeContainer.classList.add('hidden');
        hasMessages = true;
    }
}

function addUserMessage(text) {
    hideWelcome();
    const div = document.createElement('div');
    div.className = 'message user';
    div.innerHTML = `<div class="message-bubble">${escHtml(text)}</div>`;
    messagesContainer.appendChild(div);
    scrollToBottom();
    return div;
}

function createAiMessage() {
    hideWelcome();
    const div = document.createElement('div');
    div.className = 'message ai';
    div.innerHTML = `<div class="message-bubble" id="aiBubble-${Date.now()}"></div>`;
    messagesContainer.appendChild(div);
    scrollToBottom();
    return div;
}

function showStatusLine(msgDiv, text) {
    const bubble = msgDiv.querySelector('.message-bubble');
    bubble.innerHTML = `<div class="status-line"><div class="status-spinner"></div><span>${escHtml(text)}</span></div>`;
}

function showPlanSteps(msgDiv, steps) {
    const bubble = msgDiv.querySelector('.message-bubble');
    const stepsHtml = steps.map(s =>
        `<div class="plan-step" id="step-${s.id}" data-id="${s.id}">
            <div class="step-icon">○</div>
            <span>${escHtml(s.description || s.action)}</span>
        </div>`
    ).join('');
    bubble.innerHTML = `<div class="plan-steps">${stepsHtml}</div>`;
    scrollToBottom();
}

function updateStepStatus(stepId, status, label) {
    const el = document.getElementById(`step-${stepId}`);
    if (!el) return;
    el.className = `plan-step ${status}`;
    const icon = el.querySelector('.step-icon');
    if (status === 'running')  icon.textContent = '';
    if (status === 'done')     icon.textContent = '✓';
    if (status === 'error')    icon.textContent = '✗';
    if (label) el.querySelector('span').textContent = label;
}

function renderMarkdown(text) {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:#f4f4f4;padding:1px 5px;border-radius:4px;font-size:0.9em">$1</code>')
        .replace(/\n• /g, '\n<br>• ')
        .replace(/\n/g, '<br>');
}

// ========================
// Main Send Handler
// ========================
async function handleSend() {
    const text = taskInput.value.trim();
    if (!text || isProcessing) return;

    setProcessing(true);
    addUserMessage(text);
    taskInput.value = '';
    autoResize();

    const aiMsgDiv = createAiMessage();
    showStatusLine(aiMsgDiv, 'Thinking...');

    try {
        // Refresh context
        const freshCtx = await ipcRenderer.invoke('detect-context').catch(() => ({ success: false }));
        if (freshCtx?.success && freshCtx.data) {
            currentContext = freshCtx.data;
            displayContext(currentContext);
        }

        // Create plan
        showStatusLine(aiMsgDiv, 'Planning steps...');
        const planResult = await ipcRenderer.invoke('create-plan', {
            intent: text,
            context: currentContext
        });

        if (!planResult.success) throw new Error(planResult.error || 'Planning failed');

        const plan = planResult.data;

        // Show plan steps
        if (plan.steps && plan.steps.length > 1) {
            showPlanSteps(aiMsgDiv, plan.steps);
            await new Promise(r => setTimeout(r, 300));
        } else {
            showStatusLine(aiMsgDiv, 'Working on it...');
        }

        // Execute plan
        const execResult = await ipcRenderer.invoke('execute-plan', {
            plan,
            context: currentContext
        });

        if (!execResult.success) throw new Error(execResult.error || 'Execution failed');

        // Show result
        const bubble = aiMsgDiv.querySelector('.message-bubble');
        const summary = execResult.summary || 'Done!';
        bubble.innerHTML = renderMarkdown(summary);

    } catch (error) {
        const bubble = aiMsgDiv.querySelector('.message-bubble');
        bubble.innerHTML = `<span style="color:#ff3b30">⚠️ ${escHtml(error.message)}</span>
            <br><br><span style="color:#888;font-size:13px">Make sure Ollama is running or add an OpenAI API key.</span>`;
    } finally {
        setProcessing(false);
        scrollToBottom();
    }
}

function stopProcessing() {
    setProcessing(false);
}

function setProcessing(processing) {
    isProcessing = processing;
    taskInput.disabled = processing;
    sendBtn.disabled = processing || taskInput.value.trim().length === 0;
    if (processing) {
        sendBtn.classList.add('stop');
        sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>`;
    } else {
        sendBtn.classList.remove('stop');
        sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
        taskInput.focus();
    }
}

function scrollToBottom() {
    setTimeout(() => {
        messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
    }, 30);
}

function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ========================
// Step Progress Updates
// ========================
ipcRenderer.on('step-progress', (event, { stepId, status, data }) => {
    if (status === 'running') {
        updateStepStatus(stepId, 'running', data?.description || data?.action);
    } else if (status === 'done') {
        const label = data?.summary || data?.description || 'Done';
        updateStepStatus(stepId, 'done', label.substring(0, 60));
    } else if (status === 'error') {
        updateStepStatus(stepId, 'error', data?.error || 'Error');
    }
    scrollToBottom();
});

// ========================
// Stream chunks (for streaming responses)
// ========================
ipcRenderer.on('stream-chunk', (event, chunk) => {
    if (!currentAiBubble) return;
    const bubble = currentAiBubble.querySelector('.message-bubble');
    if (!bubble) return;
    bubble.innerHTML += escHtml(chunk);
    scrollToBottom();
});

// Refresh on panel show
ipcRenderer.on('panel-show', () => {
    loadContext();
    taskInput.focus();
});

// Context updates
ipcRenderer.on('context-updated', (event, context) => {
    currentContext = context;
    displayContext(context);
});

// Keepalive
setInterval(() => ipcRenderer.send('panel-ping'), 5000);
