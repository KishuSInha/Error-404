/**
 * Detect if the screen text contains email-related content
 * @param {string} text - OCR extracted text from screen
 * @returns {boolean} - True if email context is detected
 */
function detectEmailContext(text) {
    if (!text || text.length < 20) return false;

    const emailIndicators = [
        /from:.*@/i,
        /to:.*@/i,
        /subject:/i,
        /inbox/i,
        /compose/i,
        /reply/i,
        /forward/i,
        /gmail|outlook|mail|thunderbird/i,
        /@[\w.-]+\.\w{2,}/i, // Email addresses
        /sent.*ago|received.*ago/i,
        /unread|starred|important/i
    ];

    // Count how many indicators match
    const matches = emailIndicators.filter(regex => regex.test(text));

    // Need at least 2 indicators to confidently say it's email
    return matches.length >= 2;
}

/**
 * Extract email metadata from screen text
 * @param {string} text - OCR extracted text
 * @returns {object} - Extracted email metadata
 */
function extractEmailMetadata(text) {
    const metadata = {
        from: null,
        to: null,
        subject: null,
        hasAttachments: false
    };

    // Extract From
    const fromMatch = text.match(/from:\s*([^\n]+)/i);
    if (fromMatch) {
        metadata.from = fromMatch[1].trim();
    }

    // Extract To
    const toMatch = text.match(/to:\s*([^\n]+)/i);
    if (toMatch) {
        metadata.to = toMatch[1].trim();
    }

    // Extract Subject
    const subjectMatch = text.match(/subject:\s*([^\n]+)/i);
    if (subjectMatch) {
        metadata.subject = subjectMatch[1].trim();
    }

    // Check for attachments
    metadata.hasAttachments = /attachment|attached|\.pdf|\.docx|\.xlsx/i.test(text);

    return metadata;
}

module.exports = { detectEmailContext, extractEmailMetadata };
