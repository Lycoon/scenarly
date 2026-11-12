import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";

import { PDFAdapter } from "@src/lib/adapters/pdf/pdf-adapter";
import type { PageFooter, PageHeader, VisualLine } from "@src/lib/adapters/pdf/pdf.worker";
import { BASE_EXTENSIONS, SCREENPLAY_FORMATS } from "@src/lib/screenplay/editor";
import {
    ScenarlyPagination,
    createPageChromeResolver,
    type PageChromeResolver,
} from "@src/lib/screenplay/extensions/pagination-extension";

/**
 * Exporting a page range can recount the kept pages from 1, so an excerpt
 * reads as a script of its own. The headers and footers on the editor DOM
 * carry the original numbers already expanded, so the export re-expands the
 * editor's templates for each new number rather than editing those strings.
 */

type AdapterInternals = {
    keepPages(
        lines: VisualLine[],
        lastPageFooter: PageFooter | undefined,
        keep: (page: { lines: VisualLine[]; revisions: Set<number> }, ordinal: number) => boolean,
        renumber?: PageChromeResolver,
    ): { lines: VisualLine[]; lastFooter: PageFooter | undefined; firstHeader?: PageHeader };
};

const internals = (adapter: PDFAdapter) => adapter as unknown as AdapterInternals;

const columns = (right: string): PageHeader => ({ left: "", middle: "", right });

/** `count` one-line pages, chrome numbered as the editor expands it. */
const paginated = (count: number) => {
    const lines: VisualLine[] = [];
    for (let n = 1; n <= count; n++) {
        if (n > 1) {
            lines.push({
                runs: [],
                y: 0,
                type: "__page_break__",
                pageLabel: `${n}.`,
                header: columns(`${n}.`),
                footer: columns(`foot ${n - 1}`),
            });
        }
        lines.push({ runs: [{ text: `page ${n}`, x: 0 }], y: n * 16, type: "action" } as VisualLine);
    }
    return { lines, lastFooter: columns(`foot ${count}`) };
};

const inRange = (start: number, end: number) => (_page: unknown, ordinal: number) =>
    ordinal >= start && ordinal <= end;

const sentinels = (lines: VisualLine[]) => lines.filter((l) => l.type === "__page_break__");

describe("PDF export of a page range", () => {
    it("keeps the original numbers by default", () => {
        const { lines, lastFooter } = paginated(5);
        const kept = internals(new PDFAdapter()).keepPages(lines, lastFooter, inRange(3, 4));

        // Page 3 opens with a leading sentinel carrying its own header.
        expect(kept.lines[0].type).toBe("__page_break__");
        expect(sentinels(kept.lines).map((s) => s.header?.right)).toEqual(["3.", "4."]);
        expect(kept.lastFooter?.right).toBe("foot 4");
        expect(kept.firstHeader).toBeUndefined();
    });

    it("recounts the kept pages from 1 when renumbering", () => {
        const { lines, lastFooter } = paginated(5);
        const calls: Array<[number, number]> = [];
        const renumber: PageChromeResolver = (pagenum, sourcePage) => {
            calls.push([pagenum, sourcePage]);
            return { header: columns(pagenum === 1 ? "" : `${pagenum}.`), footer: columns(`foot ${pagenum}`) };
        };
        const kept = internals(new PDFAdapter()).keepPages(lines, lastFooter, inRange(3, 5), renumber);

        // New numbers, each resolved against the page whose content it holds.
        expect(calls).toEqual([
            [1, 3],
            [2, 4],
            [3, 5],
        ]);
        // The first kept page becomes page 1 outright: no leading sentinel,
        // its header handed to the worker's first-page pass instead.
        expect(kept.lines[0].type).toBe("action");
        expect(kept.firstHeader?.right).toBe("");
        const breaks = sentinels(kept.lines);
        expect(breaks.map((s) => s.header?.right)).toEqual(["2.", "3."]);
        expect(breaks.map((s) => s.pageLabel)).toEqual(["2", "3"]);
        // Each break carries the footer of the page it closes.
        expect(breaks.map((s) => s.footer?.right)).toEqual(["foot 1", "foot 2"]);
        expect(kept.lastFooter?.right).toBe("foot 3");
    });
});

const teardown: Array<() => void> = [];
afterEach(() => {
    while (teardown.length) teardown.pop()!();
});

describe("createPageChromeResolver", () => {
    /** A one-page script whose header shows the page revision (`*`) and number. */
    const mount = async () => {
        const el = document.createElement("div");
        document.body.appendChild(el);
        const blankHeader = { headerLeft: "", headerMiddle: "", headerRight: "" };
        const blankFooter = { footerLeft: "", footerMiddle: "", footerRight: "" };
        const editor = new Editor({
            element: el,
            injectCSS: false,
            autofocus: false,
            content: {
                type: "doc",
                content: [
                    {
                        type: "action",
                        attrs: { "data-id": "n0", class: "action" },
                        content: [{ type: "text", text: "Revised.", marks: [{ type: "revision", attrs: { index: 2 } }] }],
                    },
                ],
            },
            extensions: [
                ...BASE_EXTENSIONS,
                ScenarlyPagination.configure({
                    ...SCREENPLAY_FORMATS.LETTER,
                    headerLeft: "*",
                    headerMiddle: "",
                    headerRight: "#.",
                    footerLeft: "",
                    footerMiddle: "Page #",
                    footerRight: "",
                    // Page 1 unnumbered, as the editor configures it by default.
                    customHeader: { 1: blankHeader },
                    customFooter: { 1: blankFooter },
                }),
            ],
        });
        teardown.push(() => {
            editor.destroy();
            el.remove();
        });

        // The per-page revisions are only computed once the font gate opens.
        await new Promise((r) => setTimeout(r, 80));
        (editor.storage as unknown as Record<string, { fontsReady: boolean }>).Pagination.fontsReady = true;
        editor.view.dispatch(editor.state.tr.setMeta("forcePaginationUpdate", true));
        await new Promise((r) => setTimeout(r, 80));
        return editor;
    };

    it("expands the templates for the new number and the source page's revision", async () => {
        const editor = await mount();
        const resolve = createPageChromeResolver(editor)!;

        expect(resolve(2, 1)).toEqual({
            header: { left: "Pink", middle: "", right: "2." },
            footer: { left: "", middle: "Page 2", right: "" },
        });
        // Page 1 keeps its override.
        expect(resolve(1, 1)).toEqual({
            header: { left: "", middle: "", right: "" },
            footer: { left: "", middle: "", right: "" },
        });
    });

    it("follows header edits made after the editor was created", async () => {
        const editor = await mount();
        editor.commands.updateHeaderContent("", "", "p. #");

        expect(createPageChromeResolver(editor)!(7, 1).header.right).toBe("p. 7");
    });
});
