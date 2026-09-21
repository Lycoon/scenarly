"use client";

import popup from "./Popup.module.css";
import styles from "./PopupSubmitToCoverage.module.css";

import { X } from "lucide-react";
import { useContext, useState } from "react";
import { useTranslations } from "next-intl";

import { UserContext } from "@src/context/UserContext";
import { useDraggable } from "@src/lib/utils/hooks";
import { PopupData, PopupSubmitToCoverageData, closePopup } from "@src/lib/screenplay/popup";
import { useCommunityMe } from "@src/lib/community/hooks";
import SubmitForm from "@components/community/SubmitForm";
import Loading from "@components/utils/Loading";

/**
 * "Submit this project to Coverage": the shared submission form over the
 * editor's own PDF export. Members see the form; everyone else is pointed to
 * the Community pages, where the entry gate and the join step live.
 */
const PopupSubmitToCoverage = ({ data }: PopupData<PopupSubmitToCoverageData>) => {
    const userCtx = useContext(UserContext);
    const { position, handleMouseDown, isDragging } = useDraggable();
    const t = useTranslations("popup.submitToCoverage");
    const tNav = useTranslations("navbar");
    const { me, isLoading } = useCommunityMe();
    const [submittedId, setSubmittedId] = useState<string | null>(null);

    const onClose = () => closePopup(userCtx);

    return (
        <div className={popup.window}>
            <div
                className={`${popup.container} ${styles.container}`}
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
            >
                <div className={popup.header} onMouseDown={handleMouseDown} style={{ cursor: isDragging ? "grabbing" : "grab" }}>
                    <h2 className={popup.title}>{t("title")}</h2>
                    <button className={popup.close_btn} onClick={onClose} aria-label={tNav("close")}>
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.body}>
                    {isLoading ? (
                        <Loading />
                    ) : submittedId ? (
                        <div className={popup.info}>
                            <p>{t("done")}</p>
                            <div className={popup.buttons}>
                                <a className={popup.confirm} href={`/community/coverage/submissions/${submittedId}`} target="_blank" rel="noreferrer">
                                    {t("open")}
                                </a>
                                <button className={popup.cancel} onClick={onClose}>
                                    {tNav("close")}
                                </button>
                            </div>
                        </div>
                    ) : me?.profile ? (
                        <SubmitForm
                            source={{ kind: "project", projectId: data.projectId, buildPdf: data.buildPdf }}
                            initialTitle={data.title}
                            initialLogline={data.logline}
                            onSubmitted={setSubmittedId}
                            onCancel={onClose}
                        />
                    ) : (
                        <div className={popup.info}>
                            <p>{t("notMember")}</p>
                            <div className={popup.buttons}>
                                <a className={popup.confirm} href="/community/coverage" target="_blank" rel="noreferrer">
                                    {t("openCommunity")}
                                </a>
                                <button className={popup.cancel} onClick={onClose}>
                                    {tNav("close")}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PopupSubmitToCoverage;
