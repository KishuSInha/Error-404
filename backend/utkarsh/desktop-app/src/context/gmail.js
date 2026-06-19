const { getBrowserPage } = require("./browser");

async function readRecentEmails(limit = 5) {
    try {
        const page = await getBrowserPage();

        console.log("Navigating to Gmail...");
        await page.goto("https://mail.google.com", {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        // Pause for potential first-time login or security check
        console.log("Waiting for Inbox to load (User may need to log in)...");

        try {
            // tr.zA is a common GMail selector for email rows
            await page.waitForSelector("tr.zA", { timeout: 30000 });
        } catch (e) {
            console.error("Gmail timeout: Inbox did not appear. Ensure you are logged in.");
            return [];
        }

        const emails = await page.$$eval("tr.zA", (rows, limit) => {
            return rows.slice(0, limit).map(row => {
                const subject = row.querySelector(".bog")?.innerText || "";
                const sender = row.querySelector(".yW span")?.innerText || "";
                return { subject, sender };
            });
        }, limit);

        console.log(`Found ${emails.length} recent emails.`);
        return emails;
    } catch (error) {
        console.error('Failed to read emails from Gmail:', error);
        throw new Error(`Gmail read failed: ${error.message}`);
    }
}

module.exports = { readRecentEmails };
