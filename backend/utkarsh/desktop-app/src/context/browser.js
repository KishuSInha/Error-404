const { chromium } = require("playwright");

let browser = null;
let context = null;
let page = null;

async function getBrowserPage() {
    try {
        if (page) return page;

        console.log("Launching Chromium for Metrixa...");
        browser = await chromium.launch({
            headless: false // Visible for trust and manual login if needed
        });

        context = await browser.newContext({
            viewport: { width: 1280, height: 800 }
        });

        page = await context.newPage();

        // Handle closure cleanup
        browser.on('disconnected', () => {
            browser = null;
            context = null;
            page = null;
        });

        return page;
    } catch (error) {
        console.error('Failed to launch browser:', error);
        throw new Error(`Browser launch failed: ${error.message}`);
    }
}

async function closeBrowser() {
    try {
        if (browser) {
            await browser.close();
            browser = null;
            context = null;
            page = null;
        }
    } catch (error) {
        console.error('Error closing browser:', error);
    }
}

module.exports = { getBrowserPage, closeBrowser };
