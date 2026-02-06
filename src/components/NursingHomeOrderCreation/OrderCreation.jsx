import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchResident, fetchMenuItems, createResidentOrder, fetchFacility } from '../../services/nursingHomeService';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import MealForm from './MealForm';
import OrderSummary from './OrderSummary';
import './OrderCreation.scss';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const OrderCreation = () => {
  const { residentId } = useParams();
  const navigate = useNavigate();
  
  const [resident, setResident] = useState(null);
  const [facility, setFacility] = useState(null);
  const [menuItems, setMenuItems] = useState({ breakfast: [], lunch: [], dinner: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const [meals, setMeals] = useState({});

  useEffect(() => {
    loadData();
  }, [residentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [residentRes, breakfastRes, lunchRes, dinnerRes] = await Promise.all([
        fetchResident(residentId),
        fetchMenuItems({ mealType: 'breakfast', isActive: true }),
        fetchMenuItems({ mealType: 'lunch', isActive: true }),
        fetchMenuItems({ mealType: 'dinner', isActive: true })
      ]);

      setResident(residentRes.data);
      
      if (residentRes.data.facilityId) {
        const facilityRes = await fetchFacility(residentRes.data.facilityId);
        setFacility(facilityRes.data);
      }

      setMenuItems({
        breakfast: breakfastRes.data || [],
        lunch: lunchRes.data || [],
        dinner: dinnerRes.data || []
      });
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getMealKey = (day, mealType) => `${day}-${mealType}`;

  const handleMealUpdate = (day, mealType, items, bagelType = null) => {
    const key = getMealKey(day, mealType);
    setMeals(prev => ({
      ...prev,
      [key]: { day, mealType, items, bagelType }
    }));
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      setError(null);

      const mealArray = Object.values(meals).filter(meal => meal.items && meal.items.length > 0);

      if (mealArray.length === 0) {
        setError('Please add at least one meal before saving');
        return;
      }

      const nextMonday = getNextMonday();
      const nextSunday = getNextSunday(nextMonday);

      const orderData = {
        residentId,
        weekStartDate: nextMonday.toISOString().split('T')[0],
        weekEndDate: nextSunday.toISOString().split('T')[0],
        meals: mealArray,
        deliveryAddress: facility?.address || {
          street: '',
          city: '',
          state: 'NY',
          zip_code: ''
        },
        billingEmail: resident?.billingEmail,
        billingName: resident?.billingName
      };

      const response = await createResidentOrder(orderData);

      if (response.success) {
        navigate(`/nursing-homes/order/${response.data.id}/payment`);
      }
    } catch (err) {
      console.error('Error saving order:', err);
      setError(err.response?.data?.message || 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const getNextMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilNextMonday);
    return nextMonday;
  };

  const getNextSunday = (monday) => {
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return sunday;
  };

  const getDeadline = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    nextSunday.setHours(12, 0, 0, 0);
    return nextSunday;
  };

  const getTotalMeals = () => {
    return Object.values(meals).filter(meal => meal.items && meal.items.length > 0).length;
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
        <button onClick={() => navigate('/nursing-homes/dashboard')}>Back to Dashboard</button>
      </div>
    );
  }

  const currentMeal = meals[getMealKey(selectedDay, selectedMealType)];

  return (
    <div className="order-creation">
      <div className="order-header">
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate('/nursing-homes/dashboard')}>
            ← Back
          </button>
          <div className="header-info">
            <h1>Create Weekly Order</h1>
            <p className="resident-name">{resident?.name} {resident?.roomNumber && `- Room ${resident.roomNumber}`}</p>
          </div>
        </div>
        <div className="deadline-warning">
          <span className="deadline-label">Deadline:</span>
          <span className="deadline-time">{getDeadline().toLocaleString()}</span>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="order-content">
        <div className="meal-selector">
          <div className="day-selector">
            <h3>Select Day</h3>
            <div className="day-buttons">
              {DAYS_OF_WEEK.map(day => (
                <button
                  key={day}
                  className={`day-btn ${selectedDay === day ? 'active' : ''}`}
                  onClick={() => setSelectedDay(day)}
                >
                  {day}
                  {Object.values(meals).filter(m => m.day === day && m.items?.length > 0).length > 0 && (
                    <span className="meal-count">
                      {Object.values(meals).filter(m => m.day === day && m.items?.length > 0).length}
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
                className={`meal-type-btn breakfast ${selectedMealType === 'breakfast' ? 'active' : ''}`}
                onClick={() => setSelectedMealType('breakfast')}
              >
                Breakfast
                {meals[getMealKey(selectedDay, 'breakfast')]?.items?.length > 0 && (
                  <span className="checkmark">✓</span>
                )}
              </button>
              <button
                className={`meal-type-btn lunch ${selectedMealType === 'lunch' ? 'active' : ''}`}
                onClick={() => setSelectedMealType('lunch')}
              >
                Lunch
                {meals[getMealKey(selectedDay, 'lunch')]?.items?.length > 0 && (
                  <span className="checkmark">✓</span>
                )}
              </button>
              <button
                className={`meal-type-btn dinner ${selectedMealType === 'dinner' ? 'active' : ''}`}
                onClick={() => setSelectedMealType('dinner')}
              >
                Dinner
                {meals[getMealKey(selectedDay, 'dinner')]?.items?.length > 0 && (
                  <span className="checkmark">✓</span>
                )}
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
          onSave={handleSaveDraft}
          saving={saving}
          totalMeals={getTotalMeals()}
        />
      </div>
    </div>
  );
};

export default OrderCreation;
