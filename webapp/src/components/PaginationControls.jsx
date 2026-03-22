import React from "react";

export default function PaginationControls({ page, totalPages, pageSize, onPageChange, onPageSizeChange }) {
  return (
    <div className="paginationControls" aria-label="Controles de paginación">
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        Anterior
      </button>

      <span>
        Página {page} de {totalPages}
      </span>

      <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        Siguiente
      </button>

      <label>
        Tamaño
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </label>
    </div>
  );
}
