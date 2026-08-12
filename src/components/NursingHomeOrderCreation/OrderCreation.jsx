import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchResident,
  fetchResidentOrders,
  fetchMenuItems,
  createResidentOrder,
  submitResidentOrder,
  fetchFacility,
  nhPath
} from '../../services/nursingHomeService';
import { useNursingHomeFacility } from '../../context/NursingHomeFacilityContext';
import { useAuth } from '../../hooks/useAuth';
import { NH_CONFIG } from '../../config/constants';
import {
  getNextMondayDateString,
  addDaysToDateString,
  formatNhDeadline,
  validateWeeklyMeals,
  mealHasItems,
  isNoneMeal,
  isStaffPlacedOrder,
  formatAssignedStaffContact,
  ADMIN_ALREADY_ORDERED_MESSAGE
} from '../../utils/nursingHomeOrderUtils';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import NhAdminOrderedModal from '../NursingHomeShared/NhAdminOrderedModal';
import MealForm from './MealForm';
import OrderSummary from './OrderSummary';
import './OrderCreation.scss';

const DAYS_OF_WEEK = NH_CONFIG.MEALS.DAYS;

const OrderCreation = () => {
  const { residentId, facilitySlug: slugParam } = useParams();
  const navigate = useNavigate();
  const { facility: contextFacility } = useNursingHomeFacility();
  const { user } = useAuth();
  const isNhUser = user?.role === 'nursing_home_user';

  const [resident, setResident] = useState(null);
  const [facility, setFacility] = useState(contextFacility || null);
  const [menuItems, setMenuItems] = useState({ breakfast: [], lunch: [], dinner: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [adminConflict, setAdminConflict] = useState(null);

  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const [meals, setMeals] = useState({});

  const facilitySlug = slugParam || facility?.slug || contextFacility?.slug;
  const weekStart = getNextMondayDateString();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAdminConflict(null);

      const [residentData, breakfastRes, lunchRes, dinnerRes, ordersRes] = await Promise.all([
        fetchResident(residentId),
        fetchMenuItems({ mealType: 'breakfast', isActive: true }),
        fetchMenuItems({ mealType: 'lunch', isActive: true }),
        fetchMenuItems({ mealType: 'dinner', isActive: true }),
        fetchResidentOrders({ residentId, weekStartDate: weekStart, limit: 5 }).catch(() => ({ data: [] }))
      ]);

      setResident(residentData || null);

      if (contextFacility) {
        setFacility(contextFacility);
      } else if (residentData?.facilityId) {
        const facilityData = await fetchFacility(residentData.facilityId);
        setFacility(facilityData || null);
      }

      setMenuItems({
        breakfast: Array.isArray(breakfastRes?.items) ? breakfastRes.items : [],
        lunch: Array.isArray(lunchRes?.items) ? lunchRes.items : [],
        dinner: Array.isArray(dinnerRes?.items) ? dinnerRes.items : []
      });

      const existing = (ordersRes?.data || []).find(
        (o) => o.weekStartDate === weekStart && o.status !== 'cancelled'
      );
      if (existing && isNhUser && isStaffPlacedOrder(existing, residentData, user?.id)) {
        setAdminConflict({
          message: ADMIN_ALREADY_ORDERED_MESSAGE,
          orderId: existing.id,
          contactLabel: formatAssignedStaffContact(residentData?.assignedUser)
        });
      } else if (existing && existing.status !== 'draft') {
        navigate(nhPath(facilitySlug || contextFacility?.slug, `orders/${existing.id}`), { replace: true });
        return;
      } else if (existing?.status === 'draft' && (!isNhUser || !isStaffPlacedOrder(existing, residentData, user?.id))) {
        navigate(nhPath(facilitySlug || contextFacility?.slug, `orders/${existing.id}/edit`), { replace: true });
        return;
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [residentId, contextFacility, weekStart, isNhUser, user?.id, facilitySlug, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getMealKey = (day, mealType) => `${day}-${mealType}`;

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

  const buildOrderPayload = () => {
    const weekStartDate = weekStart;
    const weekEndDate = addDaysToDateString(weekStartDate, 6);
    return {
      residentId,
      weekStartDate,
      weekEndDate,
      meals: buildMealArray(),
      deliveryAddress: facility?.address || {
        street: '',
        city: '',
        state: 'NY',
        zip_code: ''
      },
      billingEmail: resident?.billingEmail,
      billingName: resident?.billingName
    };
  };

  const handleOrderError = (err) => {
    const code = err.response?.data?.code || err.response?.data?.error;
    const message = err.response?.data?.message || err.message || 'Failed to save order';
    if (code === 'ADMIN_ALREADY_ORDERED' || (err.response?.status === 409 && code !== 'ORDER_WEEK_EXISTS')) {
      setAdminConflict({
        message: message || ADMIN_ALREADY_ORDERED_MESSAGE,
        orderId: err.response?.data?.data?.orderId,
        contactLabel: formatAssignedStaffContact(resident?.assignedUser)
      });
      setError(null);
      return;
    }
    if (code === 'ORDER_WEEK_EXISTS' && err.response?.data?.data?.orderId) {
      navigate(nhPath(facilitySlug, `orders/${err.response.data.data.orderId}`));
      return;
    }
    setError(message);
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      setError(null);
      setAdminConflict(null);

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

      const created = await createResidentOrder(buildOrderPayload());
      if (created?.id) {
        navigate(nhPath(facilitySlug, `orders/${created.id}`));
      } else {
        setError('Failed to create order');
      }
    } catch (err) {
      console.error('Error saving order:', err);
      handleOrderError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError(null);
      setAdminConflict(null);

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

      const created = await createResidentOrder(buildOrderPayload());
      if (!created?.id) {
        setError('Failed to create order');
        return;
      }

      const submitted = await submitResidentOrder(created.id);
      const orderId = submitted?.id || created.id;
      navigate(nhPath(facilitySlug, `orders/${orderId}/confirmation`));
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

  if (error && !resident) {
    return (
      <div className="order-creation">
        <ErrorMessage message={error} type="error" />
        <button type="button" onClick={() => navigate(nhPath(facilitySlug, 'dashboard'))}>
          Back to Dashboard
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
            onClick={() => navigate(nhPath(facilitySlug, 'dashboard'))}
          >
            ← Back
          </button>
          <div className="header-info">
            <h1>{isNhUser ? 'Create My Weekly Order' : 'Create Weekly Order'}</h1>
            <p className="resident-name">
              {resident?.name}
              {resident?.roomNumber && ` - Room ${resident.roomNumber}`}
            </p>
          </div>
        </div>
        <div className="deadline-warning">
          <span className="deadline-label">Deadline:</span>
          <span className="deadline-time">{formatNhDeadline()}</span>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {!resident?.paymentMethodId && (
        <div className="error-banner" style={{ background: '#fffbeb', color: '#92400e', borderColor: '#fcd34d' }}>
          No card on file for this resident. Orders submit for monthly billing - ask staff to save a card if needed.
        </div>
      )}

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
                  {mealSlotFilled(selectedDay, type) && (
                    <span className="checkmark">✓</span>
                  )}
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
          saving={saving || Boolean(adminConflict)}
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

export default OrderCreation;
