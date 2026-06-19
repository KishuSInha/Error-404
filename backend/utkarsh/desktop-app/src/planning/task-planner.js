/**
 * Task Planner — Metrixa AI
 * Converts user intent into a structured execution plan
 * Supports all app integrations: Notes, iMessage, Reminders, Calendar, Mail, Slack, Music, Browser
 */

const LLMRouter = require('../ai/llm-router');

class TaskPlanner {
    constructor() {
        this.llm = new LLMRouter();
    }

    /**
     * Check if request matches a known template (faster, no LLM needed)
     */
    matchTemplate(intent) {
        const lower = intent.toLowerCase().trim();

        // Reminders
        if (/remind|reminder|remember to|don.t forget/.test(lower)) {
            const nameMatch = intent.match(/remind(?:er)? (?:me )?(?:to )?["']?(.+?)["']?(?:\s+(?:at|on|by|tomorrow|tonight|today).*)?$/i);
            return this.makeTemplate('create_reminder', [
                { id: 1, action: 'CREATE_REMINDER', description: 'Create reminder', params: { name: nameMatch?.[1] || intent } }
            ]);
        }

        // iMessage / Message
        if (/send (?:a )?(?:message|imessage|text|iMessage) to|text (?:me to )?|message (?:me )?/.test(lower)) {
            const toMatch = intent.match(/(?:message|text|send.*?to)\s+([^:,]+?)(?:\s+saying|\s+that|\s+about|:|\s*$)/i);
            const msgMatch = intent.match(/saying\s+(.+)$/i);
            return this.makeTemplate('send_imessage', [
                { id: 1, action: 'SEND_IMESSAGE', description: 'Send iMessage', params: { to: toMatch?.[1]?.trim() || '', message: msgMatch?.[1] || '' } }
            ]);
        }

        // Notes
        if (/create (?:a )?note|add (?:to )?notes|save (?:to )?notes|write (?:a )?note/.test(lower)) {
            const titleMatch = intent.match(/note (?:about|called|titled|named)?\s+["']?(.+?)["']?(?:\s+(?:with|containing|that says)|$)/i);
            return this.makeTemplate('create_note', [
                { id: 1, action: 'READ_SCREEN', description: 'Read screen content', params: {} },
                { id: 2, action: 'CREATE_NOTE', description: 'Create note', params: { title: titleMatch?.[1] || 'Metrixa Note' } }
            ]);
        }

        // Calendar event
        if (/(?:add|create|schedule|set up) (?:a )?(?:meeting|event|appointment|calendar)/.test(lower)) {
            const titleMatch = intent.match(/(?:meeting|event|appointment|calendar entry|called|titled|named|for)\s+["']?(.+?)["']?(?:\s+(?:at|on|tomorrow|today|with)|$)/i);
            const timeMatch = intent.match(/at (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
            return this.makeTemplate('create_event', [
                { id: 1, action: 'CREATE_CALENDAR_EVENT', description: 'Create calendar event', params: { title: titleMatch?.[1] || intent, start_date: timeMatch?.[1] || '' } }
            ]);
        }

        // Today's calendar
        if (/what.s on my calendar|show (?:my )?calendar|today.s events|my schedule/.test(lower)) {
            return this.makeTemplate('get_events', [
                { id: 1, action: 'GET_CALENDAR_EVENTS', description: 'Get today\'s events', params: {} }
            ]);
        }

        // Send email
        if (/send (?:an? )?email|draft (?:an? )?email|compose (?:an? )?email|email to/.test(lower)) {
            const toMatch = intent.match(/(?:email|mail) (?:to )?([^\s]+@[^\s]+|[A-Z][a-z]+ [A-Z][a-z]+)/i);
            const subjectMatch = intent.match(/(?:about|re:|subject:?)\s+["']?(.+?)["']?(?:\s+saying|$)/i);
            return this.makeTemplate('send_email', [
                { id: 1, action: 'SEND_EMAIL', description: 'Send email', params: { to: toMatch?.[1] || '', subject: subjectMatch?.[1] || intent } }
            ]);
        }

        // Play music
        if (/play (?:some )?(?:music|song|track|playlist)|pause music|stop music/.test(lower)) {
            const songMatch = intent.match(/play (?:the song |track |)["']?(.+?)["']?(?:\s|$)/i);
            const action = /pause|stop/.test(lower) ? 'PAUSE_MUSIC' : 'PLAY_MUSIC';
            return this.makeTemplate('music', [
                { id: 1, action, description: 'Control music', params: { track: songMatch?.[1] || '' } }
            ]);
        }

        // Open app
        if (/open (?:the )?app\b|launch\b|open\s+\w+/.test(lower) && !/open url|open link|open website/.test(lower)) {
            const appMatch = intent.match(/(?:open|launch)\s+(?:the\s+)?(\w[\w\s]*?)(?:\s+app)?$/i);
            if (appMatch) {
                return this.makeTemplate('open_app', [
                    { id: 1, action: 'OPEN_APP', description: `Open ${appMatch[1]}`, params: { app: appMatch[1] } }
                ]);
            }
        }

        // Google search
        if (/(?:google|search (?:the web|online)?|look up|find) .+/i.test(lower)) {
            const queryMatch = intent.match(/(?:google|search (?:the web|online|for)?|look up|find)\s+(.+)/i);
            return this.makeTemplate('google_search', [
                { id: 1, action: 'GOOGLE_SEARCH', description: 'Google search', params: { query: queryMatch?.[1] || intent } }
            ]);
        }

        // Copy to clipboard
        if (/copy (?:this|that|the|to clipboard)|put (?:this|it) in (?:my )?clipboard/.test(lower)) {
            return this.makeTemplate('copy_clipboard', [
                { id: 1, action: 'READ_SCREEN', description: 'Read screen', params: {} },
                { id: 2, action: 'COPY_TO_CLIPBOARD', description: 'Copy to clipboard', params: {} }
            ]);
        }

        // Add task to reminders from screen
        if (/extract tasks|action items|to.do|find tasks/.test(lower)) {
            return this.makeTemplate('extract_tasks', [
                { id: 1, action: 'READ_SCREEN', description: 'Read screen', params: {} },
                { id: 2, action: 'EXTRACT_TASKS', description: 'Extract action items', params: {} }
            ]);
        }

        // Summarize (simple)
        if (/summarize|summary|summarise|tldr|brief|recap|digest/.test(lower)) {
            return this.makeTemplate('summarize', [
                { id: 1, action: 'READ_SCREEN', description: 'Read screen content', params: {} },
                { id: 2, action: 'SUMMARIZE', description: intent, params: { query: intent } }
            ]);
        }

        // Explain
        if (/explain|what is|what does|meaning of|define|describe|tell me about/.test(lower)) {
            return this.makeTemplate('explain', [
                { id: 1, action: 'READ_SCREEN', description: 'Read visible content', params: {} },
                { id: 2, action: 'ANSWER', description: intent, params: { question: intent } }
            ]);
        }

        return null;
    }

    makeTemplate(intentName, steps) {
        return {
            intent: intentName,
            steps: steps.map((s, i) => ({
                id: s.id || i + 1,
                action: s.action,
                description: s.description,
                requires: [],
                verifiable: true,
                params: s.params || {}
            })),
            risks: [],
            estimated_time: '5-10 seconds',
            created_at: Date.now(),
            status: 'pending_approval',
            version: 1,
            isTemplate: true
        };
    }

    /**
     * Main entry: create plan from user intent
     */
    async createPlan(userIntent, context) {
        try {
            console.log('[TASK PLANNER] Creating plan for:', userIntent);

            // Try template matching first (instantaneous)
            const template = this.matchTemplate(userIntent);
            if (template) {
                console.log('[TASK PLANNER] Template matched:', template.intent);
                template.context = context;
                return template;
            }

            // Use LLM for complex requests
            console.log('[TASK PLANNER] Using LLM for planning...');
            const prompt = this.buildPlanningPrompt(userIntent, context);
            const response = await this.llm.route(prompt, 'medium', {
                temperature: 0.2,
                maxTokens: 800
            });

            const plan = this.parsePlan(response, userIntent);
            plan.context = context;

            console.log('[TASK PLANNER] LLM plan created with', plan.steps.length, 'steps');
            return plan;
        } catch (error) {
            console.error('[TASK PLANNER] Failed:', error);
            return this.createDirectPlan(userIntent, context);
        }
    }

    buildPlanningPrompt(userIntent, context) {
        const ctx = this.summarizeContext(context);
        return `You are an AI task planner for a macOS desktop assistant called Metrixa AI.

USER INTENT: "${userIntent}"

CONTEXT:
${ctx}

AVAILABLE ACTIONS (use ONLY these):
READ_SCREEN - Read text from screen using OCR
READ_SELECTION - Get currently selected text
SUMMARIZE - Summarize content (uses AI)
ANSWER - Answer a question about visible content
EXTRACT_TASKS - Extract action items from content
EXTRACT_DATA - Extract structured data
OPEN_APP - Open a macOS app (params: {app: "App Name"})
NAVIGATE - Open a URL (params: {url: "https://..."})
GOOGLE_SEARCH - Search Google (params: {query: "..."})
FIND_FILE - Find file with Spotlight (params: {name: "filename"})
SEARCH_SPOTLIGHT - Open Spotlight search (params: {query: "..."})
INPUT_TEXT - Type text in active field (params: {text: "..."})
TYPE_IN_APP - Type in specific app (params: {app: "App", text: "..."})
CLICK - Click at coordinates (params: {x: 0, y: 0})
COPY_TO_CLIPBOARD - Copy text to clipboard (params: {text: "..."})
GET_CLIPBOARD - Get clipboard content
CREATE_NOTE - Create Apple Note (params: {title: "...", content: "..."})
CREATE_REMINDER - Create Reminder (params: {name: "...", due_date: "..."})
CREATE_CALENDAR_EVENT - Create event (params: {title: "...", start_date: "...", end_date: "..."})
GET_CALENDAR_EVENTS - Get today's events
SEND_EMAIL - Draft email (params: {to: "...", subject: "...", body: "..."})
READ_LATEST_EMAIL - Read latest email
SEND_IMESSAGE - Send iMessage (params: {to: "...", message: "..."})
READ_IMESSAGE - Read messages (params: {contact: "..."})
PLAY_MUSIC - Play music (params: {track: "...", playlist: "..."})
PAUSE_MUSIC - Pause music
SLACK_OPEN_CHANNEL - Open Slack channel (params: {channel: "#name"})
WAIT - Wait before next step (params: {duration_ms: 1000})

Create a plan using ONLY the actions above. 
Return ONLY valid JSON (no markdown, no explanations):
{"intent":"short_description","steps":[{"id":1,"action":"ACTION_NAME","description":"what this step does","requires":[],"verifiable":true,"params":{}}],"risks":[],"estimated_time":"X seconds"}`;
    }

    summarizeContext(context) {
        if (!context) return 'Context: Unknown';
        const parts = [];
        const appName = context.app?.name || context.appName || 'Unknown';
        parts.push(`Active App: ${appName}`);
        if (context.appType) parts.push(`App Type: ${context.appType}`);
        if (context.window?.title) parts.push(`Window: ${context.window.title}`);
        if (context.selection?.length > 0) parts.push(`Selected text: "${context.selection.substring(0, 200)}"`);
        if (context.visibleText?.length > 20) parts.push(`Visible text preview: "${context.visibleText.substring(0, 300)}"`);
        return parts.join('\n');
    }

    parsePlan(llmResponse, userIntent) {
        try {
            let cleaned = llmResponse
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .replace(/,(\s*[}\]])/g, '$1');

            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON found');

            const plan = JSON.parse(jsonMatch[0]);
            this.validatePlan(plan);

            plan.created_at = Date.now();
            plan.status = 'pending_approval';
            plan.version = 1;

            plan.steps = plan.steps.map((step, index) => ({
                id: step.id || index + 1,
                action: step.action,
                description: step.description,
                requires: step.requires || [],
                verifiable: step.verifiable !== false,
                params: step.params || {}
            }));

            return plan;
        } catch (error) {
            console.error('[TASK PLANNER] Parse error:', error);
            return this.createFallbackPlan(userIntent);
        }
    }

    createDirectPlan(userIntent, context) {
        return {
            intent: userIntent,
            steps: [
                { id: 1, action: 'READ_SCREEN', description: 'Read screen', requires: [], verifiable: true, params: {} },
                { id: 2, action: 'SUMMARIZE', description: userIntent, requires: [], verifiable: true, params: { query: userIntent } }
            ],
            risks: [],
            estimated_time: '10 seconds',
            created_at: Date.now(),
            status: 'pending_approval',
            version: 1,
            isDirect: true
        };
    }

    createFallbackPlan(userIntent) {
        return {
            intent: 'direct_response',
            steps: [
                { id: 1, action: 'ANSWER', description: userIntent, requires: [], verifiable: true, params: { question: userIntent } }
            ],
            risks: [],
            estimated_time: '5 seconds',
            created_at: Date.now(),
            status: 'pending_approval',
            version: 1,
            isFallback: true
        };
    }

    validatePlan(plan) {
        if (!plan.steps || !Array.isArray(plan.steps) || plan.steps.length === 0) {
            throw new Error('Plan must have a non-empty steps array');
        }
        plan.steps.forEach((step, i) => {
            if (!step.action) throw new Error(`Step ${i + 1} missing action`);
        });
        if (!plan.intent) plan.intent = 'task';
    }

    editPlan(plan, edits) {
        const modified = JSON.parse(JSON.stringify(plan));
        edits.forEach(edit => {
            if (edit.type === 'remove_step') {
                modified.steps = modified.steps.filter(s => s.id !== edit.stepId);
            } else if (edit.type === 'modify_step') {
                const step = modified.steps.find(s => s.id === edit.stepId);
                if (step && edit.field) step[edit.field] = edit.value;
            } else if (edit.type === 'add_step' && edit.step) {
                const newId = Math.max(...modified.steps.map(s => s.id), 0) + 1;
                modified.steps.push({ id: newId, ...edit.step });
            } else if (edit.type === 'reorder_steps' && edit.newOrder) {
                const reordered = [];
                edit.newOrder.forEach(id => {
                    const s = modified.steps.find(st => st.id === id);
                    if (s) reordered.push(s);
                });
                modified.steps = reordered;
            }
        });
        modified.steps.forEach((s, i) => { s.id = i + 1; });
        modified.version = (modified.version || 1) + 1;
        modified.modified_at = Date.now();
        return modified;
    }
}

module.exports = TaskPlanner;
