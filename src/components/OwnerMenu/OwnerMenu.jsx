import { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { getMenuItems, deleteMenuItem, importMenuFile } from '../../services/ownerService';
import MenuItemModal from '../AdminRestaurants/MenuItemModal';
import { getItemTypeDisplayName } from '../../services/menuItemService';
import './OwnerMenu.scss';

const OwnerMenu = () => {
  const { restaurantId } = useParams();
  const { currentRestaurant } = useOutletContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importReplace, setImportReplace] = useState(false);
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);

  const restaurant = currentRestaurant?.id === restaurantId ? currentRestaurant : { id: restaurantId, name: '' };

  const fetchItems = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const res = await getMenuItems(restaurantId, { limit: 100, offset: 0, category: categoryFilter !== 'all' ? categoryFilter : undefined });
      setItems(res.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, categoryFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))].sort();
  const itemsByCategory = categories.length
    ? categories.map(cat => ({ category: cat, items: items.filter(i => i.category === cat) }))
    : [{ category: 'Uncategorized', items }];

  const handleSave = () => {
    setEditingItem(null);
    fetchItems();
  };

  const handleDeleteConfirm = async (item) => {
    try {
      await deleteMenuItem(restaurantId, item.id);
      setDeleteConfirm(null);
      fetchItems();
    } catch (err) {
      setDeleteError(err?.message || 'Failed to delete item');
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setImportError('Choose a file');
      return;
    }
    setImportError(null);
    setImporting(true);
    try {
      const result = await importMenuFile(restaurantId, file, { replace: importReplace });
      setImportOpen(false);
      setImportReplace(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (result.created > 0 || result.replaced > 0) fetchItems();
      setImportSuccessMessage(result.message || `Imported: ${result.created} created, ${result.skipped} skipped.`);
    } catch (err) {
      setImportError(err?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (!restaurantId) return null;

  return (
    <div className="owner-menu">
      <div className="owner-menu__header">
        <h1 className="owner-menu__title">Menu</h1>
        <p className="owner-menu__subtitle">{restaurant.name || restaurantId}</p>
        <div className="owner-menu__actions">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="owner-menu__filter"
          >
            <option value="all">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            type="button"
            className="owner-menu__btn-upload"
            onClick={() => { setImportError(null); setImportOpen(true); }}
            disabled={importing}
          >
            <Upload size={16} aria-hidden />
            {importing ? 'Importing…' : 'Upload TSV / CSV / Excel'}
          </button>
          <button
            type="button"
            className="owner-menu__btn-add"
            onClick={() => { setEditingItem(null); setModalOpen(true); }}
          >
            Add item
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading menu...</p>
      ) : items.length === 0 ? (
        <div className="owner-menu__empty">
          <p>No menu items yet.</p>
          <button type="button" className="owner-menu__btn-add" onClick={() => setModalOpen(true)}>Add first item</button>
        </div>
      ) : (
        <div className="owner-menu__list">
          {itemsByCategory.map(({ category, items: catItems }) => (
            <section key={category} className="owner-menu__category">
              <h2 className="owner-menu__category-title">{category}</h2>
              <ul className="owner-menu__items">
                {catItems.map((item) => (
                  <li key={item.id} className="owner-menu__item">
                    <div className="owner-menu__item-main">
                      <span className="owner-menu__item-name">{item.name}</span>
                      <span className="owner-menu__item-type">{getItemTypeDisplayName(item.itemType)}</span>
                      <span className="owner-menu__item-price">${Number(item.price).toFixed(2)}</span>
                      {item.available === false && <span className="owner-menu__item-unavailable">Unavailable</span>}
                    </div>
                    <div className="owner-menu__item-actions">
                      <button type="button" className="owner-menu__btn-edit" onClick={() => { setEditingItem(item); setModalOpen(true); }}>Edit</button>
                      <button type="button" className="owner-menu__btn-delete" onClick={() => setDeleteConfirm(item)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {modalOpen && restaurant.id && (
        <MenuItemModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setEditingItem(null); }}
          restaurant={restaurant}
          menuItem={editingItem}
          onSave={handleSave}
          useOwnerApi
        />
      )}

      {importOpen && (
        <div className="owner-menu__import-overlay" onClick={() => !importing && setImportOpen(false)}>
          <div className="owner-menu__import-modal" onClick={e => e.stopPropagation()}>
            <h3 className="owner-menu__import-title">Import menu</h3>
            <p className="owner-menu__import-hint">Upload a TSV, CSV, or XLSX file with the same column structure as the product export (name, description, price, category, etc.).</p>
            <form onSubmit={handleImportSubmit} className="owner-menu__import-form">
              <label className="owner-menu__import-file-label">
                <span className="owner-menu__import-file-text">Choose file</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".tsv,.csv,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="owner-menu__import-file-input"
                  disabled={importing}
                />
              </label>
              <label className="owner-menu__import-replace-label">
                <input
                  type="checkbox"
                  checked={importReplace}
                  onChange={(e) => setImportReplace(e.target.checked)}
                  disabled={importing}
                />
                Replace existing menu (delete current items before importing)
              </label>
              {importError && <p className="owner-menu__import-error">{importError}</p>}
              <div className="owner-menu__import-actions">
                <button type="button" className="owner-menu__btn-cancel" onClick={() => !importing && setImportOpen(false)} disabled={importing}>Cancel</button>
                <button type="submit" className="owner-menu__btn-add" disabled={importing}>{importing ? 'Importing…' : 'Import'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="owner-menu__modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="owner-menu__modal-content" onClick={e => e.stopPropagation()}>
            <div className="owner-menu__modal-header">
              <h4>Delete menu item</h4>
              <button type="button" className="owner-menu__modal-close" onClick={() => setDeleteConfirm(null)} aria-label="Close">×</button>
            </div>
            <p className="owner-menu__modal-body">Delete &quot;{deleteConfirm.name}&quot;? This cannot be undone.</p>
            <div className="owner-menu__modal-actions">
              <button type="button" className="owner-menu__modal-btn-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button type="button" className="owner-menu__modal-btn-danger" onClick={() => handleDeleteConfirm(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {deleteError && (
        <div className="owner-menu__modal-overlay" onClick={() => setDeleteError(null)}>
          <div className="owner-menu__modal-content" onClick={e => e.stopPropagation()}>
            <div className="owner-menu__modal-header">
              <h4>Error</h4>
              <button type="button" className="owner-menu__modal-close" onClick={() => setDeleteError(null)} aria-label="Close">×</button>
            </div>
            <p className="owner-menu__modal-body">{deleteError}</p>
            <div className="owner-menu__modal-actions">
              <button type="button" className="owner-menu__modal-btn-cancel" onClick={() => setDeleteError(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {importSuccessMessage && (
        <div className="owner-menu__modal-overlay" onClick={() => setImportSuccessMessage(null)}>
          <div className="owner-menu__modal-content" onClick={e => e.stopPropagation()}>
            <div className="owner-menu__modal-header">
              <h4>Import complete</h4>
              <button type="button" className="owner-menu__modal-close" onClick={() => setImportSuccessMessage(null)} aria-label="Close">×</button>
            </div>
            <p className="owner-menu__modal-body">{importSuccessMessage}</p>
            <div className="owner-menu__modal-actions">
              <button type="button" className="owner-menu__modal-btn-cancel" onClick={() => setImportSuccessMessage(null)}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerMenu;
