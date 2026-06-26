import './AdminKiddushMenu.scss';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import apiClient from '../../lib/api';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';

const CATEGORIES = [
  { value: 'all', label: 'All categories' },
  { value: 'kiddush', label: 'Kiddush' },
  { value: 'shalom_zachor', label: 'Shalom Zachor' }
];

const SIZE_LABEL = {
  '8_12': '8-12',
  '15_20': '15-20',
  '25_plus': '25+'
};

const CATEGORY_LABEL = {
  kiddush: 'Kiddush',
  shalom_zachor: 'Shalom Zachor'
};

/** Strip em/en dashes from seeded or legacy names for display. */
const cleanDisplayText = (text) => {
  if (!text) return '';
  return String(text).replace(/\u2014/g, ', ').replace(/\u2013/g, '-');
};

const emptyForm = () => ({
  id: null,
  category: 'kiddush',
  sizeTier: '8_12',
  name: '',
  price: '',
  shortDescription: '',
  includedLines: [''],
  imageUrl: '',
  isActive: true,
  displayOrder: 0
});

export default function AdminKiddushMenu({ showNotification }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/kiddush-packages', { includeInactive: 'true' });
      if (res?.success && Array.isArray(res.data)) {
        setPackages(res.data);
      } else {
        setPackages([]);
        showNotification?.(res?.error || 'Failed to load Kiddush packages', 'error');
      }
    } catch (e) {
      setPackages([]);
      showNotification?.(e?.message || 'Failed to load Kiddush packages', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return packages;
    return packages.filter((p) => p.category === categoryFilter);
  }, [packages, categoryFilter]);

  const sorted = useMemo(() => {
    const tierOrder = { '8_12': 0, '15_20': 1, '25_plus': 2 };
    return [...filtered].sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if ((a.displayOrder ?? 0) !== (b.displayOrder ?? 0)) {
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      }
      return (tierOrder[a.sizeTier] ?? 9) - (tierOrder[b.sizeTier] ?? 9);
    });
  }, [filtered]);

  const takenCombos = useMemo(() => {
    const s = new Set();
    packages.forEach((p) => s.add(`${p.category}:${p.sizeTier}`));
    return s;
  }, [packages]);

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const openCreate = () => {
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (row) => {
    const lines = Array.isArray(row.includedItems) && row.includedItems.length
      ? [...row.includedItems]
      : [''];
    setForm({
      id: row.id,
      category: row.category,
      sizeTier: row.sizeTier,
      name: cleanDisplayText(row.name || ''),
      price: row.price != null ? String(row.price) : '',
      shortDescription: row.shortDescription || '',
      includedLines: lines,
      imageUrl: row.imageUrl || '',
      isActive: !!row.isActive,
      displayOrder: row.displayOrder ?? 0
    });
    setModalOpen(true);
  };

  const setLine = (index, value) => {
    setForm((prev) => {
      const next = [...prev.includedLines];
      next[index] = value;
      return { ...prev, includedLines: next };
    });
  };

  const addLine = () => {
    setForm((prev) => ({ ...prev, includedLines: [...prev.includedLines, ''] }));
  };

  const removeLine = (index) => {
    setForm((prev) => {
      const next = prev.includedLines.filter((_, i) => i !== index);
      return { ...prev, includedLines: next.length ? next : [''] };
    });
  };

  const handleSave = async () => {
    const priceNum = parseFloat(form.price);
    if (!form.name.trim()) {
      showNotification?.('Name is required', 'warning');
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      showNotification?.('Valid price is required', 'warning');
      return;
    }
    const includedItems = form.includedLines.map((s) => s.trim()).filter(Boolean);

    const payload = {
      name: form.name.trim(),
      price: priceNum,
      shortDescription: form.shortDescription.trim() || null,
      includedItems,
      imageUrl: form.imageUrl.trim() || null,
      isActive: form.isActive,
      displayOrder: parseInt(form.displayOrder, 10) || 0
    };

    setSaving(true);
    try {
      if (form.id) {
        const res = await apiClient.put(`/admin/kiddush-packages/${form.id}`, payload);
        if (res?.success) {
          showNotification?.('Package updated', 'success');
          setModalOpen(false);
          load();
        } else {
          showNotification?.(res?.error || 'Update failed', 'error');
        }
      } else {
        const combo = `${form.category}:${form.sizeTier}`;
        if (takenCombos.has(combo)) {
          showNotification?.('That category and size already exists. Edit it instead.', 'warning');
          setSaving(false);
          return;
        }
        const res = await apiClient.post('/admin/kiddush-packages', {
          ...payload,
          category: form.category,
          sizeTier: form.sizeTier
        });
        if (res?.success) {
          showNotification?.('Package created', 'success');
          setModalOpen(false);
          load();
        } else {
          showNotification?.(res?.error || 'Create failed', 'error');
        }
      }
    } catch (e) {
      showNotification?.(e?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      const res = await apiClient.delete(`/admin/kiddush-packages/${deactivateTarget.id}`);
      if (res?.success) {
        showNotification?.('Package deactivated', 'success');
        setDeactivateTarget(null);
        load();
      } else {
        showNotification?.(res?.error || 'Deactivate failed', 'error');
      }
    } catch (e) {
      showNotification?.(e?.message || 'Deactivate failed', 'error');
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="admin-kiddush-menu">
      <div className="admin-kiddush-menu__filters">
        <div className="admin-kiddush-menu__filter-group">
          <label htmlFor="kiddush-cat-filter">Category</label>
          <select
            id="kiddush-cat-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-kiddush-menu__filter-actions">
          <button type="button" className="admin-kiddush-menu__btn admin-kiddush-menu__btn--secondary" onClick={() => load()}>
            Refresh
          </button>
          <button type="button" className="admin-kiddush-menu__btn admin-kiddush-menu__btn--primary" onClick={openCreate}>
            Add package
          </button>
        </div>
      </div>

      <div className="admin-kiddush-menu__table-container">
        {loading ? (
          <div className="admin-kiddush-menu__loading">
            <LoadingSpinner size="medium" text="Loading packages..." variant="primary" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="admin-kiddush-menu__empty">
            <p>No packages found for this filter.</p>
            <button type="button" className="admin-kiddush-menu__btn admin-kiddush-menu__btn--primary" onClick={openCreate}>
              Add your first package
            </button>
          </div>
        ) : (
          <div className="admin-kiddush-menu__table-scroll">
            <table className="admin-kiddush-menu__table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th
                    title="Sort order on the storefront within each category. Lower numbers appear first (0 = smallest tier)."
                  >
                    Sort
                  </th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr
                    key={row.id}
                    className="admin-kiddush-menu__row"
                    onClick={() => openEdit(row)}
                  >
                    <td className="admin-kiddush-menu__name">{cleanDisplayText(row.name)}</td>
                    <td>{CATEGORY_LABEL[row.category] || row.category}</td>
                    <td>{SIZE_LABEL[row.sizeTier] || row.sizeTier} guests</td>
                    <td>${Number(row.price).toFixed(2)}</td>
                    <td>{row.displayOrder ?? 0}</td>
                    <td>
                      <span className={`admin-kiddush-menu__status ${row.isActive ? 'is-active' : 'is-inactive'}`}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="admin-kiddush-menu__row-actions">
                      <button
                        type="button"
                        className="edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(row);
                        }}
                      >
                        Edit
                      </button>
                      {row.isActive && (
                        <button
                          type="button"
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeactivateTarget(row);
                          }}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="admin-kiddush-menu__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kiddush-edit-title"
          onClick={closeModal}
        >
          <div className="admin-kiddush-menu__modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-kiddush-menu__modal-header">
              <h2 id="kiddush-edit-title">{form.id ? 'Edit package' : 'New package'}</h2>
              <button
                type="button"
                className="admin-kiddush-menu__modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="admin-kiddush-menu__modal-content">
              {!form.id && (
                <div className="admin-kiddush-menu__form-row">
                  <div className="admin-kiddush-menu__form-group">
                    <label htmlFor="kiddush-form-category">Category</label>
                    <select
                      id="kiddush-form-category"
                      value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    >
                      <option value="kiddush">Kiddush</option>
                      <option value="shalom_zachor">Shalom Zachor</option>
                    </select>
                  </div>
                  <div className="admin-kiddush-menu__form-group">
                    <label htmlFor="kiddush-form-size">Size tier</label>
                    <select
                      id="kiddush-form-size"
                      value={form.sizeTier}
                      onChange={(e) => setForm((p) => ({ ...p, sizeTier: e.target.value }))}
                    >
                      <option value="8_12">8-12 guests</option>
                      <option value="15_20">15-20 guests</option>
                      <option value="25_plus">25+ guests</option>
                    </select>
                  </div>
                </div>
              )}
              {form.id && (
                <p className="admin-kiddush-menu__readonly">
                  {CATEGORY_LABEL[form.category] || form.category},{' '}
                  {SIZE_LABEL[form.sizeTier] || form.sizeTier} guests
                </p>
              )}
              <div className="admin-kiddush-menu__form-group">
                <label htmlFor="kiddush-form-name">Name</label>
                <input
                  id="kiddush-form-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  maxLength={255}
                  placeholder="e.g. Kiddush, 8-12 guests"
                />
              </div>
              <div className="admin-kiddush-menu__form-row">
                <div className="admin-kiddush-menu__form-group">
                  <label htmlFor="kiddush-form-price">Price</label>
                  <input
                    id="kiddush-form-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                  />
                </div>
                <div className="admin-kiddush-menu__form-group">
                  <label htmlFor="kiddush-form-sort">Sort order</label>
                  <input
                    id="kiddush-form-sort"
                    type="number"
                    min="0"
                    value={form.displayOrder}
                    onChange={(e) => setForm((p) => ({ ...p, displayOrder: e.target.value }))}
                  />
                </div>
              </div>
              <div className="admin-kiddush-menu__form-group">
                <label htmlFor="kiddush-form-desc">Short description (optional)</label>
                <textarea
                  id="kiddush-form-desc"
                  rows={2}
                  value={form.shortDescription}
                  onChange={(e) => setForm((p) => ({ ...p, shortDescription: e.target.value }))}
                />
              </div>
              <div className="admin-kiddush-menu__form-group">
                <label htmlFor="kiddush-form-image">Image URL (optional)</label>
                <input
                  id="kiddush-form-image"
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
                />
              </div>
              <div className="admin-kiddush-menu__form-group">
                <label>Included items (one line each)</label>
                {form.includedLines.map((line, i) => (
                  <div key={i} className="admin-kiddush-menu__line-row">
                    <input
                      type="text"
                      value={line}
                      onChange={(e) => setLine(i, e.target.value)}
                      placeholder="e.g. Cholent tray (half)"
                    />
                    <button
                      type="button"
                      className="admin-kiddush-menu__icon-btn"
                      onClick={() => removeLine(i)}
                      aria-label="Remove line"
                    >
                      −
                    </button>
                  </div>
                ))}
                <button type="button" className="admin-kiddush-menu__btn admin-kiddush-menu__btn--secondary admin-kiddush-menu__btn--inline" onClick={addLine}>
                  Add line
                </button>
              </div>
              <label className="admin-kiddush-menu__check">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                Active on storefront
              </label>
              <div className="admin-kiddush-menu__modal-actions">
                <button type="button" className="admin-kiddush-menu__btn admin-kiddush-menu__btn--secondary" disabled={saving} onClick={closeModal}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-kiddush-menu__btn admin-kiddush-menu__btn--primary"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deactivateTarget && (
        <div
          className="admin-kiddush-menu__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kiddush-deactivate-title"
          onClick={() => !deactivating && setDeactivateTarget(null)}
        >
          <div className="admin-kiddush-menu__modal admin-kiddush-menu__modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="admin-kiddush-menu__modal-header">
              <h2 id="kiddush-deactivate-title">Deactivate package</h2>
              <button
                type="button"
                className="admin-kiddush-menu__modal-close"
                onClick={() => !deactivating && setDeactivateTarget(null)}
                disabled={deactivating}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="admin-kiddush-menu__modal-content">
              <p className="admin-kiddush-menu__confirm-text">
                Deactivate <strong>{cleanDisplayText(deactivateTarget.name)}</strong>? It will no longer appear on the storefront.
              </p>
              <div className="admin-kiddush-menu__modal-actions">
                <button
                  type="button"
                  className="admin-kiddush-menu__btn admin-kiddush-menu__btn--secondary"
                  disabled={deactivating}
                  onClick={() => setDeactivateTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-kiddush-menu__btn admin-kiddush-menu__btn--danger"
                  disabled={deactivating}
                  onClick={handleDeactivate}
                >
                  {deactivating ? 'Deactivating...' : 'Deactivate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

AdminKiddushMenu.propTypes = {
  showNotification: PropTypes.func.isRequired
};
