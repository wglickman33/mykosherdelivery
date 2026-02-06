# Nursing Home System - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Run Migrations (1 minute)
```bash
cd backend
npx sequelize-cli db:migrate
```

**Expected Output:**
```
Sequelize CLI [Node: 18.x.x, CLI: 6.x.x, ORM: 6.x.x]

Loaded configuration file "config/database.js".
Using environment "development".
== 20260206000000-add-nursing-home-system: migrating =======
== 20260206000000-add-nursing-home-system: migrated (0.234s)
== 20260206100000-add-resident-orders-and-billing: migrating =======
== 20260206100000-add-resident-orders-and-billing: migrated (0.156s)
```

### Step 2: Seed Menu Items (30 seconds)
```bash
node scripts/seed-nursing-home-menu.js
```

**Expected Output:**
```
[INFO] Starting nursing home menu seed...
[INFO] Cleared existing menu items
[INFO] Successfully seeded 87 nursing home menu items
[INFO] Menu summary:
[INFO] - Breakfast: 29 items (23 mains, 6 sides)
[INFO] - Lunch: 20 items (12 entrees, 8 sides)
[INFO] - Dinner: 38 items (13 entrees, 15 sides, 4 desserts)
```

### Step 3: Start the App (30 seconds)
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
npm run dev
```

### Step 4: Test Menu Management (2 minutes)
1. Open browser: `http://localhost:5173/admin/login`
2. Login with your admin credentials
3. Click **"Restaurants"** in sidebar
4. Click **"Nursing Home Menu"** tab (third tab)
5. You should see **87 menu items** in a table!

**Try This:**
- Filter by "Breakfast" - see 29 items
- Search for "bagel" - see bagel items
- Click "Edit" on any item - modal opens
- Change the price - click "Update Item"
- See success notification ✅

---

## ✅ What's Working Right Now

### 1. Admin Menu Management ✅
- View all 87 menu items
- Filter by meal type (breakfast/lunch/dinner)
- Filter by category (main/side/entree/soup/dessert)
- Search by name
- Edit any item
- Create new items
- Activate/deactivate items
- See stats cards with counts

### 2. Backend APIs ✅
All these endpoints are working:

**Facilities:**
- `GET /api/nursing-homes/facilities` - List facilities
- `POST /api/nursing-homes/facilities` - Create facility
- `PUT /api/nursing-homes/facilities/:id` - Update facility

**Residents:**
- `GET /api/nursing-homes/residents` - List residents
- `POST /api/nursing-homes/residents` - Create resident
- `PUT /api/nursing-homes/residents/:id` - Update resident
- `POST /api/nursing-homes/residents/:id/assign` - Assign to worker

**Menu:**
- `GET /api/nursing-homes/menu` - Get menu items
- `POST /api/nursing-homes/menu` - Create menu item
- `PUT /api/nursing-homes/menu/:id` - Update menu item
- `DELETE /api/nursing-homes/menu/:id` - Deactivate menu item

**Resident Orders (NEW):**
- `GET /api/nursing-homes/resident-orders` - List orders
- `POST /api/nursing-homes/resident-orders` - Create order
- `POST /api/nursing-homes/resident-orders/:id/submit-and-pay` - Pay for order
- `GET /api/nursing-homes/resident-orders/:id/export` - Export to Excel

---

## 🧪 Quick API Test

### Test 1: Get Menu Items
```bash
# Get your admin token by logging in, then:
curl -X GET "http://localhost:3000/api/nursing-homes/menu" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** JSON with 87 menu items

### Test 2: Filter Breakfast Items
```bash
curl -X GET "http://localhost:3000/api/nursing-homes/menu?mealType=breakfast" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** JSON with 29 breakfast items

### Test 3: Create a Facility
```bash
curl -X POST "http://localhost:3000/api/nursing-homes/facilities" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Facility",
    "address": {
      "street": "123 Test St",
      "city": "New York",
      "state": "NY",
      "zip_code": "10001"
    },
    "contactEmail": "test@example.com",
    "contactPhone": "212-555-0100"
  }'
```

**Expected:** JSON with new facility ID

---

## 💳 Test Payment Flow

### Step 1: Set Stripe Test Mode
Make sure your `.env` has:
```
STRIPE_SECRET_KEY=sk_test_...
```

### Step 2: Use Test Card
```
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/28)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 10001)
```

### Step 3: Create and Pay for Order
```bash
# 1. Create order (returns order ID)
curl -X POST "http://localhost:3000/api/nursing-homes/resident-orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "residentId": "RESIDENT_ID",
    "weekStartDate": "2026-02-10",
    "weekEndDate": "2026-02-16",
    "meals": [{
      "day": "Monday",
      "mealType": "breakfast",
      "items": [{
        "id": "MENU_ITEM_ID",
        "name": "Scrambled Eggs",
        "category": "main",
        "price": 15.00
      }]
    }],
    "deliveryAddress": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zip_code": "10001"
    },
    "billingEmail": "test@example.com"
  }'

# 2. Submit and pay (use order ID from step 1)
curl -X POST "http://localhost:3000/api/nursing-homes/resident-orders/ORDER_ID/submit-and-pay" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "paymentMethodId": "pm_card_visa"
  }'
```

**Expected:** 
- Payment processed
- Receipt emailed to billing email
- Order status: "paid"

---

## 📊 Check What's in the Database

```bash
# Connect to your database
psql YOUR_DATABASE_NAME

# Check menu items
SELECT meal_type, category, COUNT(*) 
FROM nursing_home_menu_items 
GROUP BY meal_type, category;

# Expected output:
#  meal_type | category | count 
# -----------+----------+-------
#  breakfast | main     |    23
#  breakfast | side     |     6
#  lunch     | entree   |    12
#  lunch     | side     |     8
#  dinner    | entree   |    13
#  dinner    | side     |    11
#  dinner    | soup     |     4
#  dinner    | dessert  |     4

# Check facilities
SELECT id, name, is_active FROM nursing_home_facilities;

# Check residents
SELECT id, name, room_number, facility_id FROM nursing_home_residents;
```

---

## 🐛 Troubleshooting

### Issue: Migrations fail
**Solution:**
```bash
# Check if tables already exist
psql YOUR_DATABASE_NAME -c "\dt nursing_home*"

# If they exist, you may need to rollback
cd backend
npx sequelize-cli db:migrate:undo:all
npx sequelize-cli db:migrate
```

### Issue: Menu items not showing
**Solution:**
```bash
# Re-run seed script
cd backend
node scripts/seed-nursing-home-menu.js

# Check count
psql YOUR_DATABASE_NAME -c "SELECT COUNT(*) FROM nursing_home_menu_items;"
```

### Issue: 401 Unauthorized
**Solution:**
- Make sure you're logged in as admin
- Check that JWT token is in Authorization header
- Token format: `Bearer YOUR_TOKEN`
- Tokens expire after 1 hour

### Issue: Payment fails
**Solution:**
- Check Stripe test mode is enabled
- Use test card: 4242 4242 4242 4242
- Check `.env` has `STRIPE_SECRET_KEY=sk_test_...`
- Check backend logs for Stripe errors

---

## 📖 Next Steps

### For Testing:
1. ✅ Test menu management (you can do this now!)
2. ✅ Test API endpoints with Postman/curl
3. ⏳ Wait for NH User portal (coming soon)
4. ⏳ Wait for NH Admin portal (coming soon)

### For Development:
1. Read `IMPLEMENTATION_SUMMARY.md` - See what's done
2. Read `NURSING_HOME_TESTING_GUIDE.md` - Detailed testing
3. Read `NURSING_HOME_BILLING_MODEL.md` - Payment details

---

## 🎉 Success Checklist

- [ ] Migrations ran successfully
- [ ] 87 menu items seeded
- [ ] Can login as admin
- [ ] Can see "Nursing Home Menu" tab
- [ ] Can view all menu items
- [ ] Can filter by meal type
- [ ] Can search for items
- [ ] Can edit an item
- [ ] Can create a new item
- [ ] See success notifications

**If all checked ✅ - You're ready to go!**

---

## 💬 Questions?

- **Backend issues?** Check `backend/logs/` for errors
- **Frontend issues?** Check browser console (F12)
- **Database issues?** Check PostgreSQL logs
- **Payment issues?** Check Stripe dashboard

**Everything working?** Great! Read the full testing guide next:
👉 `NURSING_HOME_TESTING_GUIDE.md`
