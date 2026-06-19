/**
 * TextCleaner
 * 
 * Filters raw OCR output to remove UI noise and junk.
 * Used before sending text to LLM or Database.
 */
class TextCleaner {

    /**
     * Main cleaning pipeline
     * @param {string} rawText 
     * @returns {string} Cleaned document-like text
     */
    static clean(rawText) {
        if (!rawText) return "";

        let lines = rawText.split('\n');

        // Step 1: Filter Junk lines
        lines = lines.filter(line => this.isContentLine(line));

        // Step 2: Remove UI artifacts (Menu bars, status bars)
        lines = lines.map(line => this.removeUIArtifacts(line));

        // Step 3: Remove empty strings after cleaning
        lines = lines.filter(line => line.trim().length > 0);

        // Step 4: Join into paragraphs (heuristic)
        return this.reconstructParagraphs(lines);
    }

    /**
     * Returns true if line looks like content, false if junk
     */
    static isContentLine(line) {
        const trimmed = line.trim();

        // 1. Too short to be useful
        if (trimmed.length < 3) return false;

        // 2. Common UI single words
        const uiWords = /^(file|edit|view|window|help|save|cancel|ok|yes|no|search|menu|back|forward)$/i;
        if (uiWords.test(trimmed)) return false;

        // 3. Status bar junk
        if (trimmed.match(/ln \d+, col \d+/i)) return false; // "Ln 12, Col 4"
        if (trimmed.match(/utf-8|crlf/i)) return false;

        return true;
    }

    /**
     * Strips specific UI tokens from a line
     */
    static removeUIArtifacts(line) {
        // Remove file paths in title bars slightly (keep filename)
        // Remove standard window controls symbols if OCR picked them up
        // (OCR often reads icons as random chars like ' _ [] X ')
        return line.replace(/[_\[\]]{3,}/g, '').trim();
    }

    /**
     * Merges broken lines into paragraphs
     */
    static reconstructParagraphs(lines) {
        const paragraphs = [];
        let currentPara = "";

        for (const line of lines) {
            // Heuristic: If line ends with sentence punctuation, it might be end of para.
            // If line is short and next line is capital, might be title.

            if (currentPara === "") {
                currentPara = line;
            } else {
                // If previous line didn't end with punctuation, assume wrap
                const prevEndsPunctuation = /[.!?]$/.test(currentPara);

                if (!prevEndsPunctuation) {
                    currentPara += " " + line;
                } else {
                    paragraphs.push(currentPara);
                    currentPara = line;
                }
            }
        }
        if (currentPara) paragraphs.push(currentPara);

        return paragraphs.join("\n\n");
    }
}

module.exports = TextCleaner;
