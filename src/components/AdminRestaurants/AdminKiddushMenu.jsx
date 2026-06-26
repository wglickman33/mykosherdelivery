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
  '8_12': '8–12',
  '15_20': '15–20',
  '25_plus': '25+'
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
      name: row.name || '',
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

  const handleDeactivate = async (row) => {
    if (!window.confirm(`Deactivate “${row.name}”? It will no longer appear on the storefront.`)) return;
    try {
      const res = await apiClient.delete(`/admin/kiddush-packages/${row.id}`);
      if (res?.success) {
        showNotification?.('Package deactivated', 'success');
        load();
      } else {
        showNotification?.(res?.error || 'Deactivate failed', 'error');
      }
    } catch (e) {
      showNotification?.(e?.message || 'Deactivate failed', 'error');
    }
  };

  return (
    <div className="admin-kiddush-menu">
      <div className="admin-kiddush-menu__toolbar">
        <div className="admin-kiddush-menu__filters">
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
        <div className="admin-kiddush-menu__actions">
          <button type="button" className="admin-kiddush-menu__btn" onClick={() => load()}>
            Refresh
          </button>
          <button type="button" className="admin-kiddush-menu__btn admin-kiddush-menu__btn--primary" onClick={openCreate}>
            Add package
          </button>
        </div>
      </div>

      {loading ? (
        <div className="admin-kiddush-menu__loading">
          <LoadingSpinner size="medium" text="Loading packages…" variant="primary" />
        </div>
      ) : (
        <div className="admin-kiddush-menu__table-wrap">
          <table className="admin-kiddush-menu__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Size</th>
                <th>Price</th>
                <th>Order</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.category === 'shalom_zachor' ? 'Shalom Zachor' : 'Kiddush'}</td>
                  <td>{SIZE_LABEL[row.sizeTier] || row.sizeTier}</td>
                  <td>${Number(row.price).toFixed(2)}</td>
                  <td>{row.displayOrder ?? 0}</td>
                  <td>{row.isActive ? 'Yes' : 'No'}</td>
                  <td className="admin-kiddush-menu__row-actions">
                    <button type="button" className="admin-kiddush-menu__linkish" onClick={() => openEdit(row)}>
                      Edit
                    </button>
                    {row.isActive && (
                      <button
                        type="button"
                        className="admin-kiddush-menu__linkish admin-kiddush-menu__linkish--danger"
                        onClick={() => handleDeactivate(row)}
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

      {modalOpen && (
        <div
          className="admin-kiddush-menu__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kiddush-edit-title"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div className="admin-kiddush-menu__modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="kiddush-edit-title">{form.id ? 'Edit package' : 'New package'}</h2>
            {!form.id && (
              <div className="admin-kiddush-menu__field-row">
                <div className="admin-kiddush-menu__field">
                  <label>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  >
                    <option value="kiddush">Kiddush</option>
                    <option value="shalom_zachor">Shalom Zachor</option>
                  </select>
                </div>
                <div className="admin-kiddush-menu__field">
                  <label>Size tier</label>
                  <select
                    value={form.sizeTier}
                    onChange={(e) => setForm((p) => ({ ...p, sizeTier: e.target.value }))}
                  >
                    <option value="8_12">8–12 guests</option>
                    <option value="15_20">15–20 guests</option>
                    <option value="25_plus">25+ guests</option>
                  </select>
                </div>
              </div>
            )}
            {form.id && (
              <p className="admin-kiddush-menu__readonly">
                {form.category === 'shalom_zachor' ? 'Shalom Zachor' : 'Kiddush'} ·{' '}
                {SIZE_LABEL[form.sizeTier] || form.sizeTier} guests
              </p>
            )}
            <div className="admin-kiddush-menu__field">
              <label>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                maxLength={255}
              />
            </div>
            <div className="admin-kiddush-menu__field-row">
              <div className="admin-kiddush-menu__field">
                <label>Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                />
              </div>
              <div className="admin-kiddush-menu__field">
                <label>Display order</label>
                <input
                  type="number"
                  min="0"
                  value={form.displayOrder}
                  onChange={(e) => setForm((p) => ({ ...p, displayOrder: e.target.value }))}
                />
              </div>
            </div>
            <div className="admin-kiddush-menu__field">
              <label>Short description (optional)</label>
              <textarea
                rows={2}
                value={form.shortDescription}
                onChange={(e) => setForm((p) => ({ ...p, shortDescription: e.target.value }))}
              />
            </div>
            <div className="admin-kiddush-menu__field">
              <label>Image URL (optional)</label>
              <input
                type="text"
                value={form.imageUrl}
                onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
              />
            </div>
            <div className="admin-kiddush-menu__field">
              <label>Included items (one line each)</label>
              {form.includedLines.map((line, i) => (
                <div key={i} className="admin-kiddush-menu__line-row">
                  <input
                    type="text"
                    value={line}
                    onChange={(e) => setLine(i, e.target.value)}
                    placeholder="e.g. Cholent tray (half)"
                  />
                  <button type="button" className="admin-kiddush-menu__icon-btn" onClick={() => removeLine(i)}>
                    −
                  </button>
                </div>
              ))}
              <button type="button" className="admin-kiddush-menu__btn" onClick={addLine}>
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
              <button type="button" className="admin-kiddush-menu__btn" disabled={saving} onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-kiddush-menu__btn admin-kiddush-menu__btn--primary"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
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
