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
import {
  getNextMondayDateString,
  addDaysToDateString,
  formatNhDeadline,
  validateWeeklyMeals,
  mealHasItems,
  isStaffPlacedOrder,
  formatAssignedStaffContact,
  ADMIN_ALREADY_ORDERED_MESSAGE
} from '../../utils/nursingHomeOrderUtils';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import NhAdminOrderedModal from '../NursingHomeShared/NhAdminOrderedModal';
import MealForm from './MealForm';
import OrderSummary from './OrderSummary';
import useWeeklyMealBuilder from './useWeeklyMealBuilder';
import './OrderCreation.scss';

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

  const mealBuilder = useWeeklyMealBuilder();
  const {
    DAYS_OF_WEEK,
    MEAL_TYPES,
    meals,
    selectedDay,
    setSelectedDay,
    selectedMealType,
    setSelectedMealType,
    markClean,
    initialMealForForm,
    committedMeal,
    handleDraftChange,
    handleMealCommit,
    handleMealClear,
    advanceToNextSlot,
    jumpToMeal,
    nextLabel,
    isLastSlot,
    mealSlotFilled,
    totalMeals,
    buildMealArray,
    dayProgress,
    sourceDayCopyable,
    copyOpen,
    setCopyOpen,
    copyTargets,
    setCopyTargets,
    openCopyPanel,
    applyCopyDay,
    confirmLeave,
    highlightSummary
  } = mealBuilder;

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

  const goBack = () => {
    if (!confirmLeave()) return;
    navigate(nhPath(facilitySlug, 'dashboard'));
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
        markClean();
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
      markClean();
      navigate(nhPath(facilitySlug, `orders/${orderId}/confirmation`));
    } catch (err) {
      console.error('Error submitting order:', err);
      handleOrderError(err);
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="order-creation">
      <div className="order-header">
        <div className="header-content">
          <button type="button" className="back-btn" onClick={goBack}>
            ← Back
          </button>
          <div className="header-info">
            <h1>{isNhUser ? 'Create My Weekly Order' : 'Create Weekly Order'}</h1>
            <p className="resident-name">
              {isNhUser ? 'Your order' : `Ordering for ${resident?.name || 'resident'}`}
              {resident?.roomNumber && ` · Room ${resident.roomNumber}`}
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
        <div className="info-banner info-banner--card">
          <strong>No card on file.</strong>
          {' '}
          Orders still submit for monthly billing
          {isNhUser ? ' - ask staff to save a card if needed.' : '. Save a card on the resident profile when ready.'}
        </div>
      )}

      <div className="order-content">
        <div className="meal-selector">
          <div className="day-selector">
            <div className="section-heading-row">
              <h3>Select Day</h3>
              <button
                type="button"
                className="copy-day-btn"
                onClick={openCopyPanel}
                disabled={!sourceDayCopyable}
                title={sourceDayCopyable ? `Copy ${selectedDay} to other days` : `Finish all three meals on ${selectedDay} first`}
              >
                Copy {selectedDay}…
              </button>
            </div>
            <div className="day-buttons">
              {DAYS_OF_WEEK.map((day) => {
                const progress = dayProgress(day);
                const complete = progress.complete;
                const partial = progress.filled > 0 && !complete;
                return (
                  <button
                    key={day}
                    type="button"
                    className={[
                      'day-btn',
                      selectedDay === day ? 'active' : '',
                      complete ? 'complete' : '',
                      partial ? 'partial' : ''
                    ].filter(Boolean).join(' ')}
                    onClick={() => setSelectedDay(day)}
                    aria-label={
                      complete
                        ? `${day}, complete`
                        : partial
                          ? `${day}, ${progress.filled} of ${progress.total} meals`
                          : day
                    }
                  >
                    <span className="day-btn__label">{day}</span>
                    {partial && (
                      <span className="day-progress-frac" aria-hidden="true">
                        {progress.filled}/{progress.total}
                      </span>
                    )}
                    {complete && (
                      <span className="day-complete-check" aria-hidden="true">✓</span>
                    )}
                  </button>
                );
              })}
            </div>

            {copyOpen && (
              <div className="copy-day-panel" role="region" aria-label="Copy day">
                <p className="copy-day-panel__title">
                  Apply <strong>{selectedDay}</strong> meals to:
                </p>
                <div className="copy-day-panel__targets">
                  {DAYS_OF_WEEK.filter((d) => d !== selectedDay).map((day) => {
                    const checked = copyTargets.includes(day);
                    return (
                      <label key={day} className="copy-day-check">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setCopyTargets((prev) => (
                              checked ? prev.filter((d) => d !== day) : [...prev, day]
                            ));
                          }}
                        />
                        {day}
                      </label>
                    );
                  })}
                </div>
                <div className="copy-day-panel__actions">
                  <button type="button" className="copy-day-apply" onClick={applyCopyDay} disabled={copyTargets.length === 0}>
                    Apply
                  </button>
                  <button type="button" className="copy-day-cancel" onClick={() => setCopyOpen(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="meal-type-selector">
            <h3>Select Meal</h3>
            <div className="meal-type-buttons">
              {MEAL_TYPES.map((type) => (
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
            key={`${selectedDay}-${selectedMealType}`}
            day={selectedDay}
            mealType={selectedMealType}
            menuItems={menuItems[selectedMealType]}
            initialMeal={initialMealForForm}
            isCommitted={Boolean(committedMeal)}
            onDraftChange={handleDraftChange}
            onCommit={handleMealCommit}
            onClear={handleMealClear}
            onAdvance={advanceToNextSlot}
            nextLabel={nextLabel}
            isLastSlot={isLastSlot}
            resident={resident}
          />
        </div>

        <OrderSummary
          meals={meals}
          resident={resident}
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmit}
          saving={saving || Boolean(adminConflict)}
          totalMeals={totalMeals}
          onJumpToMeal={jumpToMeal}
          highlight={highlightSummary}
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
