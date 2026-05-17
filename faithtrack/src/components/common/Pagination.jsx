import React from 'react';
import './Pagination.css';

/**
 * Reusable pagination bar.
 * Props: currentPage, totalPages, totalItems, pageSize, onPageChange
 */
export default function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  // Build page number buttons — show max 5 around current
  const pages = [];
  const delta = 2;
  const left = Math.max(1, currentPage - delta);
  const right = Math.min(totalPages, currentPage + delta);

  if (left > 1) {
    pages.push(1);
    if (left > 2) pages.push('...');
  }
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages) {
    if (right < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="pagination-bar" role="navigation" aria-label="Pagination">
      <span className="pagination-info">
        {start}–{end} of {totalItems}
      </span>
      <div className="pagination-controls">
        <button
          className="pagination-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={`pagination-btn pagination-num ${p === currentPage ? 'active' : ''}`}
              onClick={() => onPageChange(p)}
              aria-current={p === currentPage ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}
        <button
          className="pagination-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}
