const { desktopCapturer, screen } = require('electron');
const Tesseract = require('tesseract.js');

let cachedWorker = null;

async function getWorker() {
    if (cachedWorker) {
        return cachedWorker;
    }
    console.log('Initializing Tesseract worker with optimized config...');
    cachedWorker = await Tesseract.createWorker('eng', 1, {
        logger: m => {
            if (m.status === 'recognizing text') {
                console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
            }
        }
    });
    await cachedWorker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    });
    return cachedWorker;
}

async function getScreenText(mainWindow) {
    let worker = null;
    try {
        console.log('[OCR] Capturing screen...');
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: screen.getPrimaryDisplay().size
        });
        if (sources.length === 0) throw new Error('No screen sources found');
        const buffer = sources[0].thumbnail.toPNG();

        worker = await getWorker();
        const result = await worker.recognize(buffer);

        console.log('OCR Complete. Confidence:', result.data.confidence);

        if (!result || !result.data) {
            console.error('OCR returned no data.');
            return { text: '', words: [], confidence: 0 };
        }

        const text = result.data.text || '';
        const confidence = result.data.confidence || 0;

        let words = [];
        if (result.data.lines) {
            words = result.data.lines.flatMap(line => 
                (line.words || []).map(w => ({
                    text: w.text,
                    confidence: w.confidence,
                    bbox: w.bbox
                }))
            );
        }

        const data = {
            text: text,
            words: words,
            confidence: confidence,
            windowBounds: mainWindow ? mainWindow.getBounds() : null,
            lowConfidence: confidence < 50
        };

        if (confidence < 50) {
            console.log('[OCR] Low confidence - may need retry');
        }

        return data;
    } catch (err) {
        console.error('OCR failed:', err);
        cachedWorker = null;
        throw err;
    }
}

const screenshot = require('screenshot-desktop');

async function readScreenText() {
    let worker = null;
    try {
        console.log('Capturing screen for OCR...');
        const img = await screenshot({ format: 'png' });

        worker = await getWorker();
        const { data } = await worker.recognize(img);

        console.log('OCR Confidence:', data.confidence);
        return {
            text: data.text || "",
            confidence: data.confidence || 0
        };
    } catch (err) {
        console.error('OCR (readScreenText) failed:', err);
        cachedWorker = null;
        return { text: "", confidence: 0 };
    }
}

module.exports = { getScreenText, readScreenText };
