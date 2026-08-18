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
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import NhAdminOrderedModal from '../NursingHomeShared/NhAdminOrderedModal';
import NhConfirmModal from '../NursingHomeShared/NhConfirmModal';
import NhCopyDayModal from '../NursingHomeShared/NhCopyDayModal';
import Countdown from '../Countdown/Countdown';
import MealForm from './MealForm';
import OrderSummary from './OrderSummary';
import useWeeklyMealBuilder from './useWeeklyMealBuilder';
import './OrderCreation.scss';
import { useAuth } from '../../hooks/useAuth';
import {
  validateWeeklyMeals,
  mealHasItems,
  isNoneMeal,
  getMealKey,
  isStaffPlacedOrder,
  formatAssignedStaffContact,
  ADMIN_ALREADY_ORDERED_MESSAGE,
  NH_ORDER_COUNTDOWN_SETTINGS
} from '../../utils/nursingHomeOrderUtils';

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
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [nextController, setNextController] = useState({
    canContinue: false,
    nextLabel: 'Next',
    isLastSlot: false,
    runNext: null
  });

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
    replaceMeals,
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
    completedDays,
    suggestedCopySourceDay,
    copyButtonLabel,
    canOpenCopy,
    targetDayHasMeals,
    copyOpen,
    setCopyOpen,
    openCopyPanel,
    applyCopyFromDay,
    isDirty,
    highlightSummary
  } = mealBuilder;

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
      replaceMeals(initialMeals, { markDirty: false });
    } catch (err) {
      console.error('Error loading order for edit:', err);
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId, isNhUser, user?.id, replaceMeals]);

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

  const goBack = () => {
    if (isDirty) {
      setLeaveModalOpen(true);
      return;
    }
    navigate(nhPath(facilitySlug, `orders/${orderId}`));
  };

  const confirmLeavePage = () => {
    setLeaveModalOpen(false);
    markClean();
    navigate(nhPath(facilitySlug, `orders/${orderId}`));
  };

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
        markClean();
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
      markClean();
      navigate(nhPath(facilitySlug, `orders/${id}/confirmation`));
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

  return (
    <div className="order-creation">
      <div className="order-header">
        <div className="header-content">
          <button type="button" className="back-btn" onClick={goBack}>
            ← Back to Order
          </button>
          <div className="header-info">
            <h1>{isNhUser ? 'Edit My Weekly Order' : 'Edit Weekly Order'}</h1>
            <p className="resident-name">
              {isNhUser ? 'Your order' : `Editing for ${resident?.name || 'resident'}`}
              {resident?.roomNumber && ` · Room ${resident.roomNumber}`}
            </p>
          </div>
        </div>
        {order?.orderNumber && (
          <p className="order-number-chip">Order #{order.orderNumber}</p>
        )}
      </div>
      <div className="nh-order-countdown">
        <Countdown variant="nursingHome" fixedSettings={NH_ORDER_COUNTDOWN_SETTINGS} />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="order-content">
        <div className="meal-selector" id="nh-meal-work-area">
          <div className="day-selector">
            <div className="section-heading-row">
              <h3>Select Day</h3>
              <button
                type="button"
                className="copy-day-btn"
                onClick={openCopyPanel}
                disabled={!canOpenCopy}
                title={canOpenCopy ? 'Choose a completed day to copy onto this one' : 'Finish at least one other day first'}
              >
                {copyButtonLabel}
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
                  {mealSlotFilled(selectedDay, type) && <span className="checkmark">✓</span>}
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
            onNextController={setNextController}
            resident={resident}
          />
        </div>

        <div className="order-summary-rail">
          <OrderSummary
            meals={meals}
            resident={resident}
            onSaveDraft={handleSaveDraft}
            onSubmit={handleSubmit}
            saving={saving || Boolean(adminConflict)}
            totalMeals={totalMeals}
            onJumpToMeal={jumpToMeal}
            highlight={highlightSummary}
            dockNextLabel={nextController.nextLabel}
            dockNextDisabled={!nextController.canContinue}
            onDockNext={() => nextController.runNext?.()}
            showDockSubmit={Boolean(isLastSlot && totalMeals > 0 && committedMeal)}
          />
        </div>
      </div>

      <NhCopyDayModal
        open={copyOpen}
        completedDays={completedDays.filter((d) => d !== selectedDay)}
        suggestedSourceDay={suggestedCopySourceDay}
        targetDay={selectedDay}
        meals={meals}
        targetHasMeals={targetDayHasMeals}
        onClose={() => setCopyOpen(false)}
        onConfirmCopy={applyCopyFromDay}
      />

      <NhConfirmModal
        open={leaveModalOpen}
        title="Leave without saving?"
        message="You have unsaved meal changes. If you leave now, those changes will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        danger
        onCancel={() => setLeaveModalOpen(false)}
        onConfirm={confirmLeavePage}
      />

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
