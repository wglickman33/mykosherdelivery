import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchNursingHomeMenu } from '../../services/nursingHomeMenuService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './NursingHomeMenu.scss';

const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const CATEGORY_LABELS = { main: 'Mains', side: 'Sides', entree: 'Entrees', soup: 'Soups', dessert: 'Desserts' };

const NursingHomeMenu = ({ showInstructions = true, showEditLink = false }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState({ items: [], grouped: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeMeal, setActiveMeal] = useState('all');

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchNursingHomeMenu({ isActive: true });
    if (result.success && result.data) {
      setMenu({
        items: result.data.items || [],
        grouped: result.data.grouped || {}
      });
    } else {
      setError(result.error || 'Failed to load menu');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const grouped = menu.grouped || {};
  const items = menu.items || [];
  const filteredItems = activeMeal === 'all' ? items : items.filter(i => i.mealType === activeMeal);

  if (loading) {
    return (
      <div className="nursing-home-menu">
        <div className="nh-menu-loading">
          <LoadingSpinner size="large" />
          <p>Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="nursing-home-menu">
        <div className="nh-menu-error">
          <p>{error}</p>
          <button type="button" className="nh-menu-retry" onClick={loadMenu}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="nursing-home-menu">
      {showInstructions && (
        <div className="nh-menu-instructions">
          <h2>How to Use This Menu</h2>
          <ul>
            <li><strong>Breakfast</strong> ($15/meal): Choose one main and one side. Some mains (e.g. bagels) require specifying bagel type.</li>
            <li><strong>Lunch</strong> ($21/meal): Choose one entree and one side.</li>
            <li><strong>Dinner</strong> ($23/meal): Choose one entree, one side, plus optional soup and dessert.</li>
            <li>Orders must be submitted by <strong>Sunday 12:00 PM</strong> for the following week. Residents are billed directly.</li>
          </ul>
          {showEditLink && user?.role === 'admin' && (
            <p className="nh-menu-edit-link">
              To add, edit, or deactivate items, go to{' '}
              <button type="button" onClick={() => navigate('/admin/restaurants?tab=nursing-home-menu')}>
                Admin → Restaurants → Nursing Home Menu
              </button>
            </p>
          )}
        </div>
      )}

      <div className="nh-menu-filters">
        <button
          type="button"
          className={`nh-menu-filter-btn ${activeMeal === 'all' ? 'active' : ''}`}
          onClick={() => setActiveMeal('all')}
        >
          All Meals
        </button>
        {['breakfast', 'lunch', 'dinner'].map(m => (
          <button
            key={m}
            type="button"
            className={`nh-menu-filter-btn ${activeMeal === m ? 'active' : ''}`}
            onClick={() => setActiveMeal(m)}
          >
            {MEAL_LABELS[m]}
          </button>
        ))}
      </div>

      {activeMeal === 'all' ? (
        <div className="nh-menu-sections">
          {['breakfast', 'lunch', 'dinner'].map(mealType => {
            const mealGroup = grouped[mealType];
            if (!mealGroup) return null;
            const categories = Object.keys(mealGroup).filter(cat => Array.isArray(mealGroup[cat]) && mealGroup[cat].length > 0);
            if (categories.length === 0) return null;
            return (
              <section key={mealType} className="nh-menu-section">
                <h3 className="nh-menu-section-title">{MEAL_LABELS[mealType]}</h3>
                {categories.map(cat => (
                  <div key={cat} className="nh-menu-category">
                    <h4>{CATEGORY_LABELS[cat] || cat}</h4>
                    <ul>
                      {mealGroup[cat].filter(i => i.isActive !== false).map(item => (
                        <li key={item.id}>
                          <span className="nh-menu-item-name">{item.name}</span>
                          {item.description && <span className="nh-menu-item-desc"> — {item.description}</span>}
                          {item.price > 0 && <span className="nh-menu-item-price">${parseFloat(item.price).toFixed(2)}</span>}
                          {item.requiresBagelType && <span className="nh-menu-item-tag">Bagel type required</span>}
                          {item.excludesSide && <span className="nh-menu-item-tag">No side</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="nh-menu-sections">
          <section className="nh-menu-section">
            <h3 className="nh-menu-section-title">{MEAL_LABELS[activeMeal]}</h3>
            {Object.entries(grouped[activeMeal] || {}).map(([cat, catItems]) => {
              const list = Array.isArray(catItems) ? catItems.filter(i => i.isActive !== false) : [];
              if (list.length === 0) return null;
              return (
                <div key={cat} className="nh-menu-category">
                  <h4>{CATEGORY_LABELS[cat] || cat}</h4>
                  <ul>
                    {list.map(item => (
                      <li key={item.id}>
                        <span className="nh-menu-item-name">{item.name}</span>
                        {item.description && <span className="nh-menu-item-desc"> — {item.description}</span>}
                        {item.price > 0 && <span className="nh-menu-item-price">${parseFloat(item.price).toFixed(2)}</span>}
                        {item.requiresBagelType && <span className="nh-menu-item-tag">Bagel type required</span>}
                        {item.excludesSide && <span className="nh-menu-item-tag">No side</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        </div>
      )}

      {filteredItems.length === 0 && (
        <div className="nh-menu-empty">
          <p>No menu items found. Contact your administrator to add items.</p>
        </div>
      )}
    </div>
  );
};

export default NursingHomeMenu;
