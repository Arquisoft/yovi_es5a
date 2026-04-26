import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

export default function HelpModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const closeButtonRef = useRef(null);

  const handleBackdropKey = (e) => {
    const key = e.key;
    if (key === "Enter" || key === " " || key === "Spacebar") {
      e.preventDefault();
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const timer = setTimeout(() => closeButtonRef.current?.focus(), 0);

    const onKey = (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="helpModalBackdrop"
      onClick={onClose}
      role="button"
      aria-label={t("help.closeAria")}
      tabIndex={0}
      onKeyDown={handleBackdropKey}
    >
      <section
        className="helpModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="helpModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="helpModalHeader">
          <h2 id="helpModalTitle">{t("help.modalTitle")}</h2>
          <button
            type="button"
            ref={closeButtonRef}
            className="helpCloseButton"
            onClick={onClose}
            aria-label={t("help.closeAria")}
          >
            ×
          </button>
        </header>
        <div className="helpModalContent">
          <h3>{t("help.rulesTitle")}</h3>
          <p>{t("help.rulesDescription")}</p>

          <h3>{t("help.howToPlayTitle")}</h3>
          <ol>
            <li>{t("help.howToPlay.step1")}</li>
            <li>{t("help.howToPlay.step2")}</li>
            <li>{t("help.howToPlay.step3")}</li>
            <li>{t("help.howToPlay.step4")}</li>
            <li>{t("help.howToPlay.step5")}</li>
            <li>{t("help.howToPlay.step6")}</li>
          </ol>

          <h3>{t("help.boardSizeTitle")}</h3>
          <p>{t("help.boardSizeDescription")}</p>

          <h3>{t("help.tipsTitle")}</h3>
          <ul>
            <li>{t("help.tip1")}</li>
            <li>{t("help.tip2")}</li>
            <li>{t("help.tip3")}</li>
          </ul>

          <p>{t("help.finalParagraph")}</p>
        </div>
      </section>
    </div>
  );
}
