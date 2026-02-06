# Nursing Home System - Audit & Action Plan

## 🔍 WHAT WE HAVE (Existing Components)

### ✅ Backend (100% Complete)
- **Models**: All 6 models created and migrated
- **Routes**: Consolidated into 2 files (`nursing-home-admin.js`, `nursing-home-orders.js`)
- **Auth Middleware**: `requireNursingHomeAdmin`, `requireNursingHomeUser`
- **Services**: Stripe payment integration, order management
- **Security**: Input validation, rate limiting, server-side price validation

### ✅ Frontend Components (Partially Complete)

#### Login Components (100% Complete)
- ✅ `NursingHomeLogin.jsx` - NH User login
- ✅ `NursingHomeAdminLogin.jsx` - NH Admin login
- Both have SCSS, loading states, error handling

#### NH User Components (80% Complete)
- ✅ `NursingHomeDashboard.jsx` - Shows residents, stats, actions
- ✅ `OrderCreation.jsx` - Full meal ordering flow
- ✅ `MealForm.jsx` - Individual meal selection
- ✅ `OrderSummary.jsx` - Order summary sidebar
- ✅ `OrderPayment.jsx` - Stripe payment integration
- ✅ All have SCSS, responsive design, accessibility

#### NH Admin Components (Partial - Need to Check)
- 📁 `NursingHomeAdminDashboard/` - Folder exists
- 📁 `ResidentManagement/` - Folder exists
- 📁 `StaffAssignment/` - Folder exists

#### Shared Components (Partial - Need to Check)
- 📁 `NursingHomeLayout/` - Folder exists
- 📁 `NursingHomeAdminLayout/` - Folder exists
- 📁 `NursingHomeOrders/` - Folder exists
- 📁 `OrderExport/` - Folder exists
- 📁 `ResidentCard/` - Folder exists
- 📁 `MealOrderForm/` - Folder exists

### ✅ Services (100% Complete)
- ✅ `nursingHomeService.js` - All API calls implemented
- ✅ `nursingHomeMenuService.js` - Menu management (in AdminRestaurants)

### ❌ Routing (0% Complete)
- ❌ No NH routes in `App.jsx`
- ❌ No route protection for NH users
- ❌ No NH layouts integrated

---

## 🎯 WHAT WE NEED TO DO

### Phase 1: Routing & Integration (Priority 1)

#### 1.1 Add NH Routes to App.jsx
```jsx
// Add these routes:
/nursing-homes/login
/nursing-homes/dashboard
/nursing-homes/order/new/:residentId
/nursing-homes/order/:orderId/payment
/nursing-homes/orders
/nursing-homes/admin/login
/nursing-homes/admin/dashboard
/nursing-homes/admin/residents
/nursing-homes/admin/staff
/nursing-homes/admin/orders
```

#### 1.2 Create/Complete Layout Components
- Check `NursingHomeLayout.jsx` - needs header, nav, sidebar
- Check `NursingHomeAdminLayout.jsx` - needs admin nav
- Reuse patterns from `AdminLayout.jsx` where possible

#### 1.3 Route Protection
- Add NH role checks to `useAuth` hook
- Protect NH routes from regular users
- Protect admin routes from NH users

### Phase 2: Complete Missing Components (Priority 2)

#### 2.1 NH Admin Dashboard
- Check what exists in `NursingHomeAdminDashboard/`
- Build: Facility overview, stats, quick actions
- Reuse: AdminDashboard patterns

#### 2.2 Resident Management
- Check what exists in `ResidentManagement/`
- Build: CRUD for residents, assignment UI
- Reuse: AdminUsers table patterns

#### 2.3 Staff Assignment
- Check what exists in `StaffAssignment/`
- Build: Assign residents to NH users
- Reuse: Modal patterns from existing components

#### 2.4 Orders Management
- Check what exists in `NursingHomeOrders/`
- Build: View all orders, filter, export
- Reuse: AdminOrders table patterns

#### 2.5 Order Export
- Check what exists in `OrderExport/`
- Build: Per-resident export functionality
- Reuse: AdminOrders export logic

### Phase 3: Testing & Polish (Priority 3)

#### 3.1 End-to-End Testing
- NH User: Login → View residents → Create order → Pay
- NH Admin: Login → Manage residents → Assign staff → View orders
- MKD Admin: View NH orders in admin panel

#### 3.2 Integration Testing
- Payment flow with Stripe
- Order deadline enforcement (Sunday 12 PM)
- Weekly order submission
- Email receipts

#### 3.3 UI/UX Polish
- Consistent styling across all NH components
- Responsive design verification
- Accessibility audit (WCAG 2.1 AA)
- Loading states, error handling

---

## 📋 CONSOLIDATION OPPORTUNITIES

### 1. Login Components
**Current**: 2 separate login components (NursingHomeLogin, NursingHomeAdminLogin)
**Opportunity**: Create single `NursingHomeLoginPage.jsx` with `type` prop
**Benefit**: DRY, easier maintenance
**Decision**: Keep separate for now (different branding, different redirects)

### 2. Layout Components
**Current**: Separate layouts for NH user and NH admin
**Opportunity**: Single layout with conditional nav based on role
**Benefit**: Less duplication
**Decision**: Check existing layouts first, consolidate if minimal differences

### 3. Order Tables
**Current**: Will have separate order tables for NH and regular orders
**Opportunity**: Unified order table component with `type` prop
**Benefit**: Consistent UI, shared logic
**Decision**: Extend AdminOrders to support NH orders with filter

### 4. Resident Card
**Current**: Folder exists, likely duplicates logic from NursingHomeDashboard
**Opportunity**: Extract resident display logic to shared component
**Benefit**: Reusable across dashboard, management, etc.
**Decision**: Check and consolidate

---

## 🚀 EXECUTION PLAN

### Step 1: Audit Existing Folders (15 min)
- Read all files in empty/partial folders
- Document what exists vs what's needed
- Identify any dead code or duplicates

### Step 2: Routing First (30 min)
- Add all NH routes to App.jsx
- Create route protection logic
- Test navigation flow

### Step 3: Complete Layouts (45 min)
- Build/complete NursingHomeLayout
- Build/complete NursingHomeAdminLayout
- Ensure consistent header, nav, styling

### Step 4: Fill Component Gaps (2-3 hours)
- Complete NH Admin Dashboard
- Complete Resident Management
- Complete Staff Assignment
- Complete Orders Management
- Complete Order Export

### Step 5: Integration & Testing (1-2 hours)
- Connect all components to backend
- Test full user flows
- Fix bugs, edge cases

### Step 6: Polish & Optimize (1 hour)
- Consistent styling
- Responsive design
- Accessibility
- Performance optimization

---

## 📊 CURRENT STATUS

| Component | Status | Action Needed |
|-----------|--------|---------------|
| Backend | ✅ 100% | None |
| NH User Login | ✅ 100% | None |
| NH Admin Login | ✅ 100% | None |
| NH User Dashboard | ✅ 100% | None |
| Order Creation | ✅ 100% | None |
| Order Payment | ✅ 100% | None |
| Routing | ❌ 0% | Add to App.jsx |
| NH User Layout | ❓ Unknown | Check & complete |
| NH Admin Layout | ❓ Unknown | Check & complete |
| NH Admin Dashboard | ❓ Unknown | Check & complete |
| Resident Management | ❓ Unknown | Check & complete |
| Staff Assignment | ❓ Unknown | Check & complete |
| Orders Management | ❓ Unknown | Check & complete |
| Order Export | ❓ Unknown | Check & complete |
| Integration Testing | ❌ 0% | Full E2E test |

**Estimated Completion**: 5-7 hours of focused work
**Current Progress**: ~60% complete
