import { Editor, Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Marks the speech the dialogue tuner is parked on.
 *
 * Same shape as the read-aloud highlight: the plugin holds one block range,
 * driven from outside through transaction metas (the tuner panel lives in the
 * navbar, above the editor), and maps it through edits so it follows the text
 * while the panel is closed. The fade of everything else is pure CSS, keyed on
 * the .dialogue-tuner-active class this toggles on the editor DOM: every line
 * in the range gets .dialogue-tuner-current, and scenarly.css dims the rest.
 */

interface TunerRange {
    from: number;
    to: number;
}

const dialogueTunerKey = new PluginKey<TunerRange | null>("dialogueTuner");
const SET_META = "dialogueTunerSet";
const ACTIVE_CLASS = "dialogue-tuner-active";

export const createDialogueTunerExtension = () =>
    Extension.create({
        name: "dialogueTuner",

        addProseMirrorPlugins() {
            return [
                new Plugin<TunerRange | null>({
                    key: dialogueTunerKey,
                    state: {
                        init: () => null,
                        apply(tr, value) {
                            // An explicit set/clear always wins (null clears).
                            if (tr.getMeta(SET_META) !== undefined) {
                                return tr.getMeta(SET_META) as TunerRange | null;
                            }
                            if (!value) return null;
                            if (tr.docChanged) {
                                const from = tr.mapping.map(value.from, 1);
                                const to = tr.mapping.map(value.to, -1);
                                return from < to ? { from, to } : null;
                            }
                            return value;
                        },
                    },
                    props: {
                        decorations(state) {
                            const value = dialogueTunerKey.getState(state);
                            if (!value || value.to > state.doc.content.size) return null;
                            // One decoration per line rather than one over the
                            // block: the fade rule targets the lines themselves,
                            // and a dual-dialogue speech's lines sit inside a
                            // column, not at the top level.
                            const decorations: Decoration[] = [];
                            state.doc.nodesBetween(value.from, value.to, (node, pos) => {
                                if (!node.isTextblock) return true;
                                decorations.push(
                                    Decoration.node(pos, pos + node.nodeSize, { class: "dialogue-tuner-current" }),
                                );
                                return false;
                            });
                            return DecorationSet.create(state.doc, decorations);
                        },
                    },
                }),
            ];
        },
    });

/** Park the tuner on the block spanning [from, to] (node boundaries) and fade the rest. */
export const setDialogueTunerHighlight = (editor: Editor, from: number, to: number) => {
    if (!editor || editor.isDestroyed || !editor.view) return;
    editor.view.dom.classList.add(ACTIVE_CLASS);
    editor.view.dispatch(editor.state.tr.setMeta(SET_META, { from, to }));
};

/** Drop the highlight and restore the full script. */
export const clearDialogueTunerHighlight = (editor: Editor) => {
    if (!editor || editor.isDestroyed || !editor.view) return;
    editor.view.dom.classList.remove(ACTIVE_CLASS);
    editor.view.dispatch(editor.state.tr.setMeta(SET_META, null));
};

/** Scroll the line starting at `from` into view, centred. */
export const scrollDialogueTunerIntoView = (editor: Editor, from: number) => {
    if (!editor || editor.isDestroyed || !editor.view) return;
    try {
        const { node } = editor.view.domAtPos(from + 1);
        const el = node instanceof HTMLElement ? node : node.parentElement;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
        /* position may be transiently invalid during edits — ignore */
    }
};
