# Nursing Home System Implementation Status

## ✅ Completed (Backend - Phase 1 & 2)

### Database Schema
- ✅ Updated `Profile` model with 5 user roles: `user`, `restaurant_owner`, `admin`, `nursing_home_admin`, `nursing_home_user`
- ✅ Added `nursingHomeFacilityId` field to Profile model
- ✅ Created `NursingHomeFacility` model
- ✅ Created `NursingHomeResident` model
- ✅ Created `NursingHomeMenuItem` model
- ✅ Created `NursingHomeOrder` model with deadline enforcement
- ✅ Created `NursingHomeInvoice` model
- ✅ Created migration file: `20260206000000-add-nursing-home-system.js`

### Authentication & Middleware
- ✅ Added `requireNursingHomeAdmin` middleware
- ✅ Added `requireNursingHomeUser` middleware
- ✅ Updated role validations in `backend/routes/admin.js`

### Backend Routes (All 5 route files)
- ✅ `backend/routes/nursing-homes.js` - Facility management
- ✅ `backend/routes/nursing-home-residents.js` - Resident management & assignment
- ✅ `backend/routes/nursing-home-menu.js` - Menu item management
- ✅ `backend/routes/nursing-home-orders.js` - Order creation, editing, submission with Sunday 12 PM deadline validation
- ✅ `backend/routes/nursing-home-invoices.js` - Invoice generation and management
- ✅ Registered all routes in `backend/app.js`

### Seed Data
- ✅ Created `backend/scripts/seed-nursing-home-menu.js` with complete menu from The Bristal:
  - 23 breakfast main options
  - 6 breakfast side options
  - 12 lunch entree options
  - 8 lunch side options
  - 13 dinner entree options
  - 15 dinner side/soup options
  - 4 dinner dessert options

### Order Deadline Validation
- ✅ Implemented Sunday 12:00 PM deadline calculation
- ✅ Orders cannot be edited after deadline (except by admin)
- ✅ Orders cannot be submitted after deadline
- ✅ Status tracking: draft → submitted → confirmed → in_progress → completed

### Export Functionality
- ✅ Implemented Excel export for nursing home orders (per resident or all)
- ✅ Export includes resident name, room number, day, meal type, items, bagel type

## 🚧 In Progress (Frontend - Phase 3 & 4)

### Login Components
- ✅ Created `NursingHomeLogin.jsx` and `.scss`
- ✅ Created `NursingHomeAdminLogin.jsx` (needs `.scss`)

### Still Needed for Frontend

#### Layouts
- ❌ `NursingHomeLayout.jsx` - Main layout with sidebar for NH users
- ❌ `NursingHomeAdminLayout.jsx` - Admin layout with sidebar for NH admins

#### Nursing Home User Portal
- ❌ `NursingHomeDashboard.jsx` - View assigned residents with 3 meal buttons each
- ❌ `ResidentCard.jsx` - Display resident info (name, room, dietary restrictions, allergies)
- ❌ `MealOrderForm.jsx` - Forms for breakfast/lunch/dinner ordering
- ❌ `NursingHomeOrders.jsx` - View order history (current week + past weeks)
- ❌ `OrderExport.jsx` - Export orders per resident

#### Nursing Home Admin Portal
- ❌ `NursingHomeAdminDashboard.jsx` - Overview of facility, residents, orders
- ❌ `ResidentManagement.jsx` - CRUD operations for residents
- ❌ `StaffAssignment.jsx` - Assign residents to NH users

## ❌ Not Started (Phase 5 - Admin Integration)

### MKD Admin Portal Updates
- ❌ Update `AdminUsers.jsx` with 5 role types and color-coded pills:
  - User: Green (#10b981)
  - Admin: Red (#ef4444)
  - Restaurant Owner: Blue (#3b82f6)
  - Nursing Home Admin: Pink (#ec4899)
  - Nursing Home User: Purple (#a855f7)
- ❌ Update `AdminOrders.jsx` with tabs for "Regular Orders" and "Nursing Home Orders"
- ❌ Create nursing home orders table view in admin
- ❌ Add "Locations" tab for nursing home facilities management
- ❌ Update analytics to include nursing home data

### Invoice Management UI
- ❌ Invoice generation interface
- ❌ Invoice list and detail views
- ❌ Mark as paid functionality
- ❌ Send invoice functionality

## ❌ Not Started (Phase 6 - Testing)

- ❌ Test order deadline enforcement
- ❌ Test multi-facility isolation
- ❌ Test resident assignment workflows
- ❌ Test export functionality
- ❌ Test all user roles and permissions
- ❌ Test order creation and editing flows
- ❌ Test invoice generation

## 📋 Next Steps

### Immediate Priority (Complete Phase 3 & 4)
1. Create SCSS for `NursingHomeAdminLogin`
2. Create layout components with sidebars (similar to AdminLayout)
3. Create nursing home user dashboard with resident cards
4. Create meal ordering forms (breakfast/lunch/dinner)
5. Create order history view
6. Create nursing home admin dashboard
7. Create resident management interface
8. Create staff assignment interface

### Then Phase 5 (Admin Integration)
1. Update AdminUsers component with 5 roles
2. Add tabs to AdminOrders
3. Create nursing home orders view in admin
4. Add Locations tab for facilities
5. Update analytics

### Finally Phase 6 (Testing)
1. Run migrations on development database
2. Seed menu items
3. Create test facilities, residents, and users
4. Test all workflows end-to-end

## 🔧 To Run Migrations

```bash
# Run migration
cd backend
npx sequelize-cli db:migrate

# Seed menu items
node scripts/seed-nursing-home-menu.js
```

## 📝 Notes

- All backend routes are protected with appropriate middleware
- Order deadline is automatically calculated (Sunday before week starts at 12 PM)
- Multi-facility support is built in
- Billing can be weekly or monthly per facility
- Tax rate is set to 8.875% (NY rate)
- Meal prices: Breakfast $15, Lunch $21, Dinner $23
- Export functionality uses XLSX library
- All nursing home routes are under `/api/nursing-homes/*`
