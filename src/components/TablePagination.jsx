const pageButtonClass = "rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50";
const activePageClass = "rounded-lg bg-[#0D8252] px-3 py-1.5 text-xs font-bold text-white";

export default function TablePagination({ page, totalPages, onPageChange, disabled = false, previousLabel = "Previous", className = "gap-1.5" }) {
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  const currentPage = Math.min(Math.max(1, Number(page) || 1), safeTotalPages);

  return (
    <div className={`flex items-center ${className}`}>
      <button type="button" className={pageButtonClass} disabled={disabled || currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>{previousLabel}</button>
      {Array.from({ length: safeTotalPages }, (_, index) => index + 1).map((pageNumber) => (
        <button
          key={pageNumber}
          type="button"
          className={pageNumber === currentPage ? activePageClass : pageButtonClass}
          disabled={disabled || pageNumber === currentPage}
          onClick={() => onPageChange(pageNumber)}
          aria-current={pageNumber === currentPage ? "page" : undefined}
        >
          {pageNumber}
        </button>
      ))}
      <button type="button" className={pageButtonClass} disabled={disabled || currentPage >= safeTotalPages} onClick={() => onPageChange(currentPage + 1)}>Next</button>
    </div>
  );
}
