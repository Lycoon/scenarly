"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

import sharedStyles from "../project/ProjectSettings.module.css";
import styles from "./AuthForm.module.css";

const CODE_LENGTH = 6;

type Props = {
    value: string;
    onChange: (value: string) => void;
    label: string;
    invalid?: boolean;
};

/**
 * One input per digit of a sign-in code. `value` never has holes: digits fill
 * from the left, and removing one closes the gap, so only the cells up to the
 * first empty one can take focus.
 */
const CodeInput = ({ value, onChange, label, invalid = false }: Props) => {
    const cells = useRef<(HTMLInputElement | null)[]>([]);

    // On arrival, and when the code is cleared to request a new one.
    useEffect(() => {
        if (!value) cells.current[0]?.focus();
    }, [value]);

    const focusCell = (index: number) => {
        const cell = cells.current[index];
        cell?.focus();
        cell?.select();
    };

    const insert = (index: number, digits: string) => {
        // A whole code replaces the current one, whichever cell it landed in.
        if (digits.length >= CODE_LENGTH) {
            onChange(digits.slice(-CODE_LENGTH));
            focusCell(CODE_LENGTH - 1);
            return;
        }
        onChange((value.slice(0, index) + digits + value.slice(index + digits.length)).slice(0, CODE_LENGTH));
        focusCell(Math.min(index + digits.length, CODE_LENGTH - 1));
    };

    const handleChange = (index: number, raw: string) => {
        const current = value[index] ?? "";
        if (!raw) {
            onChange(value.slice(0, index) + value.slice(index + 1));
            return;
        }

        const digits = raw.replace(/\D/g, "");
        if (!digits || (digits === current && digits.length < raw.length)) return;

        // Without a selection (a tap on iOS drops it), a new digit lands beside the old one.
        const typed = current && digits.length === 2 ? (digits[0] === current ? digits[1] : digits[0]) : digits;
        insert(index, typed);
    };

    const handlePaste = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        // Pasted codes may come with spaces or dashes.
        const digits = e.clipboardData.getData("text").replace(/\D/g, "");
        if (digits) insert(index, digits);
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !value[index] && index > 0) {
            e.preventDefault();
            onChange(value.slice(0, index - 1));
            focusCell(index - 1);
        } else if (e.key === "ArrowLeft" && index > 0) {
            e.preventDefault();
            focusCell(index - 1);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            focusCell(Math.min(index + 1, value.length, CODE_LENGTH - 1));
        }
    };

    return (
        <div role="group" aria-label={label} className={styles.codeCells}>
            {Array.from({ length: CODE_LENGTH }, (_, index) => (
                <input
                    key={index}
                    ref={(el) => {
                        cells.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    // One tab stop for the whole code; the arrow keys move inside it.
                    tabIndex={index === Math.min(value.length, CODE_LENGTH - 1) ? 0 : -1}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    aria-label={`${label} ${index + 1}/${CODE_LENGTH}`}
                    aria-invalid={invalid}
                    value={value[index] ?? ""}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onPaste={(e) => handlePaste(index, e)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onClick={() => focusCell(Math.min(index, value.length, CODE_LENGTH - 1))}
                    className={`${sharedStyles.input} ${styles.codeCell} ${invalid ? styles.inputError : ""}`}
                />
            ))}
        </div>
    );
};

export default CodeInput;
