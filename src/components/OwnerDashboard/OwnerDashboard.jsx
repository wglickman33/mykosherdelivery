import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { getOwnerRestaurants, getMenuItems, getOrders } from '../../services/ownerService';
import './OwnerDashboard.scss';

const OwnerDashboard = () => {
  const { currentRestaurant, restaurants } = useOutletContext();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ menuCount: 0, orderCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentRestaurant) {
      if (restaurants?.length) navigate(`/owner/restaurant/${restaurants[0].id}/menu`, { replace: true });
      return;
    }
    (async () => {
      try {
        const [menuRes, ordersRes] = await Promise.all([
          getMenuItems(currentRestaurant.id, { limit: 1, offset: 0 }),
          getOrders({ restaurantId: currentRestaurant.id, limit: 1, offset: 0 })
        ]);
        setStats({
          menuCount: menuRes?.pagination?.total ?? 0,
          orderCount: ordersRes?.pagination?.total ?? 0
        });
      } catch {
        setStats({ menuCount: 0, orderCount: 0 });
      } finally {
        setLoading(false);
      }
    })();
  }, [currentRestaurant, restaurants, navigate]);

  if (!currentRestaurant) return null;

  return (
    <div className="owner-dashboard">
      <h1 className="owner-dashboard__title">Dashboard</h1>
      <p className="owner-dashboard__subtitle">{currentRestaurant.name}</p>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="owner-dashboard__cards">
          <button
            type="button"
            className="owner-dashboard__card"
            onClick={() => navigate(`/owner/restaurant/${currentRestaurant.id}/menu`)}
          >
            <span className="owner-dashboard__card-value">{stats.menuCount}</span>
            <span className="owner-dashboard__card-label">Menu items</span>
          </button>
          <button
            type="button"
            className="owner-dashboard__card"
            onClick={() => navigate(`/owner/restaurant/${currentRestaurant.id}/orders`)}
          >
            <span className="owner-dashboard__card-value">{stats.orderCount}</span>
            <span className="owner-dashboard__card-label">Orders</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default OwnerDashboard;
