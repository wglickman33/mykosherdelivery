# Nursing Home Billing Model - Per-Resident Weekly Payments

## Overview

The nursing home system uses a **per-resident, weekly billing model**. Each resident (or their family) receives a bill and pays for their meals once per week when orders are submitted by Sunday 12:00 PM.

## Weekly Workflow

### Timeline:
```
Monday-Saturday: Worker creates/edits order (DRAFT)
                 ↓
Sunday 12:00 PM: Worker submits order + payment
                 ↓
                 Payment processed via Stripe
                 ↓
                 Resident receives bill/receipt via email
                 ↓
Monday-Sunday:   Meals delivered daily
```

## Key Concepts

### 1. Weekly Ordering Cycle
- **Workers create orders** throughout the week (Monday-Saturday)
- Orders can be modified anytime before the deadline
- **Deadline: Sunday 12:00 PM** for the upcoming week (Monday-Sunday)
- **Payment is processed once** when the worker submits the final order on Sunday
- Orders cannot be modified after the deadline (except by MKD admin)

### 2. Per-Resident Billing
- **Each resident is billed individually**
- **Residents receive the bill directly** (not the facility)
- **Workers facilitate the process** but residents pay

#### Worker Responsibilities:
1. **Create order** - Add meals for resident throughout the week
2. **Collect payment info** - Get card details or billing info from resident/family
3. **Submit order** - Enter payment and submit by Sunday 12 PM
4. **Confirm receipt** - Verify resident received email receipt

#### What Residents Receive:
- **Email receipt** from Stripe with:
  - Order number
  - Itemized meal list
  - Total amount charged
  - Payment method (last 4 digits)
  - Receipt PDF
- **Credit card statement** showing "MKD MEALS"

#### Billing Information (per resident):
- `billingEmail` - Email to send invoices/receipts to (resident or family)
- `billingName` - Name of person responsible for payment
- `billingPhone` - Contact phone number
- `paymentMethodId` - Saved Stripe payment method for automatic weekly billing

### 3. Payment Flow

#### Standard Weekly Flow:
1. **Monday-Saturday**: NH Worker adds meals to order (draft status)
   - Worker can add/edit meals for the week
   - No payment required yet
   - Order remains in "draft" status

2. **Sunday by 12 PM**: NH Worker submits final order with payment
   - Worker enters resident's payment method (or uses saved method)
   - Payment is processed immediately via Stripe
   - **Resident is charged once for the entire week**
   - Order status changes to "paid"
   - **Bill/receipt is emailed directly to resident** (at `billingEmail`)

#### Option A: One-Time Payment (New Resident)
1. Worker collects payment info from resident/family
2. Worker enters card details when submitting order
3. Payment processed immediately
4. Receipt emailed to resident

#### Option B: Automatic Payment (Returning Resident)
1. Resident has saved payment method on file
2. Worker creates order throughout the week
3. Worker submits order on Sunday (no payment entry needed)
4. System automatically charges saved payment method
5. Receipt emailed to resident

### 4. Order Statuses

**Order Status:**
- `draft` - Order created but not submitted
- `paid` - Payment processed successfully
- `in_progress` - Meals being prepared
- `completed` - All meals delivered
- `cancelled` - Order cancelled

**Payment Status:**
- `pending` - Awaiting payment
- `paid` - Payment successful
- `failed` - Payment failed (order remains in draft)
- `refunded` - Payment refunded

## Database Schema

### NursingHomeResidentOrders Table

```sql
CREATE TABLE nursing_home_resident_orders (
  id UUID PRIMARY KEY,
  resident_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  created_by_user_id UUID NOT NULL,
  order_number VARCHAR UNIQUE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  meals JSONB NOT NULL,
  status ENUM('draft', 'submitted', 'paid', 'in_progress', 'completed', 'cancelled'),
  total_meals INTEGER,
  subtotal DECIMAL(10,2),
  tax DECIMAL(10,2),
  total DECIMAL(10,2),
  payment_status ENUM('pending', 'paid', 'failed', 'refunded'),
  payment_method VARCHAR,
  payment_intent_id VARCHAR,
  paid_at TIMESTAMP,
  delivery_address JSONB,
  submitted_at TIMESTAMP,
  deadline TIMESTAMP,
  resident_name VARCHAR,
  room_number VARCHAR,
  billing_email VARCHAR,
  billing_name VARCHAR,
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### NursingHomeResidents Table (Updated)

```sql
ALTER TABLE nursing_home_residents ADD COLUMN billing_email VARCHAR;
ALTER TABLE nursing_home_residents ADD COLUMN billing_name VARCHAR;
ALTER TABLE nursing_home_residents ADD COLUMN billing_phone VARCHAR;
ALTER TABLE nursing_home_residents ADD COLUMN payment_method_id VARCHAR;
```

## API Endpoints

### Create Order
```
POST /api/nursing-homes/resident-orders
```

**Request Body:**
```json
{
  "residentId": "uuid",
  "weekStartDate": "2026-02-10",
  "weekEndDate": "2026-02-16",
  "meals": [
    {
      "day": "Monday",
      "mealType": "breakfast",
      "items": [
        {
          "id": "uuid",
          "name": "Scrambled Eggs",
          "category": "main",
          "price": 15.00
        }
      ],
      "bagelType": null
    }
  ],
  "deliveryAddress": {
    "street": "123 Main St",
    "city": "Great Neck",
    "state": "NY",
    "zip_code": "11021"
  },
  "billingEmail": "family@example.com",
  "billingName": "John Doe Jr."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "orderNumber": "NH-RES-ABC123-XYZ45",
    "status": "draft",
    "paymentStatus": "pending",
    "total": 16.33,
    "deadline": "2026-02-09T12:00:00.000Z"
  }
}
```

### Submit Order and Process Payment
```
POST /api/nursing-homes/resident-orders/:id/submit-and-pay
```

**Request Body:**
```json
{
  "paymentMethodId": "pm_123456" // Optional if resident has saved payment method
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "orderNumber": "NH-RES-ABC123-XYZ45",
    "status": "paid",
    "paymentStatus": "paid",
    "paymentIntentId": "pi_123456",
    "paidAt": "2026-02-06T10:30:00.000Z",
    "total": 16.33
  },
  "message": "Order submitted and payment processed successfully"
}
```

### List Orders for Resident
```
GET /api/nursing-homes/resident-orders?residentId=uuid
```

### Export Order
```
GET /api/nursing-homes/resident-orders/:id/export
```

Returns an Excel file with order details.

## Pricing

### Meal Prices (from The Bristal menu)
- **Breakfast**: $15.00 per meal
- **Lunch**: $21.00 per meal
- **Dinner**: $23.00 per meal

### Tax
- **NY Sales Tax**: 8.875%

### Example Weekly Cost
For a resident ordering all 21 meals (3 meals × 7 days):
- Breakfast (7): $105.00
- Lunch (7): $147.00
- Dinner (7): $161.00
- **Subtotal**: $413.00
- **Tax**: $36.65
- **Total**: $449.65

**Billed once on Sunday when order is submitted.**
**Resident receives the bill directly via email.**

## Payment Methods Supported

### Stripe Integration
- Credit/Debit Cards
- ACH Bank Transfers (future)
- Apple Pay / Google Pay (future)

### Alternative Methods (Manual Processing)
- Check (marked as "check" in payment_method)
- Cash (marked as "cash" in payment_method)
- Invoice (for facility-level billing if needed)

## Email Notifications

### Order Confirmation Email
Sent to `billingEmail` when order is paid:
- Order number
- Week dates
- Resident name and room
- Itemized meal list
- Total amount charged
- Payment method (last 4 digits)

### Payment Receipt
Sent via Stripe:
- Receipt URL
- Payment details
- Refund policy

### Weekly Reminder
Sent every Thursday to residents with saved payment methods:
- Reminder to place order by Sunday 12 PM
- Link to order portal
- Current week's menu

## Refund Policy

### Before Deadline (Before Sunday 12 PM)
- Full refund available
- Order can be cancelled
- Refund processed within 5-7 business days

### After Deadline (After Sunday 12 PM)
- No refunds (meals already ordered from restaurants)
- Exceptions handled by MKD admin on case-by-case basis

## Admin Capabilities

### MKD Admin Can:
- View all resident orders across all facilities
- Edit orders even after deadline
- Process manual refunds
- Mark orders as paid (for check/cash payments)
- Generate reports by facility, resident, or date range
- Export all orders to Excel

### NH Admin Can:
- View all orders for their facility
- Help residents with payment issues
- Contact MKD admin for special requests
- View payment status for all residents

### NH User (Worker) Can:
- Create orders for assigned residents only
- Add/edit meals throughout the week (before deadline)
- Collect payment information from residents/families
- Submit final order with payment by Sunday 12 PM
- View order history for assigned residents
- Export orders for family members
- **Note**: Workers facilitate ordering but residents receive the bills

## Reporting & Analytics

### For MKD Admin
- Total revenue by week
- Revenue by facility
- Average order value per resident
- Payment success rate
- Most popular menu items
- Dietary restriction trends

### For NH Admin
- Facility weekly spending
- Resident participation rate
- Payment collection status
- Upcoming order deadlines

### For NH User
- Orders placed this week
- Total meals ordered
- Residents with pending orders

## Future Enhancements

1. **Automatic Weekly Billing**
   - Charge saved payment methods automatically
   - Send confirmation emails
   - Handle failed payments gracefully

2. **Subscription Model**
   - Monthly subscription for 3 meals/day
   - Discounted pricing for subscriptions
   - Pause/resume functionality

3. **Family Portal**
   - Separate login for family members
   - View resident's meal history
   - Manage payment methods
   - Update dietary restrictions

4. **Mobile App**
   - iOS/Android apps for NH users
   - Push notifications for deadlines
   - Quick order entry
   - Photo upload for special requests

## Migration from Old Model

The old `NursingHomeOrders` table (facility-level bulk orders) will be deprecated but kept for historical data. New orders use `NursingHomeResidentOrders` (per-resident billing).

### Migration Steps:
1. Run new migration to create `nursing_home_resident_orders` table
2. Add billing fields to `nursing_home_residents` table
3. Update NH User portal to create per-resident orders
4. Keep old invoicing system for legacy orders
5. After 3 months, archive old orders table

## Support & Troubleshooting

### Common Issues

**Payment Failed**
- Check if card has sufficient funds
- Verify card is not expired
- Try different payment method
- Contact Stripe support if persistent

**Order Past Deadline**
- Contact MKD admin for special approval
- May incur rush fee
- Not guaranteed to be fulfilled

**Wrong Items Ordered**
- Edit order before Sunday 12 PM
- After deadline, contact MKD admin
- Refund/credit may be issued

### Contact
- **MKD Admin Support**: admin@mykosherdelivery.com
- **Technical Issues**: support@mykosherdelivery.com
- **Billing Questions**: billing@mykosherdelivery.com
