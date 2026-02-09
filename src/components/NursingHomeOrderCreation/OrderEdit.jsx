import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchResidentOrder, fetchMenuItems, updateResidentOrder } from '../../services/nursingHomeService';
import { NH_CONFIG } from '../../config/constants';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import MealForm from './MealForm';
import OrderSummary from './OrderSummary';
import './OrderCreation.scss';

const DAYS_OF_WEEK = NH_CONFIG.MEALS.DAYS;

function getMealKey(day, mealType) {
  return `${day}-${mealType}`;
}

const OrderEdit = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [resident, setResident] = useState(null);
  const [menuItems, setMenuItems] = useState({ breakfast: [], lunch: [], dinner: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const [meals, setMeals] = useState({});

  const loadData = useCallback(async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      setError(null);

      const orderRes = await fetchResidentOrder(orderId);
      const orderData = orderRes?.data ?? null;

      if (!orderData) {
        setError('Order not found');
        setLoading(false);
        return;
      }

      if (orderData.status !== 'draft') {
        setError('Only draft orders can be edited');
        setLoading(false);
        return;
      }

      setOrder(orderData);
      const residentData = orderData.resident || { id: orderData.residentId, name: orderData.residentName, roomNumber: orderData.roomNumber };
      setResident(residentData);

      const [breakfastRes, lunchRes, dinnerRes] = await Promise.all([
        fetchMenuItems({ mealType: 'breakfast', isActive: true }),
        fetchMenuItems({ mealType: 'lunch', isActive: true }),
        fetchMenuItems({ mealType: 'dinner', isActive: true })
      ]);

      const bItems = breakfastRes?.data?.items ?? [];
      const lItems = lunchRes?.data?.items ?? [];
      const dItems = dinnerRes?.data?.items ?? [];

      setMenuItems({
        breakfast: Array.isArray(bItems) ? bItems : [],
        lunch: Array.isArray(lItems) ? lItems : [],
        dinner: Array.isArray(dItems) ? dItems : []
      });

      const initialMeals = {};
      (orderData.meals || []).forEach((meal) => {
        const key = getMealKey(meal.day, meal.mealType);
        initialMeals[key] = {
          day: meal.day,
          mealType: meal.mealType,
          items: Array.isArray(meal.items) ? meal.items.map((i) => ({
            id: i.id,
            name: i.name || '',
            category: i.category || 'main',
            price: i.price != null ? i.price : 0
          })) : [],
          bagelType: meal.bagelType || null
        };
      });
      setMeals(initialMeals);
    } catch (err) {
      console.error('Error loading order for edit:', err);
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMealUpdate = (day, mealType, items, bagelType = null) => {
    const key = getMealKey(day, mealType);
    setMeals((prev) => ({
      ...prev,
      [key]: { day, mealType, items, bagelType }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const mealArray = Object.values(meals).filter((meal) => meal.items && meal.items.length > 0);

      if (mealArray.length === 0) {
        setError('Please add at least one meal before saving');
        setSaving(false);
        return;
      }

      const payload = {
        meals: mealArray,
        billingEmail: order?.billingEmail,
        billingName: order?.billingName
      };

      const response = await updateResidentOrder(orderId, payload);

      if (response?.success) {
        navigate(`/nursing-homes/order/${orderId}/payment`, { replace: true });
      } else {
        setError(response?.error || response?.message || 'Failed to update order');
      }
    } catch (err) {
      console.error('Error updating order:', err);
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  const getTotalMeals = () => {
    return Object.values(meals).filter((meal) => meal.items && meal.items.length > 0).length;
  };

  if (loading) {
    return (
      <div className="order-creation">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="order-creation">
        <ErrorMessage message={error} type="error" />
        <button type="button" className="back-btn" onClick={() => navigate('/nursing-homes/orders')}>
          Back to Orders
        </button>
      </div>
    );
  }

  const currentMeal = meals[getMealKey(selectedDay, selectedMealType)];

  return (
    <div className="order-creation">
      <div className="order-header">
        <div className="header-content">
          <button type="button" className="back-btn" onClick={() => navigate(`/nursing-homes/orders/${orderId}`)}>
            ← Back to Order
          </button>
          <div className="header-info">
            <h1>Edit Weekly Order</h1>
            <p className="resident-name">
              {resident?.name} {resident?.roomNumber && `- Room ${resident.roomNumber}`}
            </p>
          </div>
        </div>
        <div className="deadline-warning">
          <span className="deadline-label">Order #{order?.orderNumber}</span>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="order-content">
        <div className="meal-selector">
          <div className="day-selector">
            <h3>Select Day</h3>
            <div className="day-buttons">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={`day-btn ${selectedDay === day ? 'active' : ''}`}
                  onClick={() => setSelectedDay(day)}
                >
                  {day}
                  {Object.values(meals).filter((m) => m.day === day && m.items?.length > 0).length > 0 && (
                    <span className="meal-count">
                      {Object.values(meals).filter((m) => m.day === day && m.items?.length > 0).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="meal-type-selector">
            <h3>Select Meal</h3>
            <div className="meal-type-buttons">
              <button
                type="button"
                className={`meal-type-btn breakfast ${selectedMealType === 'breakfast' ? 'active' : ''}`}
                onClick={() => setSelectedMealType('breakfast')}
              >
                Breakfast
                {meals[getMealKey(selectedDay, 'breakfast')]?.items?.length > 0 && <span className="checkmark">✓</span>}
              </button>
              <button
                type="button"
                className={`meal-type-btn lunch ${selectedMealType === 'lunch' ? 'active' : ''}`}
                onClick={() => setSelectedMealType('lunch')}
              >
                Lunch
                {meals[getMealKey(selectedDay, 'lunch')]?.items?.length > 0 && <span className="checkmark">✓</span>}
              </button>
              <button
                type="button"
                className={`meal-type-btn dinner ${selectedMealType === 'dinner' ? 'active' : ''}`}
                onClick={() => setSelectedMealType('dinner')}
              >
                Dinner
                {meals[getMealKey(selectedDay, 'dinner')]?.items?.length > 0 && <span className="checkmark">✓</span>}
              </button>
            </div>
          </div>

          <MealForm
            day={selectedDay}
            mealType={selectedMealType}
            menuItems={menuItems[selectedMealType]}
            currentMeal={currentMeal}
            onUpdate={handleMealUpdate}
            resident={resident}
          />
        </div>

        <OrderSummary
          meals={meals}
          resident={resident}
          onSave={handleSave}
          saving={saving}
          totalMeals={getTotalMeals()}
        />
      </div>
    </div>
  );
};

export default OrderEdit;
