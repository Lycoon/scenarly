/**
 * Server-side PDF handling for Community: inspection of an upload and the
 * per-claim watermark. Both go through `pdf-lib`, which parses the document
 * structure without rendering anything, so a hostile file can at worst fail to
 * parse. Server only — never import from client code.
 */

import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

export interface PdfInspection {
    pageCount: number;
}

/**
 * Parse the upload and count its pages. Throws on anything that is not a
 * readable, unencrypted PDF; the caller turns that into a 422.
 */
export async function inspectPdf(bytes: Uint8Array): Promise<PdfInspection> {
    // `ignoreEncryption: false` (the default) rejects encrypted files, which
    // could not be watermarked or reliably page-counted anyway.
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    return { pageCount: doc.getPageCount() };
}

/**
 * Stamp every page with a diagonal light-grey line and a small footer carrying
 * the same text. The text names the claim, not the reviewer: only the database
 * maps a leaked copy back to a person.
 */
export async function watermarkPdf(bytes: Uint8Array, text: string): Promise<Uint8Array> {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const font = await doc.embedFont(StandardFonts.HelveticaBold);

    for (const page of doc.getPages()) {
        const { width, height } = page.getSize();

        // Diagonal: sized to span most of the page, centred by its measured width.
        const diagonalSize = Math.max(18, Math.min(48, width / 14));
        const diagonalWidth = font.widthOfTextAtSize(text, diagonalSize);
        page.drawText(text, {
            x: width / 2 - (diagonalWidth / 2) * Math.cos(Math.PI / 4),
            y: height / 2 - (diagonalWidth / 2) * Math.sin(Math.PI / 4),
            size: diagonalSize,
            font,
            color: rgb(0.5, 0.5, 0.5),
            opacity: 0.18,
            rotate: degrees(45),
        });

        // Footer: small, always legible, in the bottom margin.
        const footerSize = 7;
        page.drawText(text, {
            x: (width - font.widthOfTextAtSize(text, footerSize)) / 2,
            y: 18,
            size: footerSize,
            font,
            color: rgb(0.4, 0.4, 0.4),
            opacity: 0.8,
        });
    }

    return doc.save({ useObjectStreams: true });
}
