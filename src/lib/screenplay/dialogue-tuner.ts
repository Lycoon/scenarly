import { Node } from "@tiptap/pm/model";
import { ScreenplayElement } from "../utils/enums";

/**
 * One speech of the tuned character: the cue line plus every parenthetical and
 * dialogue line that follows it, as a single block the tuner can highlight and
 * scroll to as a unit.
 */
export interface TunedDialogue {
    /** Start of the character cue (node boundary). */
    from: number;
    /** End of the last dialogue/parenthetical line of the block (node boundary). */
    to: number;
    /** Heading of the scene the block sits in; "" before the first heading. */
    scene: string;
    /** The block's lines joined, parentheticals included so it reads like the page. */
    text: string;
}

/** Cue text → character name: uppercase, extensions such as "(V.O.)" stripped. */
export const normalizeCharacterName = (text: string): string =>
    text
        .toUpperCase()
        .replace(/\s*\(.*?\)\s*$/g, "")
        .trim();

/**
 * Visit every line of the script in reading order with its absolute position.
 * Dual dialogue is a container node whose two columns each hold their own
 * lines, so those are entered rather than skipped; `group` identifies the
 * container a line sits in (the column, or the document itself) so a block never
 * runs from one column into the next.
 */
const forEachLine = (doc: Node, cb: (node: Node, pos: number, group: number) => void) => {
    doc.forEach((node, pos) => {
        // By type, not `attrs.class`: the container carries no class attr,
        // unlike the line nodes.
        if (node.type.name !== ScreenplayElement.DualDialogue) {
            cb(node, pos, -1);
            return;
        }
        node.forEach((column, columnOffset) => {
            const columnPos = pos + 1 + columnOffset;
            column.forEach((line, lineOffset) => cb(line, columnPos + 1 + lineOffset, columnPos));
        });
    });
};

/** Every speech of `characterName` in the document, in reading order. */
export const collectCharacterDialogues = (doc: Node, characterName: string): TunedDialogue[] => {
    const target = normalizeCharacterName(characterName);
    if (!target) return [];

    const dialogues: TunedDialogue[] = [];
    let scene = "";
    let current: { block: TunedDialogue; lines: string[]; group: number } | null = null;

    const closeBlock = () => {
        if (!current) return;
        current.block.text = current.lines.join(" ").replace(/\s+/g, " ").trim();
        dialogues.push(current.block);
        current = null;
    };

    forEachLine(doc, (node, pos, group) => {
        const cls: string = node.attrs?.class;
        if (cls === ScreenplayElement.Character) {
            closeBlock();
            if (normalizeCharacterName(node.textContent) === target) {
                current = { block: { from: pos, to: pos + node.nodeSize, scene, text: "" }, lines: [], group };
            }
            return;
        }
        if (current && current.group === group && (cls === ScreenplayElement.Dialogue || cls === ScreenplayElement.Parenthetical)) {
            current.block.to = pos + node.nodeSize;
            const line = node.textContent.trim();
            if (line) current.lines.push(line);
            return;
        }
        closeBlock();
        if (cls === ScreenplayElement.Scene) scene = node.textContent.trim();
    });
    closeBlock();

    return dialogues;
};
