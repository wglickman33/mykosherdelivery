import PropTypes from 'prop-types';
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import './Pagination.scss';

const DEFAULT_ROW_OPTIONS = [10, 20, 30, 40, 50];

const Pagination = ({
  page,
  totalPages,
  rowsPerPage,
  total,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = DEFAULT_ROW_OPTIONS,
  showRowsPerPage = true,
  className = ''
}) => {
  const safePage = Math.max(1, Math.min(page, Math.max(1, totalPages)));
  const totalPagesSafe = Math.max(1, totalPages);

  return (
    <div className={`pagination-bar ${className}`.trim()} role="navigation" aria-label="Pagination">
      <div className="pagination-bar__left">
        {showRowsPerPage && onRowsPerPageChange && (
          <label className="pagination-bar__rows-label">
            Rows per page
            <select
              className="pagination-bar__rows-select"
              value={rowsPerPage}
              onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {rowsPerPageOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="pagination-bar__center">
        <span className="pagination-bar__page-info">
          Page {safePage} of {totalPagesSafe}
        </span>
      </div>
      <div className="pagination-bar__right">
        <div className="pagination-bar__nav">
          <button
            type="button"
            className="pagination-bar__btn"
            onClick={() => onPageChange(1)}
            disabled={safePage <= 1}
            aria-label="First page"
          >
            <ChevronsLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            className="pagination-bar__btn"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            className="pagination-bar__btn"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPagesSafe}
            aria-label="Next page"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
          <button
            type="button"
            className="pagination-bar__btn"
            onClick={() => onPageChange(totalPagesSafe)}
            disabled={safePage >= totalPagesSafe}
            aria-label="Last page"
          >
            <ChevronsRight size={18} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
};

Pagination.propTypes = {
  page: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  rowsPerPage: PropTypes.number,
  total: PropTypes.number,
  onPageChange: PropTypes.func.isRequired,
  onRowsPerPageChange: PropTypes.func,
  rowsPerPageOptions: PropTypes.arrayOf(PropTypes.number),
  showRowsPerPage: PropTypes.bool,
  className: PropTypes.string
};

export default Pagination;
