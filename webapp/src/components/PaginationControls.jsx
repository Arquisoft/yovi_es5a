import React from "react";
import { useTranslation } from "react-i18next";

export default function PaginationControls({ page, totalPages, pageSize, onPageChange, onPageSizeChange }) {
  const { t } = useTranslation();

  return (
    <div className="paginationControls" aria-label={t("pagination.ariaLabel")}>
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        {t("pagination.previous")}
      </button>

      <span>
        {t("pagination.pageInfo", { page, totalPages })}
      </span>

      <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        {t("pagination.next")}
      </button>

      <label>
        {t("pagination.size")}
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </label>
    </div>
  );
}
