"use client";

import { RefObject, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, MessagesSquare, X } from "lucide-react";

import { ProjectContext } from "@src/context/ProjectContext";
import { getCharacterNames } from "@src/lib/screenplay/characters";
import { collectCharacterDialogues } from "@src/lib/screenplay/dialogue-tuner";
import {
    clearDialogueTunerHighlight,
    scrollDialogueTunerIntoView,
    setDialogueTunerHighlight,
} from "@src/lib/screenplay/extensions/dialogue-tuner-extension";
import { useDismissOnOutsidePress } from "@src/lib/utils/hooks";
import Dropdown, { DropdownOption } from "@components/utils/Dropdown";
import { join } from "@src/lib/utils/misc";

import styles from "./DialogueTunerPanel.module.css";
import item from "@components/editor/sidebar/SidebarItem.module.css";

interface DialogueTunerPanelProps {
    isOpen: boolean;
    onClose: () => void;
    /** The navbar button that toggles this panel — see useDismissOnOutsidePress. */
    triggerRef?: RefObject<HTMLElement | null>;
}

/**
 * Read one character's speeches in isolation: pick a character, and the script
 * fades to just the speech the tuner is parked on, with the full list of that
 * character's speeches to jump between (or step through with the arrows, as
 * in the search bar).
 *
 * The fade is up exactly while the panel is: closing it (the ✕, an outside
 * press, folding the tools) restores the full script. Which character and
 * which speech live in ProjectContext rather than here, so reopening the panel
 * lands back on the same speech, and so the sidebar's character menu can pick
 * a character before the panel is even open. The highlight itself lives in the
 * editor (dialogue-tuner-extension).
 */
const DialogueTunerPanel = ({ isOpen, onClose, triggerRef }: DialogueTunerPanelProps) => {
    const t = useTranslations("dialogueTuner");
    const {
        editor,
        screenplay,
        characters,
        dialogueTunerCharacter,
        setDialogueTunerCharacter,
        dialogueTunerIndex,
        setDialogueTunerIndex,
    } = useContext(ProjectContext);

    const panelRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Click outside to close — the navbar trigger excepted, so re-tapping it
    // dismisses the panel instead of closing and re-opening it.
    useDismissOnOutsidePress(isOpen, onClose, panelRef, triggerRef);

    const characterNames = useMemo(() => getCharacterNames(screenplay), [screenplay]);

    // Options dressed as the sidebar's character rows (colour dot + name, in
    // SidebarItem's own classes) rather than a look of their own. The map is
    // keyed however the character was first saved, so match case-insensitively
    // like the highlight extension does.
    const characterOptions: DropdownOption[] = useMemo(() => {
        const colorOf = (name: string) => {
            if (!characters) return undefined;
            const key = Object.keys(characters).find((k) => k.toUpperCase() === name);
            return key ? characters[key]?.color : undefined;
        };
        return characterNames.map((name) => {
            const color = colorOf(name);
            return {
                value: name,
                label: (
                    <span className={item.title_row}>
                        {color && <span className={item.color_indicator} style={{ backgroundColor: color }} />}
                        <span className={item.title}>{name}</span>
                    </span>
                ),
            };
        });
    }, [characterNames, characters]);

    // Read off the live document rather than `screenplay` (its JSON mirror) —
    // the positions have to be the editor's. `screenplay` is listed so the
    // list follows edits. Nothing is walked while the panel is closed — there
    // is no highlight to keep in step then.
    const dialogues = useMemo(() => {
        if (!isOpen || !editor || !dialogueTunerCharacter) return [];
        return collectCharacterDialogues(editor.state.doc, dialogueTunerCharacter);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, editor, screenplay, dialogueTunerCharacter]);

    const count = dialogues.length;
    const index = count === 0 ? 0 : Math.min(dialogueTunerIndex, count - 1);

    // Park the editor on the current speech whenever the list is recomputed —
    // that is what puts the highlight back on the right block after edits
    // above it have shifted positions, and what restores it on a fresh editor
    // when the panel reopens. None of the character's speeches left drops the
    // fade rather than leaving the whole script dimmed with nothing lit.
    useEffect(() => {
        if (!isOpen || !editor || !dialogueTunerCharacter) return;
        const target = dialogues[index];
        if (target) setDialogueTunerHighlight(editor, target.from, target.to);
        else clearDialogueTunerHighlight(editor);
    }, [isOpen, editor, dialogues, index, dialogueTunerCharacter]);

    const goTo = useCallback(
        (next: number) => {
            if (!editor || count === 0) return;
            const target = dialogues[next];
            if (!target) return;
            setDialogueTunerIndex(next);
            setDialogueTunerHighlight(editor, target.from, target.to);
            scrollDialogueTunerIntoView(editor, target.from);
        },
        [editor, count, dialogues, setDialogueTunerIndex],
    );

    const goToNext = useCallback(() => goTo((index + 1) % count), [goTo, index, count]);
    const goToPrevious = useCallback(() => goTo((index - 1 + count) % count), [goTo, index, count]);

    // Choosing a character jumps to its first speech straight away, so the
    // fade and the scroll land together rather than waiting for a click.
    const handleCharacterChange = useCallback(
        (name: string) => {
            setDialogueTunerCharacter(name);
            if (!editor) return;
            const first = collectCharacterDialogues(editor.state.doc, name)[0];
            if (first) {
                setDialogueTunerHighlight(editor, first.from, first.to);
                scrollDialogueTunerIntoView(editor, first.from);
            }
        },
        [editor, setDialogueTunerCharacter],
    );

    // Closing the panel is what ends tuning (there is no separate stop): drop
    // the fade so the script is back in full, keeping the character and index
    // in context so reopening lands on the same speech.
    useEffect(() => {
        if (isOpen || !editor) return;
        clearDialogueTunerHighlight(editor);
    }, [isOpen, editor]);

    // Keep the current row in view as the arrows step through a long list.
    useEffect(() => {
        if (!isOpen) return;
        const row = listRef.current?.children[index] as HTMLElement | undefined;
        row?.scrollIntoView({ block: "nearest" });
    }, [isOpen, index]);

    if (!isOpen) return null;

    return (
        <div className={styles.container} ref={panelRef}>
            <div className={styles.header}>
                <span className={styles.title}>{t("title")}</span>
                <button className={styles.icon_btn} onClick={onClose} aria-label="Close">
                    <X size={16} />
                </button>
            </div>

            {/* Character + navigation on one row: the same up/down + counter as
                the search bar, stepping through the chosen character's speeches. */}
            <div className={styles.section}>
                <div className={styles.character_row}>
                    <div className={styles.character_field}>
                        <Dropdown
                            value={dialogueTunerCharacter ?? ""}
                            onChange={handleCharacterChange}
                            options={characterOptions}
                            placeholder={t("chooseCharacter")}
                            className={styles.character_select}
                            menuClassName={styles.character_menu}
                            itemClassName={styles.character_option}
                            portal
                        />
                    </div>
                    <div className={styles.navigation}>
                        <button
                            className={styles.nav_btn}
                            onClick={goToPrevious}
                            disabled={count === 0}
                            aria-label={t("previous")}
                        >
                            <ChevronUp size={18} />
                        </button>
                        <span className={styles.match_count}>
                            {count > 0 ? t("dialogueCount", { current: index + 1, total: count }) : "–"}
                        </span>
                        <button
                            className={styles.nav_btn}
                            onClick={goToNext}
                            disabled={count === 0}
                            aria-label={t("next")}
                        >
                            <ChevronDown size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {characterNames.length === 0 ? (
                <div className={styles.empty}>
                    <MessagesSquare size={20} className={styles.empty_icon} />
                    <p className={styles.empty_text}>{t("noCharacters")}</p>
                </div>
            ) : !dialogueTunerCharacter ? (
                <div className={styles.empty}>
                    <MessagesSquare size={20} className={styles.empty_icon} />
                    <p className={styles.empty_text}>{t("emptyState")}</p>
                </div>
            ) : count === 0 ? (
                <div className={styles.empty}>
                    <MessagesSquare size={20} className={styles.empty_icon} />
                    <p className={styles.empty_text}>{t("noDialogues")}</p>
                </div>
            ) : (
                <>
                    {/* Every speech, in reading order */}
                    <div className={styles.list} ref={listRef}>
                        {dialogues.map((d, i) => (
                            <button
                                key={`${d.from}-${i}`}
                                className={join(styles.item, i === index ? styles.item_current : "")}
                                onClick={() => goTo(i)}
                                aria-current={i === index ? "true" : undefined}
                            >
                                <span className={styles.item_index}>{i + 1}</span>
                                <span className={styles.item_body}>
                                    {d.scene && <span className={styles.item_scene}>{d.scene}</span>}
                                    <span className={styles.item_text}>{d.text || t("emptyDialogue")}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default DialogueTunerPanel;
