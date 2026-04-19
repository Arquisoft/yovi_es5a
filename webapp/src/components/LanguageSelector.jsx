import React from "react";
import { useTranslation } from "react-i18next";

const languages = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
];

export default function LanguageSelector() {
  const { t, i18n } = useTranslation();

  function handleLanguageChange(event) {
    const nextLanguage = event.target.value;
    i18n.changeLanguage(nextLanguage);
  }

  return (
    <div className="languageSelector">
      <label htmlFor="languageSelector">{t("app.language")}</label>
      <select
        id="languageSelector"
        value={i18n.language?.split("-")[0] || "es"}
        onChange={handleLanguageChange}
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
    </div>
  );
}
