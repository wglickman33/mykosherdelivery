import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchResidentOrder,
  fetchMenuItems,
  updateResidentOrder,
  submitResidentOrder,
  nhPath
} from '../../services/nursingHomeService';
import { useNursingHomeFacility } from '../../context/NursingHomeFacilityContext';
import { NH_CONFIG } from '../../config/constants';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import NhAdminOrderedModal from '../NursingHomeShared/NhAdminOrderedModal';
import MealForm from './MealForm';
import OrderSummary from './OrderSummary';
import './OrderCreation.scss';
import { useAuth } from '../../hooks/useAuth';
import {
  formatNhDeadline,
  validateWeeklyMeals,
  mealHasItems,
  isNoneMeal,
  isStaffPlacedOrder,
  formatAssignedStaffContact,
  ADMIN_ALREADY_ORDERED_MESSAGE
} from '../../utils/nursingHomeOrderUtils';

const DAYS_OF_WEEK = NH_CONFIG.MEALS.DAYS;

function getMealKey(day, mealType) {
  return `${day}-${mealType}`;
}

const OrderEdit = () => {
  const { orderId, facilitySlug: slugParam } = useParams();
  const navigate = useNavigate();
  const { facility: contextFacility } = useNursingHomeFacility();
  const { user } = useAuth();
  const facilitySlug = slugParam || contextFacility?.slug;
  const isNhUser = user?.role === 'nursing_home_user';

  const [order, setOrder] = useState(null);
  const [resident, setResident] = useState(null);
  const [menuItems, setMenuItems] = useState({ breakfast: [], lunch: [], dinner: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [adminConflict, setAdminConflict] = useState(null);

  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const [meals, setMeals] = useState({});

  const loadData = useCallback(async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      setError(null);

      const orderData = await fetchResidentOrder(orderId);

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
      const residentData = orderData.resident || {
        id: orderData.residentId,
        name: orderData.residentName,
        roomNumber: orderData.roomNumber
      };
      setResident(residentData);

      if (isNhUser && isStaffPlacedOrder(orderData, residentData, user?.id)) {
        setAdminConflict({
          message: ADMIN_ALREADY_ORDERED_MESSAGE,
          orderId: orderData.id,
          contactLabel: formatAssignedStaffContact(residentData?.assignedUser)
        });
        setLoading(false);
        return;
      }

      const [breakfastRes, lunchRes, dinnerRes] = await Promise.all([
        fetchMenuItems({ mealType: 'breakfast', isActive: true }),
        fetchMenuItems({ mealType: 'lunch', isActive: true }),
        fetchMenuItems({ mealType: 'dinner', isActive: true })
      ]);

      setMenuItems({
        breakfast: Array.isArray(breakfastRes?.items) ? breakfastRes.items : [],
        lunch: Array.isArray(lunchRes?.items) ? lunchRes.items : [],
        dinner: Array.isArray(dinnerRes?.items) ? dinnerRes.items : []
      });

      const initialMeals = {};
      (orderData.meals || []).forEach((meal) => {
        const key = getMealKey(meal.day, meal.mealType);
        const none = isNoneMeal(meal);
        initialMeals[key] = {
          day: meal.day,
          mealType: meal.mealType,
          items: none
            ? []
            : (Array.isArray(meal.items)
              ? meal.items.map((i) => ({
                  id: i.id,
                  name: i.name || '',
                  category: i.category || 'main',
                  price: i.price != null ? i.price : 0
                }))
              : []),
          bagelType: none ? null : (meal.bagelType || null),
          none
        };
      });
      setMeals(initialMeals);
    } catch (err) {
      console.error('Error loading order for edit:', err);
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId, isNhUser, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOrderError = (err) => {
    const code = err.response?.data?.code || err.response?.data?.error;
    const message = err.response?.data?.message || err.response?.data?.error || err.message || 'Request failed';
    if (code === 'ADMIN_ALREADY_ORDERED') {
      setAdminConflict({
        message: message || ADMIN_ALREADY_ORDERED_MESSAGE,
        orderId,
        contactLabel: formatAssignedStaffContact(resident?.assignedUser)
      });
      setError(null);
      return;
    }
    setError(message);
  };

  const handleMealUpdate = (day, mealType, items, bagelType = null, none = false) => {
    const key = getMealKey(day, mealType);
    setMeals((prev) => ({
      ...prev,
      [key]: {
        day,
        mealType,
        items: none ? [] : items,
        bagelType: none ? null : bagelType,
        none: !!none
      }
    }));
  };

  const buildMealArray = () =>
    Object.values(meals).filter((meal) => mealHasItems(meal) || isNoneMeal(meal));

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      setError(null);

      const mealArray = buildMealArray();
      if (mealArray.length === 0) {
        setError('Please add at least one meal (or mark as None) before saving');
        return;
      }

      const validationErrors = validateWeeklyMeals(meals);
      if (validationErrors.length > 0) {
        setError(validationErrors[0]);
        return;
      }

      const updated = await updateResidentOrder(orderId, {
        meals: mealArray,
        billingEmail: order?.billingEmail,
        billingName: order?.billingName
      });

      if (updated?.id) {
        navigate(nhPath(facilitySlug, `orders/${orderId}`));
      } else {
        setError('Failed to update order');
      }
    } catch (err) {
      console.error('Error updating order:', err);
      handleOrderError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError(null);

      const mealArray = buildMealArray();
      if (!mealArray.some((m) => mealHasItems(m))) {
        setError('Please add at least one meal before submitting');
        return;
      }

      const validationErrors = validateWeeklyMeals(meals);
      if (validationErrors.length > 0) {
        setError(validationErrors[0]);
        return;
      }

      const updated = await updateResidentOrder(orderId, {
        meals: mealArray,
        billingEmail: order?.billingEmail,
        billingName: order?.billingName
      });

      if (!updated?.id) {
        setError('Failed to update order');
        return;
      }

      const submitted = await submitResidentOrder(orderId);
      const id = submitted?.id || orderId;
      navigate(nhPath(facilitySlug, `orders/${id}/confirmation`));
    } catch (err) {
      console.error('Error submitting order:', err);
      handleOrderError(err);
    } finally {
      setSaving(false);
    }
  };

  const getTotalMeals = () =>
    Object.values(meals).filter((meal) => mealHasItems(meal)).length;

  const dayHasMeals = (day) =>
    Object.values(meals).some((m) => m.day === day && (mealHasItems(m) || isNoneMeal(m)));

  const dayMealCount = (day) =>
    Object.values(meals).filter((m) => m.day === day && (mealHasItems(m) || isNoneMeal(m))).length;

  const mealSlotFilled = (day, mealType) => {
    const meal = meals[getMealKey(day, mealType)];
    return mealHasItems(meal) || isNoneMeal(meal);
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
        <button
          type="button"
          className="back-btn"
          onClick={() => navigate(nhPath(facilitySlug, 'orders'))}
        >
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
          <button
            type="button"
            className="back-btn"
            onClick={() => navigate(nhPath(facilitySlug, `orders/${orderId}`))}
          >
            ← Back to Order
          </button>
          <div className="header-info">
            <h1>Edit Weekly Order</h1>
            <p className="resident-name">
              {resident?.name}
              {resident?.roomNumber && ` - Room ${resident.roomNumber}`}
            </p>
          </div>
        </div>
        <div className="deadline-warning">
          <span className="deadline-label">Order #{order?.orderNumber}</span>
          <span className="deadline-time">Deadline: {formatNhDeadline()}</span>
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
                  {dayHasMeals(day) && (
                    <span className="meal-count">{dayMealCount(day)}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="meal-type-selector">
            <h3>Select Meal</h3>
            <div className="meal-type-buttons">
              {['breakfast', 'lunch', 'dinner'].map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`meal-type-btn ${type} ${selectedMealType === type ? 'active' : ''}`}
                  onClick={() => setSelectedMealType(type)}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                  {mealSlotFilled(selectedDay, type) && <span className="checkmark">✓</span>}
                </button>
              ))}
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
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmit}
          saving={saving}
          totalMeals={getTotalMeals()}
        />
      </div>

      <NhAdminOrderedModal
        open={Boolean(adminConflict)}
        message={adminConflict?.message}
        contactLabel={adminConflict?.contactLabel}
        onClose={() => {
          setAdminConflict(null);
          navigate(nhPath(facilitySlug, 'dashboard'));
        }}
        onViewOrder={
          adminConflict?.orderId
            ? () => navigate(nhPath(facilitySlug, `orders/${adminConflict.orderId}`))
            : null
        }
      />
    </div>
  );
};

export default OrderEdit;
