import { useState, useEffect, useMemo } from 'react';

/**
 * Simple client-side pagination hook.
 * Resets to page 1 whenever the source data or page size changes.
 */
export function usePagination(items, pageSize = 10) {
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when data or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [items, pageSize]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const goToPage = (page) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  return {
    paginatedItems,
    currentPage,
    totalPages,
    totalItems: items.length,
    goToPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
  };
}
