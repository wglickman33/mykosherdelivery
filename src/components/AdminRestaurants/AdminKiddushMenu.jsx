import './AdminKiddushMenu.scss';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import apiClient from '../../lib/api';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import MenuItemModal from './MenuItemModal';
import { buildImageUrl } from '../../services/imageService';
import {
  fetchKiddushMenuItems,
  deleteKiddushMenuItem,
  duplicateKiddushMenuItem,
  getItemTypeDisplayName
} from '../../services/kiddushMenuItemService';

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

const cleanDisplayText = (text) => {
  if (!text) return '';
  return String(text).replace(/\u2014/g, ', ').replace(/\u2013/g, '-');
};

const packageLabel = (row) =>
  `${CATEGORY_LABEL[row.category] || row.category}, ${SIZE_LABEL[row.sizeTier] || row.sizeTier} guests`;

const emptyForm = () => ({
  id: null,
  category: 'kiddush',
  sizeTier: '8_12',
  name: '',
  price: '',
  shortDescription: '',
  imageUrl: '',
  isActive: true,
  displayOrder: 0
});

export default function AdminKiddushMenu({ showNotification }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [view, setView] = useState('packages');
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [menuItemsLoading, setMenuItemsLoading] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [duplicatingItemId, setDuplicatingItemId] = useState(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState(null);
  const [deletingItem, setDeletingItem] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const showNotificationRef = useRef(showNotification);
  showNotificationRef.current = showNotification;

  const notify = useCallback((message, type) => {
    showNotificationRef.current?.(message, type);
  }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiClient.get('/admin/kiddush-packages', { includeInactive: 'true' });
      if (res?.success && Array.isArray(res.data)) {
        setPackages(res.data);
      } else {
        setPackages([]);
        notify(res?.error || 'Failed to load Kiddush packages', 'error');
      }
    } catch (e) {
      setPackages([]);
      notify(e?.message || 'Failed to load Kiddush packages', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [notify]);

  const loadMenuItems = useCallback(async (packageId, search = '', { silent = false } = {}) => {
    if (!packageId) return;
    if (!silent) setMenuItemsLoading(true);
    try {
      const res = await fetchKiddushMenuItems(packageId, {
        search: search.trim() || undefined,
        limit: 100
      });
      if (res?.success !== false) {
        setMenuItems(Array.isArray(res.data) ? res.data : []);
      } else {
        setMenuItems([]);
        notify(res?.error || 'Failed to load package items', 'error');
      }
    } catch (e) {
      setMenuItems([]);
      notify(e?.message || 'Failed to load package items', 'error');
    } finally {
      if (!silent) setMenuItemsLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (view === 'items' && selectedPackage?.id) {
      loadMenuItems(selectedPackage.id);
    }
    // Only reload items when entering a package view, not after every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedPackage?.id]);

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

  const openPackageItems = (row) => {
    setSelectedPackage(row);
    setItemSearch('');
    setView('items');
  };

  const backToPackages = () => {
    setView('packages');
    setSelectedPackage(null);
    setMenuItems([]);
    setSelectedMenuItem(null);
    setShowItemModal(false);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const openCreate = () => {
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setForm({
      id: row.id,
      category: row.category,
      sizeTier: row.sizeTier,
      name: cleanDisplayText(row.name || ''),
      price: row.price != null ? String(row.price) : '',
      shortDescription: row.shortDescription || '',
      imageUrl: row.imageUrl || '',
      isActive: !!row.isActive,
      displayOrder: row.displayOrder ?? 0
    });
    setModalOpen(true);
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

    const payload = {
      name: form.name.trim(),
      price: priceNum,
      shortDescription: form.shortDescription.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      isActive: form.isActive,
      displayOrder: parseInt(form.displayOrder, 10) || 0
    };

    setSaving(true);
    try {
      if (form.id) {
        const res = await apiClient.put(`/admin/kiddush-packages/${form.id}`, payload);
        if (res?.success) {
          notify('Package updated', 'success');
          setModalOpen(false);
          setPackages((prev) =>
            prev.map((p) => (p.id === form.id ? { ...p, ...res.data } : p))
          );
          if (selectedPackage?.id === form.id) {
            setSelectedPackage((prev) => ({ ...prev, ...res.data }));
          }
        } else {
          notify(res?.error || 'Update failed', 'error');
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
          sizeTier: form.sizeTier,
          includedItems: []
        });
        if (res?.success) {
          notify('Package created', 'success');
          setModalOpen(false);
          setPackages((prev) => [...prev, res.data]);
        } else {
          notify(res?.error || 'Create failed', 'error');
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
        notify('Package deactivated', 'success');
        setDeactivateTarget(null);
        if (selectedPackage?.id === deactivateTarget.id) {
          backToPackages();
        }
        setPackages((prev) =>
          prev.map((p) =>
            p.id === deactivateTarget.id ? { ...p, isActive: false } : p
          )
        );
      } else {
        notify(res?.error || 'Deactivate failed', 'error');
      }
    } catch (e) {
      showNotification?.(e?.message || 'Deactivate failed', 'error');
    } finally {
      setDeactivating(false);
    }
  };

  const handleItemSaved = (savedItem) => {
    setMenuItems((prev) => {
      const idx = prev.findIndex((i) => i.id === savedItem.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedItem;
        return next;
      }
      return [...prev, savedItem];
    });
    showNotification?.('Menu item saved', 'success');
  };

  const handleDuplicateItem = async (item) => {
    if (!selectedPackage?.id) return;
    setDuplicatingItemId(item.id);
    try {
      const res = await duplicateKiddushMenuItem(selectedPackage.id, item.id);
      if (res?.success && res.data) {
        setMenuItems((prev) => [...prev, res.data]);
        showNotification?.(res.message || 'Item duplicated', 'success');
      } else {
        showNotification?.(res?.error || 'Duplicate failed', 'error');
      }
    } catch (e) {
      showNotification?.(e?.message || 'Duplicate failed', 'error');
    } finally {
      setDuplicatingItemId(null);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItemTarget || !selectedPackage?.id) return;
    setDeletingItem(true);
    try {
      const res = await deleteKiddushMenuItem(selectedPackage.id, deleteItemTarget.id);
      if (res?.success !== false) {
        setMenuItems((prev) => prev.filter((i) => i.id !== deleteItemTarget.id));
        showNotification?.('Menu item deleted', 'success');
        setDeleteItemTarget(null);
      } else {
        showNotification?.(res?.error || 'Delete failed', 'error');
      }
    } catch (e) {
      showNotification?.(e?.message || 'Delete failed', 'error');
    } finally {
      setDeletingItem(false);
    }
  };

  const kiddushPackageForModal = selectedPackage
    ? { id: selectedPackage.id, name: packageLabel(selectedPackage) }
    : null;

  return (
    <div className="admin-kiddush-menu">
      {view === 'packages' ? (
        <>
          <div className="admin-kiddush-menu__intro">
            <h3>Kiddush &amp; Shalom Zachor packages</h3>
            <p>
              Manage guest-count packages, then add regular, variable, and configurable items
              to each package for customers to build their order.
            </p>
          </div>

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
                      <th>Items</th>
                      <th title="Sort order on the storefront within each category">Sort</th>
                      <th>Active</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row) => (
                      <tr key={row.id} className="admin-kiddush-menu__row">
                        <td className="admin-kiddush-menu__name">{cleanDisplayText(row.name)}</td>
                        <td>{CATEGORY_LABEL[row.category] || row.category}</td>
                        <td>{SIZE_LABEL[row.sizeTier] || row.sizeTier} guests</td>
                        <td>${Number(row.price).toFixed(2)}</td>
                        <td>{row.menuItemCount ?? 0}</td>
                        <td>{row.displayOrder ?? 0}</td>
                        <td>
                          <span className={`admin-kiddush-menu__status ${row.isActive ? 'is-active' : 'is-inactive'}`}>
                            {row.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="admin-kiddush-menu__row-actions">
                          <button
                            type="button"
                            className="manage-btn"
                            onClick={() => openPackageItems(row)}
                          >
                            Manage items
                          </button>
                          <button type="button" className="edit-btn" onClick={() => openEdit(row)}>
                            Edit
                          </button>
                          {row.isActive && (
                            <button
                              type="button"
                              className="delete-btn"
                              onClick={() => setDeactivateTarget(row)}
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
        </>
      ) : (
        <>
          <div className="admin-kiddush-menu__items-header">
            <button type="button" className="admin-kiddush-menu__back-btn" onClick={backToPackages}>
              ← Back to packages
            </button>
            <div className="admin-kiddush-menu__items-title">
              <h3>{cleanDisplayText(selectedPackage?.name)}</h3>
              <p>{selectedPackage ? packageLabel(selectedPackage) : ''} · Configure package menu items</p>
            </div>
            <button
              type="button"
              className="admin-kiddush-menu__btn admin-kiddush-menu__btn--primary"
              onClick={() => {
                setSelectedMenuItem(null);
                setShowItemModal(true);
              }}
            >
              Add menu item
            </button>
          </div>

          <div className="admin-kiddush-menu__items-controls">
            <input
              type="text"
              className="admin-kiddush-menu__search"
              placeholder="Search items by name or section..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && selectedPackage?.id) {
                  loadMenuItems(selectedPackage.id, e.target.value);
                }
              }}
            />
            <button
              type="button"
              className="admin-kiddush-menu__btn admin-kiddush-menu__btn--secondary"
              onClick={() => selectedPackage?.id && loadMenuItems(selectedPackage.id)}
            >
              Search
            </button>
            <button
              type="button"
              className="admin-kiddush-menu__btn admin-kiddush-menu__btn--secondary"
              onClick={() => selectedPackage && openEdit(selectedPackage)}
            >
              Edit package
            </button>
          </div>

          {menuItemsLoading ? (
            <div className="admin-kiddush-menu__loading">
              <LoadingSpinner size="medium" text="Loading menu items..." variant="primary" />
            </div>
          ) : menuItems.length === 0 ? (
            <div className="admin-kiddush-menu__empty admin-kiddush-menu__empty--items">
              <p>No menu items in this package yet.</p>
              <p>Add regular, variable, or configurable items for customers to build their package.</p>
              <button
                type="button"
                className="admin-kiddush-menu__btn admin-kiddush-menu__btn--primary"
                onClick={() => {
                  setSelectedMenuItem(null);
                  setShowItemModal(true);
                }}
              >
                Add first menu item
              </button>
            </div>
          ) : (
            <div className="admin-kiddush-menu__items-grid">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className={`admin-kiddush-menu__item-card ${!item.available ? 'is-unavailable' : ''} ${item.featured ? 'is-featured' : ''}`}
                >
                  {!item.available && (
                    <span className="admin-kiddush-menu__item-badge admin-kiddush-menu__item-badge--muted">
                      Unavailable
                    </span>
                  )}
                  <div className="admin-kiddush-menu__item-image">
                    {item.imageUrl ? (
                      <img src={buildImageUrl(item.imageUrl)} alt={item.name} />
                    ) : (
                      <span>No image</span>
                    )}
                  </div>
                  <div className="admin-kiddush-menu__item-body">
                    <h4>{item.name}</h4>
                    <p className="admin-kiddush-menu__item-section">{item.category}</p>
                    <p className="admin-kiddush-menu__item-price">${(parseFloat(item.price) || 0).toFixed(2)}</p>
                    <div className="admin-kiddush-menu__item-pills">
                      <span className="admin-kiddush-menu__item-pill admin-kiddush-menu__item-pill--type">
                        {getItemTypeDisplayName(item.itemType)}
                      </span>
                      {item.featured && (
                        <span className="admin-kiddush-menu__item-pill admin-kiddush-menu__item-pill--featured">
                          Featured
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="admin-kiddush-menu__item-desc">{item.description}</p>
                    )}
                  </div>
                  <div className="admin-kiddush-menu__item-actions">
                    <button
                      type="button"
                      className="edit-btn"
                      onClick={() => {
                        setSelectedMenuItem(item);
                        setShowItemModal(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="duplicate-btn"
                      disabled={duplicatingItemId === item.id}
                      onClick={() => handleDuplicateItem(item)}
                    >
                      {duplicatingItemId === item.id ? 'Duplicating…' : 'Duplicate'}
                    </button>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => setDeleteItemTarget(item)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

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
                  <label htmlFor="kiddush-form-price">Base package price</label>
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
              <p className="admin-kiddush-menu__hint">
                Add individual menu items (regular, variable, configurable) from the Manage items screen.
              </p>
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

      {showItemModal && kiddushPackageForModal && (
        <MenuItemModal
          isOpen={showItemModal}
          onClose={() => {
            setShowItemModal(false);
            setSelectedMenuItem(null);
          }}
          kiddushPackage={kiddushPackageForModal}
          menuItem={selectedMenuItem}
          onSave={handleItemSaved}
        />
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

      {deleteItemTarget && (
        <div
          className="admin-kiddush-menu__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kiddush-delete-item-title"
          onClick={() => !deletingItem && setDeleteItemTarget(null)}
        >
          <div className="admin-kiddush-menu__modal admin-kiddush-menu__modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="admin-kiddush-menu__modal-header">
              <h2 id="kiddush-delete-item-title">Delete menu item</h2>
              <button
                type="button"
                className="admin-kiddush-menu__modal-close"
                onClick={() => !deletingItem && setDeleteItemTarget(null)}
                disabled={deletingItem}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="admin-kiddush-menu__modal-content">
              <p className="admin-kiddush-menu__confirm-text">
                Delete <strong>{deleteItemTarget.name}</strong>? This cannot be undone.
              </p>
              <div className="admin-kiddush-menu__modal-actions">
                <button
                  type="button"
                  className="admin-kiddush-menu__btn admin-kiddush-menu__btn--secondary"
                  disabled={deletingItem}
                  onClick={() => setDeleteItemTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-kiddush-menu__btn admin-kiddush-menu__btn--danger"
                  disabled={deletingItem}
                  onClick={handleDeleteItem}
                >
                  {deletingItem ? 'Deleting...' : 'Delete'}
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
