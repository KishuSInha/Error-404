const { exec } = require("child_process");

function pasteIntoNotes(text) {
    return new Promise((resolve, reject) => {
        if (!text || typeof text !== 'string') {
            return reject(new Error('Invalid text provided to pasteIntoNotes'));
        }

        // Escape double quotes and backslashes for AppleScript string
        const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");

        const script = `
tell application "Notes"
  activate
  set newNote to make new note with properties {body:"${escapedText}"}
end tell`;

        exec(`osascript -e '${script}'`, (err, stdout, stderr) => {
            if (err) {
                console.error("AppleScript Notes Error:", stderr);
                reject(new Error(`Failed to paste to Notes: ${stderr || err.message}`));
            } else {
                console.log('[ACTION]: Successfully pasted to Notes');
                resolve(stdout);
            }
        });
    });
}

module.exports = { pasteIntoNotes };
