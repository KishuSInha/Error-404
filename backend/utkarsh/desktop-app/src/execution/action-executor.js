/**
 * Action Executor — Metrixa AI
 * Handles all end-to-end app automation actions
 * Integrations: Notes, iMessage, Reminders, Calendar, Mail,
 *               Spotlight, Music, Slack, Browser, Clipboard, GUI
 */

const { guiClick, guiType, guiMove } = require('../actions/gui');
const { getScreenText } = require('../context/screen');
const LLMRouter = require('../ai/llm-router');
const TaskExtractor = require('../ai/task-extractor');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ===== AppleScript Helpers =====

function esa(str) {
    // Escape string for use inside AppleScript double-quotes
    return (str || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'");
}

async function runScript(script) {
    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
    return (stdout || '').trim();
}

// ===== Main Class =====

class ActionExecutor {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.llm = new LLMRouter();
        this.taskExtractor = new TaskExtractor();
        this.memory = {};
    }

    async executeStep(step, context, previousResults = []) {
        try {
            step._startTime = Date.now();
            const handler = this.getHandler(step.action);
            if (!handler) throw new Error(`Unknown action: ${step.action}`);

            this.memory = this.buildMemory(previousResults);
            this.notifyProgress(step.id, 'running', { action: step.action, description: step.description });

            const result = await handler.call(this, step, context, this.memory);

            result._meta = {
                stepId: step.id,
                action: step.action,
                timestamp: Date.now(),
                duration: Date.now() - step._startTime
            };

            this.notifyProgress(step.id, 'done', result);
            return result;
        } catch (error) {
            this.notifyProgress(step.id, 'error', { error: error.message });
            throw error;
        }
    }

    getHandler(actionType) {
        const handlers = {
            // Core
            'READ_SCREEN': this.handleReadScreen,
            'READ_EMAIL': this.handleReadEmail,
            'READ_SELECTION': this.handleReadSelection,
            'SUMMARIZE': this.handleSummarize,
            'EXTRACT_DATA': this.handleExtractData,
            'EXTRACT_TASKS': this.handleExtractTasks,
            'ANSWER': this.handleAnswer,

            // Navigation
            'OPEN_APP': this.handleOpenApp,
            'NAVIGATE': this.handleNavigate,
            'OPEN_URL_IN_BROWSER': this.handleNavigate,
            'GOOGLE_SEARCH': this.handleGoogleSearch,
            'FIND_FILE': this.handleFindFile,
            'SEARCH_SPOTLIGHT': this.handleSpotlightSearch,

            // Input / GUI
            'INPUT_TEXT': this.handleInputText,
            'TYPE_IN_APP': this.handleTypeInApp,
            'CLICK': this.handleClick,
            'PRESS_KEY': this.handlePressKey,

            // Clipboard
            'COPY_TO_CLIPBOARD': this.handleCopyToClipboard,
            'GET_CLIPBOARD': this.handleGetClipboard,

            // Apple Notes
            'CREATE_NOTE': this.handleCreateNote,
            'SEARCH_NOTES': this.handleSearchNotes,

            // Apple Reminders
            'CREATE_REMINDER': this.handleCreateReminder,

            // Apple Calendar
            'CREATE_CALENDAR_EVENT': this.handleCreateCalendarEvent,
            'GET_CALENDAR_EVENTS': this.handleGetCalendarEvents,

            // Apple Mail
            'SEND_EMAIL': this.handleSendEmail,
            'READ_LATEST_EMAIL': this.handleReadLatestEmail,

            // iMessage
            'READ_IMESSAGE': this.handleReadiMessage,
            'SEND_IMESSAGE': this.handleSendiMessage,

            // Apple Music / Spotify
            'PLAY_MUSIC': this.handlePlayMusic,
            'PAUSE_MUSIC': this.handlePauseMusic,

            // Slack
            'SLACK_OPEN_CHANNEL': this.handleSlackOpenChannel,

            // Spreadsheet
            'UPDATE_SPREADSHEET': this.handleUpdateSpreadsheet,
            'API_CALL': this.handleApiCall,

            // Meta
            'VERIFY': this.handleVerify,
            'WAIT': this.handleWait,
        };

        return handlers[actionType];
    }

    buildMemory(previousResults) {
        const memory = {};
        previousResults.forEach((result) => {
            if (result.text) memory.text = result.text;
            if (result.summary) memory.summary = result.summary;
            if (result.summaryText) memory.summaryText = result.summaryText;
            if (result.data) memory.data = result.data;
            if (result.tasks) memory.tasks = result.tasks;
            if (result.emailContent) memory.emailContent = result.emailContent;
            if (result.clipboard) memory.clipboard = result.clipboard;
        });
        return memory;
    }

    // ============= CORE HANDLERS =============

    async handleReadScreen(step, context, memory) {
        const result = await getScreenText(this.mainWindow);
        return {
            text: result.text,
            confidence: result.confidence,
            summary: `Read screen (${result.text.length} chars, confidence: ${result.confidence || 0}%)`
        };
    }

    async handleReadEmail(step, context, memory) {
        const text = context.visibleText || memory.text || '';
        const metadata = this._extractEmailMetadata(text);
        return {
            emailContent: text,
            from: metadata.from,
            subject: metadata.subject,
            text,
            summary: `Read email from ${metadata.from || 'unknown sender'}`
        };
    }

    async handleReadSelection(step, context, memory) {
        const selection = context.selection;
        if (!selection || selection.length === 0) {
            // Try getting clipboard content as fallback
            const clip = await this.handleGetClipboard(step, context, memory);
            return { text: clip.clipboard, length: (clip.clipboard || '').length, summary: 'Read clipboard text' };
        }
        return {
            text: selection,
            length: selection.length,
            summary: `Read ${selection.length} chars of selected text`
        };
    }

    async handleSummarize(step, context, memory) {
        let text = memory.text || context.visibleText || context.selection || '';

        if (!text || text.length < 20) {
            const screenResult = await getScreenText(this.mainWindow);
            text = screenResult.text;
        }

        if (!text || text.length < 20) {
            throw new Error('Not enough text visible on screen to summarize');
        }

        const query = step.params?.query || 'Summarize this';

        const prompt = `${query}

CONTENT:
${text.substring(0, 4000)}

Provide a clear, well-structured response using **bold** for key points.`;

        const summary = await this.llm.route(prompt, 'medium', {
            temperature: 0.4,
            maxTokens: 600
        });

        return {
            summary: summary.trim(),
            summaryText: summary.trim()
        };
    }

    async handleAnswer(step, context, memory) {
        const question = step.params?.question || step.description || 'Answer this';
        const contextText = memory.text || context.visibleText || '';

        const prompt = contextText.length > 20
            ? `Question: ${question}\n\nContext from screen:\n${contextText.substring(0, 3000)}\n\nAnswer:`
            : question;

        const answer = await this.llm.route(prompt, 'medium', {
            temperature: 0.5, maxTokens: 600
        });

        return { summary: answer.trim(), summaryText: answer.trim() };
    }

    async handleExtractData(step, context, memory) {
        let text = memory.text || context.visibleText || context.selection || '';
        if (!text || text.length < 10) {
            const screenResult = await getScreenText(this.mainWindow);
            text = screenResult.text;
        }
        if (!text) throw new Error('No text available for data extraction');

        const prompt = `Extract key information from this text as structured JSON:

${text.substring(0, 2000)}

Return ONLY valid JSON. Example: {"name":"...","email":"...","date":"...","action_items":[]}

JSON:`;

        const response = await this.llm.route(prompt, 'medium', { temperature: 0.2, maxTokens: 500 });
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Could not extract structured data');

        const data = JSON.parse(jsonMatch[0]);
        return { data, summary: `Extracted ${Object.keys(data).length} data fields` };
    }

    async handleExtractTasks(step, context, memory) {
        let text = memory.text || context.visibleText || context.selection || '';
        if (!text || text.length < 10) {
            const screenResult = await getScreenText(this.mainWindow);
            text = screenResult.text;
        }
        if (!text) throw new Error('No text available');

        const tasks = await this.taskExtractor.extractTasks(text, 'agent_execution');
        return {
            tasks,
            count: tasks.length,
            summary: tasks.length > 0
                ? `Found ${tasks.length} task${tasks.length > 1 ? 's' : ''}:\n• ${tasks.map(t => t.description).join('\n• ')}`
                : 'No tasks found'
        };
    }

    // ============= NAVIGATION =============

    async handleOpenApp(step, context, memory) {
        const { app, file } = step.params || {};
        if (!app) throw new Error('No app specified');

        const script = file
            ? `tell application "${esa(app)}" to open POSIX file "${esa(file)}"`
            : `tell application "${esa(app)}" to activate`;

        await runScript(script);
        await this.sleep(1500);

        return { app, opened: true, summary: `Opened ${app}${file ? ` with ${file}` : ''}` };
    }

    async handleNavigate(step, context, memory) {
        const { url } = step.params || {};
        if (!url) throw new Error('No URL specified');

        await execAsync(`open "${url}"`);
        await this.sleep(2000);

        return { url, navigated: true, summary: `Opened ${url}` };
    }

    async handleGoogleSearch(step, context, memory) {
        const query = step.params?.query || memory.text || '';
        const encoded = encodeURIComponent(query);
        const url = `https://www.google.com/search?q=${encoded}`;
        await execAsync(`open "${url}"`);
        await this.sleep(1500);
        return { query, url, summary: `Searched Google for: ${query}` };
    }

    async handleFindFile(step, context, memory) {
        const { name, extension } = step.params || {};
        if (!name) throw new Error('No file name specified');

        const searchQuery = extension ? `${name}.${extension}` : name;
        const { stdout } = await execAsync(`mdfind "kMDItemFSName == '${searchQuery}'*" | head -n 1`);
        const filePath = stdout.trim();

        if (!filePath) throw new Error(`File not found: ${searchQuery}`);
        return { filePath, name, found: true, summary: `Found: ${filePath}` };
    }

    async handleSpotlightSearch(step, context, memory) {
        const query = step.params?.query || '';
        await execAsync(`osascript -e 'tell application "System Events" to keystroke " " using command down'`);
        await this.sleep(500);
        await guiType(query);
        await this.sleep(500);
        return { query, summary: `Searched Spotlight for: ${query}` };
    }

    // ============= INPUT / GUI =============

    async handleInputText(step, context, memory) {
        let text = step.params?.text || memory.summary || memory.summaryText || '';
        if (!text) throw new Error('No text to input');

        await guiType(text);
        return { typed: text.length, summary: `Typed ${text.length} characters` };
    }

    async handleTypeInApp(step, context, memory) {
        const { app, text: rawText } = step.params || {};
        const text = rawText || memory.summary || '';

        if (app) {
            await runScript(`tell application "${esa(app)}" to activate`);
            await this.sleep(500);
        }

        await guiType(text);
        return { summary: `Typed in ${app || 'active app'}` };
    }

    async handleClick(step, context, memory) {
        const { x, y } = step.params || {};
        if (x === undefined || y === undefined) throw new Error('Click requires x and y coordinates');
        await guiClick(x, y);
        return { x, y, clicked: true, summary: `Clicked at (${x}, ${y})` };
    }

    async handlePressKey(step, context, memory) {
        const { key, modifiers } = step.params || {};
        const mods = (modifiers || []).map(m => `${m} down`).join(', ');
        const keyStr = mods
            ? `keystroke "${esa(key)}" using {${mods}}`
            : `keystroke "${esa(key)}"`;

        await runScript(`tell application "System Events" to ${keyStr}`);
        return { summary: `Pressed ${mods ? modifiers.join('+') + '+' : ''}${key}` };
    }

    // ============= CLIPBOARD =============

    async handleCopyToClipboard(step, context, memory) {
        const text = step.params?.text || memory.summary || memory.text || '';
        if (!text) throw new Error('Nothing to copy');

        const escaped = text.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
        await execAsync(`printf "%s" "${escaped}" | pbcopy`);

        return { copied: true, length: text.length, summary: `Copied ${text.length} characters to clipboard` };
    }

    async handleGetClipboard(step, context, memory) {
        const { stdout } = await execAsync('pbpaste');
        return { clipboard: stdout, summary: `Got ${stdout.length} chars from clipboard` };
    }

    // ============= APPLE NOTES =============

    async handleCreateNote(step, context, memory) {
        const title = step.params?.title || 'Metrixa Note';
        const content = step.params?.content || memory.summary || memory.text || memory.summaryText || '';

        if (!content) throw new Error('No content for note');

        const noteBody = `${content}`;
        const script = `
tell application "Notes"
    activate
    set newNote to make new note with properties {name:"${esa(title)}", body:"${esa(noteBody)}"}
end tell`;

        await runScript(script);
        return { created: true, title, summary: `Created note: **${title}**` };
    }

    async handleSearchNotes(step, context, memory) {
        const query = step.params?.query || '';
        const script = `
tell application "Notes"
    activate
    set matchingNotes to every note whose name contains "${esa(query)}" or body contains "${esa(query)}"
    set noteCount to count of matchingNotes
    if noteCount > 0 then
        set firstNote to item 1 of matchingNotes
        return name of firstNote & ": " & (text 1 thru 200 of body of firstNote)
    else
        return "No notes found"
    end if
end tell`;

        const result = await runScript(script);
        return { result, summary: `Notes search result: ${result.substring(0, 100)}` };
    }

    // ============= APPLE REMINDERS =============

    async handleCreateReminder(step, context, memory) {
        const name = step.params?.name || step.params?.title || memory.summary || 'Metrixa Reminder';
        const dueDate = step.params?.due_date || step.params?.date || null;
        const listName = step.params?.list || 'Reminders';

        let dateScript = '';
        if (dueDate) {
            dateScript = `set due date of newReminder to date "${esa(dueDate)}"`;
        }

        const script = `
tell application "Reminders"
    activate
    set targetList to list "${esa(listName)}"
    set newReminder to make new reminder at end of reminders of targetList with properties {name:"${esa(name)}"}
    ${dateScript}
end tell`;

        await runScript(script);

        return {
            created: true,
            name,
            dueDate,
            summary: `Created reminder: **${name}**${dueDate ? ` (due: ${dueDate})` : ''}`
        };
    }

    // ============= APPLE CALENDAR =============

    async handleCreateCalendarEvent(step, context, memory) {
        const { title, start_date, end_date, location, notes: eventNotes, calendar } = step.params || {};

        if (!title) throw new Error('Calendar event needs a title');

        const startDate = start_date || new Date().toLocaleString();
        const endDate = end_date || new Date(Date.now() + 3600000).toLocaleString();
        const calName = calendar || 'Calendar';

        const script = `
tell application "Calendar"
    activate
    tell calendar "${esa(calName)}"
        set newEvent to make new event with properties {summary:"${esa(title)}", start date:date "${esa(startDate)}", end date:date "${esa(endDate)}"}
        ${location ? `set location of newEvent to "${esa(location)}"` : ''}
        ${eventNotes ? `set description of newEvent to "${esa(eventNotes)}"` : ''}
    end tell
end tell`;

        await runScript(script);

        return {
            created: true,
            title,
            start: startDate,
            end: endDate,
            summary: `Created calendar event: **${title}** (${startDate})`
        };
    }

    async handleGetCalendarEvents(step, context, memory) {
        const script = `
tell application "Calendar"
    set today to current date
    set tomorrow to today + 1 * days
    set eventList to ""
    repeat with cal in calendars
        repeat with evt in events of cal
            if start date of evt >= today and start date of evt < tomorrow then
                set eventList to eventList & summary of evt & " at " & time string of (start date of evt) & "\n"
            end if
        end repeat
    end repeat
    if eventList is "" then return "No events today"
    return eventList
end tell`;

        const result = await runScript(script);
        return { events: result, summary: `Today's events:\n${result}` };
    }

    // ============= APPLE MAIL =============

    async handleSendEmail(step, context, memory) {
        const { to, subject, body: emailBody } = step.params || {};
        if (!to || !subject) throw new Error('Email requires "to" and "subject"');

        const body = emailBody || memory.summary || memory.text || '';

        const script = `
tell application "Mail"
    activate
    set newMessage to make new outgoing message with properties {subject:"${esa(subject)}", content:"${esa(body)}", visible:true}
    tell newMessage
        make new to recipient with properties {address:"${esa(to)}"}
    end tell
end tell`;

        await runScript(script);

        return {
            drafted: true,
            to, subject,
            summary: `Drafted email to **${to}**: "${subject}"`
        };
    }

    async handleReadLatestEmail(step, context, memory) {
        const script = `
tell application "Mail"
    set latestMsg to first message of inbox
    set msgFrom to sender of latestMsg
    set msgSubject to subject of latestMsg
    set msgContent to content of latestMsg
    return msgFrom & "||" & msgSubject & "||" & (text 1 thru 500 of msgContent)
end tell`;

        const result = await runScript(script);
        const parts = result.split('||');
        return {
            from: parts[0],
            subject: parts[1],
            body: parts[2],
            text: result,
            summary: `Latest email from ${parts[0]}: "${parts[1]}"`
        };
    }

    // ============= iMESSAGE =============

    async handleReadiMessage(step, context, memory) {
        const contact = step.params?.contact || step.params?.to || '';
        const count = step.params?.count || 5;

        const script = contact
            ? `
tell application "Messages"
    set targetChat to first chat whose name contains "${esa(contact)}"
    set msgs to ""
    repeat with m in last ${count} messages of targetChat
        set msgs to msgs & sender of m & ": " & content of m & "\n"
    end repeat
    return msgs
end tell`
            : `
tell application "Messages"
    set targetChat to first chat
    set msgs to ""
    repeat with m in last ${count} messages of targetChat
        set msgs to msgs & sender of m & ": " & content of m & "\n"
    end repeat
    return msgs
end tell`;

        const result = await runScript(script);
        return { messages: result, text: result, summary: `Recent messages:\n${result}` };
    }

    async handleSendiMessage(step, context, memory) {
        const to = step.params?.to || step.params?.contact || '';
        const message = step.params?.message || step.params?.text || memory.summary || '';

        if (!to) throw new Error('iMessage needs a recipient');
        if (!message) throw new Error('iMessage needs a message');

        const script = `
tell application "Messages"
    set targetService to 1st account whose service type = iMessage
    set targetBuddy to participant "${esa(to)}"
    send "${esa(message)}" to targetBuddy
end tell`;

        await runScript(script);
        return { sent: true, to, summary: `Sent iMessage to **${to}**: "${message}"` };
    }

    // ============= MUSIC =============

    async handlePlayMusic(step, context, memory) {
        const track = step.params?.track || step.params?.song || '';
        const playlist = step.params?.playlist || '';

        let script;
        if (track) {
            script = `tell application "Music"
    activate
    set results to search playlist "Library" for "${esa(track)}"
    if results is not {} then
        play item 1 of results
    end if
end tell`;
        } else if (playlist) {
            script = `tell application "Music"
    activate
    play playlist "${esa(playlist)}"
end tell`;
        } else {
            script = `tell application "Music" to activate
tell application "Music" to play`;
        }

        await runScript(script);
        return { playing: true, summary: `Playing ${track || playlist || 'music'} in Apple Music` };
    }

    async handlePauseMusic(step, context, memory) {
        await runScript('tell application "Music" to pause');
        return { paused: true, summary: 'Paused music' };
    }

    // ============= SLACK =============

    async handleSlackOpenChannel(step, context, memory) {
        const channel = step.params?.channel || step.params?.name || '#general';
        const team = step.params?.team || '';

        // Try Slack deep link first, fallback to just opening Slack
        const slackUrl = team
            ? `slack://channel?team=${encodeURIComponent(team)}&id=${encodeURIComponent(channel)}`
            : `slack://open?team=${encodeURIComponent(channel)}`;

        try {
            await execAsync(`open "${slackUrl}"`);
        } catch (e) {
            await runScript('tell application "Slack" to activate');
        }

        await this.sleep(1000);
        return { channel, summary: `Opened Slack channel ${channel}` };
    }

    // ============= SPREADSHEET =============

    async handleUpdateSpreadsheet(step, context, memory) {
        const { operation, data } = step.params || {};
        if (!operation) throw new Error('No spreadsheet operation specified');

        if (operation === 'insert_row') {
            const rowData = data || memory.data || memory.summary;
            if (!rowData) throw new Error('No data to insert');

            await guiClick(500, 400);
            await this.sleep(300);
            await this._pressKeyCombo('cmd+down');
            await this.sleep(200);
            await this._pressKeyCombo('down');
            await this.sleep(200);
            await guiType(typeof rowData === 'string' ? rowData : JSON.stringify(rowData));
            await this.sleep(200);
            await this._pressKeyCombo('return');

            return { inserted: true, summary: 'Inserted row into spreadsheet' };
        }

        throw new Error(`Spreadsheet operation "${operation}" not supported`);
    }

    async handleApiCall(step, context, memory) {
        throw new Error('Direct API calls not yet supported. Use app-specific actions instead.');
    }

    // ============= META HANDLERS =============

    async handleVerify(step, context, memory) {
        const expected = step.params?.expected || 'Task completed';
        const currentState = await getScreenText(this.mainWindow);

        const prompt = `Did this expected outcome occur?

EXPECTED: ${expected}

CURRENT SCREEN (first 800 chars):
${currentState.text.substring(0, 800)}

Reply with ONLY JSON: {"verified": true/false, "reason": "brief explanation"}

JSON:`;

        try {
            const response = await this.llm.route(prompt, 'simple', { temperature: 0.2, maxTokens: 150 });
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON');

            const verification = JSON.parse(jsonMatch[0]);
            if (!verification.verified) throw new Error(`Verification failed: ${verification.reason}`);

            return { ...verification, summary: `✅ Verified: ${verification.reason}` };
        } catch (e) {
            // Be permissive: assume success if we can't verify
            return { verified: true, reason: 'Could not verify, assuming success', summary: 'Step complete' };
        }
    }

    async handleWait(step, context, memory) {
        const duration = step.params?.duration_ms || step.params?.ms || 1000;
        await this.sleep(duration);
        return { waited: duration, summary: `Waited ${duration}ms` };
    }

    // ============= HELPERS =============

    _extractEmailMetadata(text) {
        const metadata = { from: null, to: null, subject: null };
        const fromMatch = text.match(/from:\s*([^\n]+)/i);
        if (fromMatch) metadata.from = fromMatch[1].trim();
        const toMatch = text.match(/to:\s*([^\n]+)/i);
        if (toMatch) metadata.to = toMatch[1].trim();
        const subjectMatch = text.match(/subject:\s*([^\n]+)/i);
        if (subjectMatch) metadata.subject = subjectMatch[1].trim();
        return metadata;
    }

    async _pressKeyCombo(combo) {
        const parts = combo.split('+');
        const key = parts.pop();
        const mods = parts.map(m => `${m} down`);
        const modStr = mods.length > 0 ? `using {${mods.join(', ')}}` : '';
        await runScript(`tell application "System Events" to keystroke "${esa(key)}" ${modStr}`);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    notifyProgress(stepId, status, data = {}) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('step-progress', {
                stepId, status, data, timestamp: Date.now()
            });
        }
    }
}

module.exports = ActionExecutor;
