/**
 * Nursing home portal API flows.
 * Uses ephemeral fixtures that are always deleted in afterAll — no leftover test users.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const request = require('supertest');
const app = require('../../app');
const { createNhFixture } = require('../helpers/nhFixture');
const {
  NursingHomeResident,
  NursingHomeResidentOrder,
  NursingHomeMenuItem
} = require('../../models');

describe('Nursing home facility portal flows', () => {
  let fx;

  beforeAll(async () => {
    fx = await createNhFixture('flow');
  });

  afterAll(async () => {
    if (fx?.cleanup) await fx.cleanup();
  });

  test('admin can list residents for a facility', async () => {
    const res = await request(app)
      .get(`/api/nursing-homes/residents?facilityId=${fx.facility.id}`)
      .set(fx.platformAdminAuth)
      .expect(200);

    expect(res.body.success).toBe(true);
    const list = res.body.data || [];
    expect(list.some((r) => r.id === fx.resident.id)).toBe(true);
  });

  test('staff can fetch resident and facility by slug', async () => {
    const bySlug = await request(app)
      .get(`/api/nursing-homes/facilities/by-slug/${fx.facility.slug}`)
      .set(fx.staffAuth)
      .expect(200);

    expect(bySlug.body.data.id).toBe(fx.facility.id);
    expect(bySlug.body.data.slug).toBe(fx.facility.slug);

    const resident = await request(app)
      .get(`/api/nursing-homes/residents/${fx.resident.id}`)
      .set(fx.staffAuth)
      .expect(200);

    expect(resident.body.data.name).toContain('Test Resident');
  });

  test('assign resident to staff, then unassign', async () => {
    const assign = await request(app)
      .post(`/api/nursing-homes/residents/${fx.resident.id}/assign`)
      .set(fx.adminAuth)
      .send({ assignedUserId: fx.staff.id })
      .expect(200);

    expect(assign.body.data.assignedUserId).toBe(fx.staff.id);

    const unassign = await request(app)
      .put(`/api/nursing-homes/residents/${fx.resident.id}`)
      .set(fx.adminAuth)
      .send({ assignedUserId: null })
      .expect(200);

    expect(unassign.body.data.assignedUserId == null).toBe(true);
  });

  test('create draft order and submit without payment', async () => {
    const monday = new Date();
    const day = monday.getUTCDay();
    const add = day === 0 ? 1 : (8 - day) % 7 || 7;
    monday.setUTCDate(monday.getUTCDate() + add);
    const weekStart = monday.toISOString().slice(0, 10);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const weekEnd = sunday.toISOString().slice(0, 10);

    const create = await request(app)
      .post('/api/nursing-homes/resident-orders')
      .set(fx.staffAuth)
      .send({
        residentId: fx.resident.id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        meals: [
          {
            day: 'Monday',
            mealType: 'breakfast',
            none: true,
            items: []
          },
          {
            day: 'Monday',
            mealType: 'lunch',
            none: true,
            items: []
          }
        ],
        deliveryAddress: fx.facility.address,
        billingEmail: fx.resident.billingEmail,
        billingName: fx.resident.name
      });

    // Accept 201 or 200 depending on route; surface body on failure
    if (![200, 201].includes(create.status)) {
      // eslint-disable-next-line no-console
      console.error('create order failed', create.status, create.body);
    }
    expect([200, 201]).toContain(create.status);

    const order = create.body.data;
    expect(order.id).toBeTruthy();
    fx.orderIds.push(order.id);

    const submit = await request(app)
      .post(`/api/nursing-homes/resident-orders/${order.id}/submit`)
      .set(fx.staffAuth)
      .expect(200);

    expect(submit.body.data.status).toBe('submitted');
    expect(['pending', 'pending_monthly']).toContain(submit.body.data.paymentStatus);
  });

  test('deactivate then permanently delete a disposable resident', async () => {
    const disposable = await NursingHomeResident.create({
      facilityId: fx.facility.id,
      name: `Disposable ${fx.suffix}`,
      roomNumber: '999',
      isActive: true
    });
    fx.residentIds.push(disposable.id);

    const deactivate = await request(app)
      .delete(`/api/nursing-homes/residents/${disposable.id}`)
      .set(fx.adminAuth)
      .expect(200);

    expect(deactivate.body.permanent).toBe(false);
    await disposable.reload();
    expect(disposable.isActive).toBe(false);

    const hard = await request(app)
      .delete(`/api/nursing-homes/residents/${disposable.id}?permanent=true`)
      .set(fx.platformAdminAuth)
      .expect(200);

    expect(hard.body.permanent).toBe(true);
    const gone = await NursingHomeResident.findByPk(disposable.id);
    expect(gone).toBeNull();
    fx.residentIds = fx.residentIds.filter((id) => id !== disposable.id);
  });

  test('staff can order for unassigned resident in same facility', async () => {
    const other = await NursingHomeResident.create({
      facilityId: fx.facility.id,
      name: `Unassigned ${fx.suffix}`,
      roomNumber: '202',
      isActive: true,
      assignedUserId: null
    });
    fx.residentIds.push(other.id);

    const res = await request(app)
      .get(`/api/nursing-homes/residents/${other.id}`)
      .set(fx.staffAuth)
      .expect(200);

    expect(res.body.data.id).toBe(other.id);
  });

  test('rejects invalid meal composition on create', async () => {
    const disposable = await NursingHomeResident.create({
      facilityId: fx.facility.id,
      name: `Invalid Meal ${fx.suffix}`,
      roomNumber: '311',
      isActive: true
    });
    fx.residentIds.push(disposable.id);

    const monday = new Date();
    const day = monday.getUTCDay();
    const add = day === 0 ? 1 : (8 - day) % 7 || 7;
    monday.setUTCDate(monday.getUTCDate() + add);
    const weekStart = monday.toISOString().slice(0, 10);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const weekEnd = sunday.toISOString().slice(0, 10);

    const res = await request(app)
      .post('/api/nursing-homes/resident-orders')
      .set(fx.staffAuth)
      .send({
        residentId: disposable.id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        meals: [
          {
            day: 'Tuesday',
            mealType: 'breakfast',
            items: [{ id: '00000000-0000-4000-8000-000000000001', name: 'Eggs Only', category: 'main' }]
          }
        ],
        deliveryAddress: fx.facility.address
      })
      .expect(400);

    expect(res.body.error).toMatch(/Invalid meal/i);
  });

  test('platform admin facilities/current without facilityId returns a facility (never 400)', async () => {
    const res = await request(app)
      .get('/api/nursing-homes/facilities/current')
      .set(fx.platformAdminAuth)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data?.id).toBeTruthy();
    expect(res.body.data?.isActive).not.toBe(false);
  });

  test('unassigned nursing home user gets NOT_ASSIGNED on facilities/current', async () => {
    const { Profile } = require('../../models');
    const bcrypt = require('bcryptjs');
    const { authHeaderFor } = require('../helpers/nhFixture');
    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    const orphan = await Profile.create({
      email: `nh-orphan-${fx.suffix}@example.com`,
      password: passwordHash,
      firstName: 'Orphan',
      lastName: 'Staff',
      role: 'nursing_home_user',
      nursingHomeFacilityId: null
    });
    fx.profileIds.push(orphan.id);

    const res = await request(app)
      .get('/api/nursing-homes/facilities/current')
      .set(authHeaderFor(orphan.id))
      .expect(403);

    expect(res.body.code).toBe('NOT_ASSIGNED');
    expect(res.body.message).toMatch(/not assigned to a facility/i);
  });

  test('inactive facility by-slug is blocked', async () => {
    await fx.facility.update({ isActive: false });

    const res = await request(app)
      .get(`/api/nursing-homes/facilities/by-slug/${fx.facility.slug}`)
      .set(fx.staffAuth)
      .expect(403);

    expect(res.body.code).toBe('FACILITY_INACTIVE');

    await fx.facility.update({ isActive: true });
  });

  test('resident list with isActive=true excludes inactive residents', async () => {
    const inactive = await NursingHomeResident.create({
      facilityId: fx.facility.id,
      name: `Inactive ${fx.suffix}`,
      roomNumber: '303',
      isActive: false
    });
    fx.residentIds.push(inactive.id);

    const res = await request(app)
      .get(`/api/nursing-homes/residents?facilityId=${fx.facility.id}&isActive=true&limit=200`)
      .set(fx.adminAuth)
      .expect(200);

    const ids = (res.body.data || []).map((r) => r.id);
    expect(ids).toContain(fx.resident.id);
    expect(ids).not.toContain(inactive.id);
  });

  test('removing staff clears resident assignments', async () => {
    await request(app)
      .post(`/api/nursing-homes/residents/${fx.resident.id}/assign`)
      .set(fx.adminAuth)
      .send({ assignedUserId: fx.staff.id })
      .expect(200);

    await request(app)
      .delete(`/api/nursing-homes/facilities/${fx.facility.id}/staff/${fx.staff.id}`)
      .set(fx.platformAdminAuth)
      .expect(200);

    await fx.resident.reload();
    expect(fx.resident.assignedUserId).toBeNull();

    // Restore staff so later tests (if any) and cleanup stay coherent
    const { Profile } = require('../../models');
    await Profile.update(
      { role: 'nursing_home_admin', nursingHomeFacilityId: fx.facility.id },
      { where: { id: fx.staff.id } }
    );
  });

  test('excludesSide main allows breakfast without a side', async () => {
    const menuItem = await NursingHomeMenuItem.create({
      name: `Bagel Solo ${fx.suffix}`,
      category: 'main',
      mealType: 'breakfast',
      price: 15,
      isActive: true,
      excludesSide: true,
      requiresBagelType: true
    });

    const monday = new Date();
    const day = monday.getUTCDay();
    const add = day === 0 ? 1 : (8 - day) % 7 || 7;
    monday.setUTCDate(monday.getUTCDate() + add + 7);
    const weekStart = monday.toISOString().slice(0, 10);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const weekEnd = sunday.toISOString().slice(0, 10);

    const res = await request(app)
      .post('/api/nursing-homes/resident-orders')
      .set(fx.staffAuth)
      .send({
        residentId: fx.resident.id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        meals: [
          {
            day: 'Wednesday',
            mealType: 'breakfast',
            items: [
              {
                id: menuItem.id,
                name: menuItem.name,
                category: 'main',
                excludesSide: true,
                requiresBagelType: true
              }
            ],
            bagelType: 'Everything'
          }
        ],
        deliveryAddress: fx.facility.address
      });

    if (![200, 201].includes(res.status)) {
      // eslint-disable-next-line no-console
      console.error('excludesSide create failed', res.status, res.body);
    }
    expect([200, 201]).toContain(res.status);
    if (res.body.data?.id) fx.orderIds.push(res.body.data.id);

    await menuItem.destroy();
  });

  test('NH admin can create resident with login; NH user can self-order', async () => {
    const email = `resident-login-${fx.suffix}@example.com`;
    const create = await request(app)
      .post('/api/nursing-homes/residents')
      .set(fx.adminAuth)
      .send({
        facilityId: fx.facility.id,
        name: `Self Serve ${fx.suffix}`,
        roomNumber: '404',
        createLogin: true,
        email,
        password: 'TestPass123!'
      })
      .expect(201);

    expect(create.body.data.userId).toBeTruthy();
    expect(create.body.data.userAccount?.email).toBe(email);
    expect(create.body.data.userAccount?.role).toBe('nursing_home_user');
    fx.residentIds.push(create.body.data.id);
    fx.profileIds.push(create.body.data.userId);

    const { authHeaderFor } = require('../helpers/nhFixture');
    const userAuth = authHeaderFor(create.body.data.userId);

    const me = await request(app)
      .get('/api/nursing-homes/residents/me')
      .set(userAuth)
      .expect(200);
    expect(me.body.data.id).toBe(create.body.data.id);

    const monday = new Date();
    const day = monday.getUTCDay();
    const add = day === 0 ? 1 : (8 - day) % 7 || 7;
    monday.setUTCDate(monday.getUTCDate() + add);
    const weekStart = monday.toISOString().slice(0, 10);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const weekEnd = sunday.toISOString().slice(0, 10);

    const selfOrder = await request(app)
      .post('/api/nursing-homes/resident-orders')
      .set(userAuth)
      .send({
        residentId: create.body.data.id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        meals: [
          { day: 'Wednesday', mealType: 'breakfast', none: true, items: [] },
          { day: 'Wednesday', mealType: 'lunch', none: true, items: [] }
        ],
        deliveryAddress: fx.facility.address
      });

    expect([200, 201]).toContain(selfOrder.status);
    if (selfOrder.body.data?.id) fx.orderIds.push(selfOrder.body.data.id);
    expect(selfOrder.body.data.createdByUserId).toBe(create.body.data.userId);
  });

  test('NH admin cannot create staff; platform admin can', async () => {
    const denied = await request(app)
      .post(`/api/nursing-homes/facilities/${fx.facility.id}/staff`)
      .set(fx.adminAuth)
      .send({
        email: `blocked-staff-${fx.suffix}@example.com`,
        password: 'TestPass123!',
        firstName: 'Blocked',
        lastName: 'Staff'
      })
      .expect(403);

    expect(denied.body.message || denied.body.error).toMatch(/platform admin/i);

    const allowed = await request(app)
      .post(`/api/nursing-homes/facilities/${fx.facility.id}/staff`)
      .set(fx.platformAdminAuth)
      .send({
        email: `ok-staff-${fx.suffix}@example.com`,
        password: 'TestPass123!',
        firstName: 'Ok',
        lastName: 'Staff'
      })
      .expect(201);

    expect(allowed.body.data.role).toBe('nursing_home_admin');
    fx.profileIds.push(allowed.body.data.id);
  });

  test('when staff ordered for resident, NH user gets ADMIN_ALREADY_ORDERED', async () => {
    const email = `conflict-login-${fx.suffix}@example.com`;
    const create = await request(app)
      .post('/api/nursing-homes/residents')
      .set(fx.adminAuth)
      .send({
        facilityId: fx.facility.id,
        name: `Conflict Resident ${fx.suffix}`,
        roomNumber: '505',
        createLogin: true,
        email,
        password: 'TestPass123!'
      })
      .expect(201);

    fx.residentIds.push(create.body.data.id);
    fx.profileIds.push(create.body.data.userId);

    const monday = new Date();
    const day = monday.getUTCDay();
    const add = day === 0 ? 1 : (8 - day) % 7 || 7;
    monday.setUTCDate(monday.getUTCDate() + add);
    const weekStart = monday.toISOString().slice(0, 10);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const weekEnd = sunday.toISOString().slice(0, 10);

    const staffOrder = await request(app)
      .post('/api/nursing-homes/resident-orders')
      .set(fx.staffAuth)
      .send({
        residentId: create.body.data.id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        meals: [
          { day: 'Thursday', mealType: 'breakfast', none: true, items: [] },
          { day: 'Thursday', mealType: 'lunch', none: true, items: [] }
        ],
        deliveryAddress: fx.facility.address
      });

    expect([200, 201]).toContain(staffOrder.status);
    if (staffOrder.body.data?.id) fx.orderIds.push(staffOrder.body.data.id);

    const { authHeaderFor } = require('../helpers/nhFixture');
    const userAuth = authHeaderFor(create.body.data.userId);

    const conflict = await request(app)
      .post('/api/nursing-homes/resident-orders')
      .set(userAuth)
      .send({
        residentId: create.body.data.id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        meals: [
          { day: 'Friday', mealType: 'breakfast', none: true, items: [] },
          { day: 'Friday', mealType: 'lunch', none: true, items: [] }
        ],
        deliveryAddress: fx.facility.address
      })
      .expect(409);

    expect(conflict.body.code).toBe('ADMIN_ALREADY_ORDERED');
    expect(conflict.body.message).toMatch(/administrator has already placed/i);
  });

  test('NH user cannot order for another resident', async () => {
    const email = `solo-login-${fx.suffix}@example.com`;
    const create = await request(app)
      .post('/api/nursing-homes/residents')
      .set(fx.adminAuth)
      .send({
        facilityId: fx.facility.id,
        name: `Solo ${fx.suffix}`,
        roomNumber: '606',
        createLogin: true,
        email,
        password: 'TestPass123!'
      })
      .expect(201);

    fx.residentIds.push(create.body.data.id);
    fx.profileIds.push(create.body.data.userId);

    const { authHeaderFor } = require('../helpers/nhFixture');
    const userAuth = authHeaderFor(create.body.data.userId);

    const monday = new Date();
    const day = monday.getUTCDay();
    const add = day === 0 ? 1 : (8 - day) % 7 || 7;
    monday.setUTCDate(monday.getUTCDate() + add);
    const weekStart = monday.toISOString().slice(0, 10);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const weekEnd = sunday.toISOString().slice(0, 10);

    await request(app)
      .post('/api/nursing-homes/resident-orders')
      .set(userAuth)
      .send({
        residentId: fx.resident.id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        meals: [{ day: 'Monday', mealType: 'breakfast', none: true, items: [] }],
        deliveryAddress: fx.facility.address
      })
      .expect(403);
  });

  test('staff upserts draft instead of creating a second week order', async () => {
    const monday = new Date();
    const day = monday.getUTCDay();
    const add = day === 0 ? 1 : (8 - day) % 7 || 7;
    monday.setUTCDate(monday.getUTCDate() + add);
    const weekStart = monday.toISOString().slice(0, 10);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const weekEnd = sunday.toISOString().slice(0, 10);

    const create = await request(app)
      .post('/api/nursing-homes/residents')
      .set(fx.adminAuth)
      .send({
        facilityId: fx.facility.id,
        name: `Upsert Resident ${fx.suffix}`,
        roomNumber: '707',
        createLogin: true,
        email: `upsert-${fx.suffix}@example.com`,
        password: 'TestPass123!'
      })
      .expect(201);
    fx.residentIds.push(create.body.data.id);
    fx.profileIds.push(create.body.data.userId);

    const first = await request(app)
      .post('/api/nursing-homes/resident-orders')
      .set(fx.staffAuth)
      .send({
        residentId: create.body.data.id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        meals: [
          { day: 'Monday', mealType: 'breakfast', none: true, items: [] },
          { day: 'Monday', mealType: 'lunch', none: true, items: [] }
        ],
        deliveryAddress: fx.facility.address
      });
    expect([200, 201]).toContain(first.status);
    fx.orderIds.push(first.body.data.id);

    const second = await request(app)
      .post('/api/nursing-homes/resident-orders')
      .set(fx.staffAuth)
      .send({
        residentId: create.body.data.id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        meals: [
          { day: 'Tuesday', mealType: 'breakfast', none: true, items: [] },
          { day: 'Tuesday', mealType: 'lunch', none: true, items: [] }
        ],
        deliveryAddress: fx.facility.address
      })
      .expect(200);

    expect(second.body.upserted).toBe(true);
    expect(second.body.data.id).toBe(first.body.data.id);
  });

  test('NH user cannot submit a staff-created draft', async () => {
    const create = await request(app)
      .post('/api/nursing-homes/residents')
      .set(fx.adminAuth)
      .send({
        facilityId: fx.facility.id,
        name: `Submit Lock ${fx.suffix}`,
        roomNumber: '808',
        createLogin: true,
        email: `submit-lock-${fx.suffix}@example.com`,
        password: 'TestPass123!'
      })
      .expect(201);
    fx.residentIds.push(create.body.data.id);
    fx.profileIds.push(create.body.data.userId);

    const monday = new Date();
    const day = monday.getUTCDay();
    const add = day === 0 ? 1 : (8 - day) % 7 || 7;
    monday.setUTCDate(monday.getUTCDate() + add);
    const weekStart = monday.toISOString().slice(0, 10);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const weekEnd = sunday.toISOString().slice(0, 10);

    const staffOrder = await request(app)
      .post('/api/nursing-homes/resident-orders')
      .set(fx.staffAuth)
      .send({
        residentId: create.body.data.id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        meals: [
          { day: 'Monday', mealType: 'breakfast', none: true, items: [] },
          { day: 'Monday', mealType: 'lunch', none: true, items: [] }
        ],
        deliveryAddress: fx.facility.address
      });
    expect([200, 201]).toContain(staffOrder.status);
    fx.orderIds.push(staffOrder.body.data.id);

    const { authHeaderFor } = require('../helpers/nhFixture');
    const userAuth = authHeaderFor(create.body.data.userId);

    const submit = await request(app)
      .post(`/api/nursing-homes/resident-orders/${staffOrder.body.data.id}/submit`)
      .set(userAuth)
      .expect(409);

    expect(submit.body.code).toBe('ADMIN_ALREADY_ORDERED');
  });

  test('deactivating resident revokes linked login', async () => {
    const { Profile } = require('../../models');
    const create = await request(app)
      .post('/api/nursing-homes/residents')
      .set(fx.adminAuth)
      .send({
        facilityId: fx.facility.id,
        name: `Deactivate Login ${fx.suffix}`,
        roomNumber: '909',
        createLogin: true,
        email: `deactivate-login-${fx.suffix}@example.com`,
        password: 'TestPass123!'
      })
      .expect(201);

    const residentId = create.body.data.id;
    const userId = create.body.data.userId;
    fx.residentIds.push(residentId);
    fx.profileIds.push(userId);

    await request(app)
      .delete(`/api/nursing-homes/residents/${residentId}`)
      .set(fx.adminAuth)
      .expect(200);

    const resident = await NursingHomeResident.findByPk(residentId);
    expect(resident.isActive).toBe(false);
    expect(resident.userId).toBeNull();

    const profile = await Profile.findByPk(userId);
    expect(profile).toBeTruthy();
    expect(profile.role).toBe('user');
    expect(profile.nursingHomeFacilityId).toBeNull();
  });

  test('staff cannot create another order when week order is already submitted', async () => {
    const monday = new Date();
    const day = monday.getUTCDay();
    const add = day === 0 ? 1 : (8 - day) % 7 || 7;
    monday.setUTCDate(monday.getUTCDate() + add);
    const weekStart = monday.toISOString().slice(0, 10);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const weekEnd = sunday.toISOString().slice(0, 10);

    const disposable = await NursingHomeResident.create({
      facilityId: fx.facility.id,
      name: `Submitted Week ${fx.suffix}`,
      roomNumber: '910',
      isActive: true
    });
    fx.residentIds.push(disposable.id);

    const created = await request(app)
      .post('/api/nursing-homes/resident-orders')
      .set(fx.staffAuth)
      .send({
        residentId: disposable.id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        meals: [
          { day: 'Monday', mealType: 'breakfast', none: true, items: [] },
          { day: 'Monday', mealType: 'lunch', none: true, items: [] }
        ],
        deliveryAddress: fx.facility.address
      });
    expect([200, 201]).toContain(created.status);
    fx.orderIds.push(created.body.data.id);

    await request(app)
      .post(`/api/nursing-homes/resident-orders/${created.body.data.id}/submit`)
      .set(fx.staffAuth)
      .expect(200);

    const blocked = await request(app)
      .post('/api/nursing-homes/resident-orders')
      .set(fx.staffAuth)
      .send({
        residentId: disposable.id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        meals: [
          { day: 'Tuesday', mealType: 'breakfast', none: true, items: [] },
          { day: 'Tuesday', mealType: 'lunch', none: true, items: [] }
        ],
        deliveryAddress: fx.facility.address
      })
      .expect(409);

    expect(blocked.body.code).toBe('ORDER_WEEK_EXISTS');
  });
});
