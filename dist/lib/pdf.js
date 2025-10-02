// Minimal PDF text extractor using pdf-parse.
// Import the internal implementation to avoid example code execution in CJS/ESM interop.
// See: some environments trigger pdf-parse's sample code when importing the package root.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
export async function extractTextFromPdf(buffer) {
    const data = await pdfParse(buffer);
    return data.text || '';
}
