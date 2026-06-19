const { exec } = require('child_process');

function runAppleScript(script) {
    return new Promise((resolve, reject) => {
        exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
            if (error) {
                console.error(`AppleScript Error: ${error.message}`);
                return reject(error);
            }
            resolve(stdout.trim());
        });
    });
}

async function guiClick(x, y) {
    console.log(`Executing AppleScript Click at: ${x}, ${y}`);
    const script = `tell application "System Events" to click at {${x}, ${y}}`;
    try {
        await runAppleScript(script);
    } catch (e) {
        console.error('AppleScript Click failed:', e);
    }
}

async function guiType(text) {
    console.log(`Executing AppleScript Type: ${text}`);
    // Escape double quotes for AppleScript
    const escapedText = text.replace(/"/g, '\\"');
    const script = `tell application "System Events" to keystroke "${escapedText}"`;
    try {
        await runAppleScript(script);
    } catch (e) {
        console.error('AppleScript Type failed:', e);
    }
}

async function guiMove(x, y) {
    console.log(`GUI Move requested to ${x}, ${y} (No-op in AppleScript)`);
}

module.exports = { guiClick, guiType, guiMove };
