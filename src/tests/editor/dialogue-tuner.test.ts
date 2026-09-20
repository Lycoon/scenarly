import { afterEach, describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";

import { BASE_EXTENSIONS } from "@src/lib/screenplay/editor";
import { collectCharacterDialogues } from "@src/lib/screenplay/dialogue-tuner";
import { createTestEditor } from "../helpers/editor-factory";

/**
 * The dialogue tuner lists one character's speeches as [from, to] blocks it
 * then highlights and scrolls to, so the positions have to be node boundaries
 * in the live document — including inside dual dialogue, whose lines sit two
 * levels down in a column rather than at the top level.
 */

const line = (cls: string, text: string): JSONContent => ({
    type: cls,
    attrs: { class: cls },
    content: text ? [{ type: "text", text }] : undefined,
});

const doc: JSONContent[] = [
    line("scene", "INT. KITCHEN - DAY"),
    line("action", "The kettle boils."),
    line("character", "ANNA"),
    line("parenthetical", "(quietly)"),
    line("dialogue", "Is it ready?"),
    line("dialogue", "I can wait."),
    line("character", "BEN"),
    line("dialogue", "Almost."),
    line("scene", "EXT. GARDEN - NIGHT"),
    line("character", "ANNA (V.O.)"),
    line("dialogue", "It never was."),
    {
        type: "dual_dialogue",
        attrs: { class: "dual_dialogue" },
        content: [
            {
                type: "dual_dialogue_column",
                content: [line("character", "BEN"), line("dialogue", "Left side.")],
            },
            {
                type: "dual_dialogue_column",
                content: [line("character", "ANNA"), line("dialogue", "Right side.")],
            },
        ],
    },
    line("action", "Silence."),
];

const teardown: Array<() => void> = [];
afterEach(() => {
    while (teardown.length) teardown.pop()!();
});

const mount = () => {
    const made = createTestEditor(BASE_EXTENSIONS, doc);
    teardown.push(made.cleanup);
    return made.editor;
};

describe("collectCharacterDialogues", () => {
    it("groups each cue with its following lines, tracking the scene", () => {
        const editor = mount();
        const speeches = collectCharacterDialogues(editor.state.doc, "anna");

        expect(speeches.map((s) => s.text)).toEqual([
            "(quietly) Is it ready? I can wait.",
            "It never was.",
            "Right side.",
        ]);
        expect(speeches.map((s) => s.scene)).toEqual([
            "INT. KITCHEN - DAY",
            "EXT. GARDEN - NIGHT",
            "EXT. GARDEN - NIGHT",
        ]);
    });

    it("returns node-boundary ranges that resolve to the cue and last line", () => {
        const editor = mount();
        const { doc: pmDoc } = editor.state;
        const speeches = collectCharacterDialogues(pmDoc, "ANNA");

        for (const s of speeches) {
            // `from` is the character cue's own position...
            expect(pmDoc.nodeAt(s.from)?.attrs.class).toBe("character");
            // ...and `to` is the boundary just after the block's last line.
            expect(pmDoc.resolve(s.to).nodeBefore?.attrs.class).toBe("dialogue");
            expect(pmDoc.textBetween(s.from, s.to, " ")).toContain(s.text.split(" ").pop());
        }

        // The dual-dialogue speech sits inside the second column, not at the top level.
        const dual = speeches[2];
        expect(pmDoc.resolve(dual.from).depth).toBe(2);
        expect(pmDoc.textBetween(dual.from, dual.to, " ")).toBe("ANNA Right side.");
    });

    it("ignores other characters and unknown names", () => {
        const editor = mount();
        expect(collectCharacterDialogues(editor.state.doc, "BEN").map((s) => s.text)).toEqual([
            "Almost.",
            "Left side.",
        ]);
        expect(collectCharacterDialogues(editor.state.doc, "NOBODY")).toEqual([]);
        expect(collectCharacterDialogues(editor.state.doc, "")).toEqual([]);
    });
});
