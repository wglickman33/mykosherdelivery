# Nursing Home System - Complete Testing Guide

## Prerequisites

### 1. Run Database Migrations
```bash
cd backend
npx sequelize-cli db:migrate
```

### 2. Seed Nursing Home Menu
```bash
cd backend
node scripts/seed-nursing-home-menu.js
```

This will create 87 menu items:
- **Breakfast**: 23 main options + 6 side options = 29 items
- **Lunch**: 12 entree options + 8 side options = 20 items
- **Dinner**: 13 entree options + 15 side/soup options + 4 dessert options = 32 items

### 3. Start the Application
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd /path/to/frontend
npm run dev
```

---

## Testing Flow

## PART 1: MKD Admin Setup (Main Admin)

### Step 1: Login as MKD Admin
1. Navigate to `/admin/login`
2. Login with your admin credentials (willglickman@gmail.com)
3. Verify you see the admin dashboard

### Step 2: Verify Nursing Home Menu Management
1. Click on **"Restaurants"** in the sidebar
2. You should see **3 tabs**: "Restaurants", "Menus", "Nursing Home Menu"
3. Click on **"Nursing Home Menu"** tab

#### Expected View:
- **Header**: "Nursing Home Menu Management"
- **Filters**: Meal Type, Category, Search
- **Stats Cards**: Total Items, Breakfast, Lunch, Dinner counts
- **Table** with columns:
  - Order
  - Name
  - Meal Type (colored badges)
  - Category
  - Price
  - Bagel Type?
  - Excludes Side?
  - Status
  - Actions (Edit/Deactivate buttons)

#### Test Menu Management:
1. **Filter by Breakfast**:
   - Select "Breakfast" from Meal Type dropdown
   - Verify only breakfast items show (should be 29 items)
   - Check that categories are "Main" or "Side"

2. **Filter by Lunch**:
   - Select "Lunch" from Meal Type dropdown
   - Verify only lunch items show (should be 20 items)
   - Check that categories are "Entree" or "Side"

3. **Filter by Dinner**:
   - Select "Dinner" from Meal Type dropdown
   - Verify only dinner items show (should be 32 items)
   - Check that categories are "Entree", "Side", "Soup", or "Dessert"

4. **Search Test**:
   - Type "bagel" in search box
   - Verify only bagel-related items appear
   - Clear search and verify all items return

5. **Edit a Menu Item**:
   - Click "Edit" on any item
   - Modal should open with all fields populated
   - Change the price from $15.00 to $16.00
   - Click "Update Item"
   - Verify the price updated in the table
   - Verify you see a success notification

6. **Create a New Menu Item**:
   - Click "Add NH Menu Item" button (top right)
   - Fill in the form:
     - Meal Type: Breakfast
     - Category: Main
     - Name: "Test Breakfast Item"
     - Description: "This is a test item"
     - Price: 12.50
     - Display Order: 999
     - Check "Active"
   - Click "Create Item"
   - Verify new item appears in the table
   - Verify success notification

7. **Deactivate a Menu Item**:
   - Click "Deactivate" on the test item you just created
   - Confirm the action
   - Verify the item's status changes to "Inactive"
   - Verify the row becomes slightly transparent

### Step 3: Create a Nursing Home Facility
1. Open a new tab and navigate to: `http://localhost:3000/api/nursing-homes/facilities`
   - You should get a 401 error (expected - need authentication)

2. Use Postman or create a test script:
```bash
# Get your admin token first by logging in
# Then use this curl command:

curl -X POST http://localhost:3000/api/nursing-homes/facilities \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "The Bristal Assisted Living",
    "address": {
      "street": "123 Main Street",
      "city": "Great Neck",
      "state": "NY",
      "zip_code": "11021"
    },
    "contactEmail": "admin@thebristal.com",
    "contactPhone": "516-555-0100",
    "billingFrequency": "monthly"
  }'
```

3. **Verify Response**:
   - Status: 201 Created
   - Response contains facility ID
   - Save this facility ID for later steps

### Step 4: Create Nursing Home Admin User
```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "email": "nh-admin@thebristal.com",
    "password": "Test123!",
    "firstName": "Sarah",
    "lastName": "Johnson",
    "role": "nursing_home_admin",
    "nursingHomeFacilityId": "FACILITY_ID_FROM_STEP_3"
  }'
```

### Step 5: Create Nursing Home User (Worker)
```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "email": "nh-worker@thebristal.com",
    "password": "Test123!",
    "firstName": "Maria",
    "lastName": "Garcia",
    "role": "nursing_home_user",
    "nursingHomeFacilityId": "FACILITY_ID_FROM_STEP_3"
  }'
```

### Step 6: Verify Users in Admin Panel
1. Go to **"Users"** tab in admin panel
2. Search for "thebristal"
3. **Verify you see**:
   - Sarah Johnson with **pink pill** labeled "nursing_home_admin"
   - Maria Garcia with **purple pill** labeled "nursing_home_user"
4. Click on each user to view details
5. Verify their facility association is correct

---

## PART 2: Nursing Home Admin Testing

### Step 1: Login as NH Admin
1. **Logout** from MKD admin
2. Navigate to `/nursing-homes/admin/login`
3. Login with:
   - Email: nh-admin@thebristal.com
   - Password: Test123!
4. **Expected**: Redirect to `/nursing-homes/admin/dashboard`

### Step 2: Create Residents
Use API to create test residents:

```bash
# Resident 1
curl -X POST http://localhost:3000/api/nursing-homes/residents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer NH_ADMIN_TOKEN" \
  -d '{
    "facilityId": "FACILITY_ID",
    "name": "John Smith",
    "roomNumber": "101",
    "dietaryRestrictions": "Low sodium",
    "allergies": "Peanuts, shellfish"
  }'

# Resident 2
curl -X POST http://localhost:3000/api/nursing-homes/residents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer NH_ADMIN_TOKEN" \
  -d '{
    "facilityId": "FACILITY_ID",
    "name": "Mary Johnson",
    "roomNumber": "102",
    "dietaryRestrictions": "Diabetic",
    "allergies": "None"
  }'

# Resident 3
curl -X POST http://localhost:3000/api/nursing-homes/residents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer NH_ADMIN_TOKEN" \
  -d '{
    "facilityId": "FACILITY_ID",
    "name": "Robert Williams",
    "roomNumber": "103",
    "dietaryRestrictions": "Gluten-free",
    "allergies": "Dairy"
  }'
```

### Step 3: Assign Residents to Worker
```bash
# Assign John Smith to Maria Garcia
curl -X POST http://localhost:3000/api/nursing-homes/residents/RESIDENT_1_ID/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer NH_ADMIN_TOKEN" \
  -d '{
    "assignedUserId": "MARIA_USER_ID"
  }'

# Assign Mary Johnson to Maria Garcia
curl -X POST http://localhost:3000/api/nursing-homes/residents/RESIDENT_2_ID/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer NH_ADMIN_TOKEN" \
  -d '{
    "assignedUserId": "MARIA_USER_ID"
  }'
```

### Step 4: Verify Resident List
```bash
# Get all residents for the facility
curl -X GET http://localhost:3000/api/nursing-homes/residents?facilityId=FACILITY_ID \
  -H "Authorization: Bearer NH_ADMIN_TOKEN"
```

**Expected Response**:
- Array of 3 residents
- John and Mary should have `assignedUserId` set to Maria's ID
- Robert should have `assignedUserId: null`

---

## PART 3: Nursing Home User (Worker) Testing

### Step 1: Login as NH User
1. **Logout** from NH admin
2. Navigate to `/nursing-homes/login`
3. Login with:
   - Email: nh-worker@thebristal.com
   - Password: Test123!
4. **Expected**: Redirect to `/nursing-homes/dashboard`

### Step 2: View Assigned Residents
1. **Expected to see**:
   - Dashboard showing 2 residents (John Smith and Mary Johnson)
   - Each resident card should display:
     - Name
     - Room number
     - Dietary restrictions
     - Allergies
     - 3 buttons: Breakfast, Lunch, Dinner

2. **Verify you DON'T see**:
   - Robert Williams (not assigned to this worker)

### Step 3: Create a Weekly Order

#### Calculate Current Week Dates
- If today is Thursday, Feb 6, 2026:
  - Next Sunday deadline: Feb 9, 2026 at 12:00 PM
  - Week starts: Monday, Feb 10, 2026
  - Week ends: Sunday, Feb 16, 2026

#### Order for John Smith - Monday Breakfast
```bash
curl -X POST http://localhost:3000/api/nursing-homes/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer NH_USER_TOKEN" \
  -d '{
    "facilityId": "FACILITY_ID",
    "weekStartDate": "2026-02-10",
    "weekEndDate": "2026-02-16",
    "deliveryAddress": {
      "street": "123 Main Street",
      "city": "Great Neck",
      "state": "NY",
      "zip_code": "11021"
    },
    "residentMeals": [
      {
        "residentId": "JOHN_RESIDENT_ID",
        "residentName": "John Smith",
        "roomNumber": "101",
        "meals": [
          {
            "day": "Monday",
            "mealType": "breakfast",
            "items": [
              {
                "id": "MENU_ITEM_ID_SCRAMBLED_EGGS",
                "name": "Scrambled Eggs",
                "category": "main",
                "price": 15.00
              },
              {
                "id": "MENU_ITEM_ID_FRUIT_CUP",
                "name": "Fruit Cup",
                "category": "side",
                "price": 0
              }
            ]
          }
        ]
      }
    ]
  }'
```

**Expected Response**:
- Status: 201 Created
- Order number like "NH-ABC123-XYZ45"
- Status: "draft"
- Deadline: "2026-02-09T12:00:00.000Z"
- Total meals: 1
- Subtotal: $15.00
- Tax: $1.33 (8.875%)
- Total: $16.33

### Step 4: Edit Order Before Deadline
```bash
# Add Tuesday breakfast for John
curl -X PUT http://localhost:3000/api/nursing-homes/orders/ORDER_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer NH_USER_TOKEN" \
  -d '{
    "residentMeals": [
      {
        "residentId": "JOHN_RESIDENT_ID",
        "residentName": "John Smith",
        "roomNumber": "101",
        "meals": [
          {
            "day": "Monday",
            "mealType": "breakfast",
            "items": [...]
          },
          {
            "day": "Tuesday",
            "mealType": "breakfast",
            "items": [
              {
                "id": "MENU_ITEM_ID_PANCAKES",
                "name": "Pancakes with Syrup",
                "category": "main",
                "price": 15.00
              }
            ],
            "bagelType": null
          }
        ]
      }
    ]
  }'
```

**Expected**:
- Status: 200 OK
- Total meals: 2
- Subtotal: $30.00
- Tax: $2.66
- Total: $32.66

### Step 5: Submit Order
```bash
curl -X POST http://localhost:3000/api/nursing-homes/orders/ORDER_ID/submit \
  -H "Authorization: Bearer NH_USER_TOKEN"
```

**Expected**:
- Status: 200 OK
- Order status changed to "submitted"
- `submittedAt` timestamp populated

### Step 6: Try to Edit After Submission (Should Fail for Worker)
```bash
curl -X PUT http://localhost:3000/api/nursing-homes/orders/ORDER_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer NH_USER_TOKEN" \
  -d '{
    "residentMeals": [...]
  }'
```

**Expected**:
- Status: 403 Forbidden
- Error: "Cannot edit submitted order"

### Step 7: Export Order
```bash
curl -X GET "http://localhost:3000/api/nursing-homes/orders/ORDER_ID/export?residentId=JOHN_RESIDENT_ID" \
  -H "Authorization: Bearer NH_USER_TOKEN" \
  --output john-smith-order.xlsx
```

**Expected**:
- Downloads an Excel file
- Open the file and verify:
  - Facility name
  - Order number
  - Week dates
  - Resident name, room number
  - All meals with items listed

---

## PART 4: MKD Admin - Nursing Home Management

### Step 1: Login as MKD Admin Again
1. Navigate to `/admin/login`
2. Login with admin credentials

### Step 2: View Nursing Home Orders
1. Go to **"Orders"** tab
2. **Expected**: You should see **2 sub-tabs**:
   - "Regular Orders"
   - "Nursing Home Orders"

3. Click on **"Nursing Home Orders"**

**Expected View**:
- Table showing all nursing home orders
- Columns should include:
  - Order Number
  - Facility Name
  - Week Dates
  - Total Meals
  - Total Amount
  - Status
  - Actions (View, Edit, Delete)

### Step 3: View Order Details
1. Click "View" on the order you created
2. **Expected Modal**:
   - Order number
   - Facility details
   - Week dates
   - Deadline
   - Resident meals breakdown
   - Each meal with items listed
   - Totals (subtotal, tax, total)

### Step 4: Edit Order as Admin (After Deadline)
1. Click "Edit" on the order
2. **Expected**: Admin can edit even after deadline
3. Add another meal
4. Save changes
5. Verify changes are reflected

### Step 5: View Facilities
```bash
curl -X GET http://localhost:3000/api/nursing-homes/facilities \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Expected**:
- List of all facilities
- The Bristal facility you created
- Staff count
- Resident count

### Step 6: Generate Invoice
```bash
curl -X POST http://localhost:3000/api/nursing-homes/invoices/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "facilityId": "FACILITY_ID",
    "billingPeriodStart": "2026-02-10",
    "billingPeriodEnd": "2026-02-16",
    "dueDate": "2026-03-10"
  }'
```

**Expected**:
- Status: 201 Created
- Invoice number like "INV-NH-202602-ABC12"
- Total meals count
- Subtotal, tax, total
- Status: "draft"
- Order IDs array

### Step 7: View Invoice
```bash
curl -X GET http://localhost:3000/api/nursing-homes/invoices/INVOICE_ID \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Expected**:
- Invoice details
- Associated orders
- Facility information

### Step 8: Mark Invoice as Paid
```bash
curl -X POST http://localhost:3000/api/nursing-homes/invoices/INVOICE_ID/mark-paid \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Expected**:
- Status: 200 OK
- Invoice status: "paid"
- `paidAt` timestamp populated

---

## PART 5: Edge Cases & Error Handling

### Test 1: Deadline Enforcement
1. Create an order with a past deadline
2. Try to submit it
3. **Expected**: 403 Forbidden - "Cannot submit order after deadline"

### Test 2: Facility Isolation
1. Login as NH Admin for Facility A
2. Try to view residents from Facility B
3. **Expected**: 403 Forbidden or empty list

### Test 3: Worker Can Only See Assigned Residents
1. Login as NH User (Maria)
2. Try to access Robert Williams (unassigned resident)
3. **Expected**: 403 Forbidden or not visible in dashboard

### Test 4: Menu Item Validation
1. Try to create a breakfast item with category "dessert"
2. **Expected**: Should work (backend allows it)
3. Try to create an item with negative price
4. **Expected**: Validation error

### Test 5: Duplicate Order Prevention
1. Try to create two orders for the same facility and week
2. **Expected**: Should be allowed (multiple workers can create orders)

---

## PART 6: UI/UX Verification

### Nursing Home Menu Tab (Admin)
- [ ] Tab is visible and clickable
- [ ] Filters work correctly
- [ ] Stats cards show accurate counts
- [ ] Table displays all menu items
- [ ] Meal type badges have correct colors
- [ ] Edit button opens modal with correct data
- [ ] Create button opens empty modal
- [ ] Form validation works
- [ ] Success/error notifications appear
- [ ] Deactivate button toggles status

### Login Pages
- [ ] `/nursing-homes/login` has purple theme
- [ ] `/nursing-homes/admin/login` has pink theme
- [ ] Both have proper branding
- [ ] Error messages display correctly
- [ ] Loading states work

### Responsive Design
- [ ] Test on mobile (375px width)
- [ ] Test on tablet (768px width)
- [ ] Test on desktop (1920px width)
- [ ] All tables scroll horizontally on mobile
- [ ] Modals are centered and scrollable

---

## PART 7: Performance Testing

### Load Test Menu Items
1. Verify all 87 menu items load quickly
2. Filter and search should be instant
3. No lag when switching between meal types

### Order Creation
1. Create an order with 21 meals (full week for 1 resident)
2. Verify calculation is instant
3. Verify submission is fast

---

## Success Criteria

✅ **All backend routes respond correctly**
✅ **All user roles have appropriate permissions**
✅ **Menu management works end-to-end**
✅ **Residents can be created and assigned**
✅ **Orders can be created, edited, and submitted**
✅ **Deadline enforcement works**
✅ **Export functionality works**
✅ **Invoices can be generated and managed**
✅ **UI is responsive and user-friendly**
✅ **No console errors**
✅ **All notifications display correctly**

---

## Troubleshooting

### Issue: 401 Unauthorized
- Check that JWT token is valid
- Verify token is included in Authorization header
- Check token hasn't expired (1 hour default)

### Issue: 403 Forbidden
- Verify user has correct role
- Check facility association
- Verify resident assignment

### Issue: Menu items not loading
- Check that seed script ran successfully
- Verify database connection
- Check browser console for errors

### Issue: Can't create order
- Verify facility exists
- Check that menu items exist
- Verify resident is assigned to user
- Check deadline calculation

---

## Next Steps After Testing

1. **Fix any bugs found during testing**
2. **Complete remaining frontend components**:
   - Nursing Home User Dashboard
   - Nursing Home Admin Dashboard
   - Meal ordering forms
   - Resident management UI
   - Staff assignment UI
3. **Add analytics for nursing home orders**
4. **Implement email notifications**
5. **Add PDF invoice generation**
6. **Create user documentation**
