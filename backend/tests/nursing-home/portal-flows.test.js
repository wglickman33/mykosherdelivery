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
        residentId: fx.resident.id,
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
      .set(fx.adminAuth)
      .expect(200);

    await fx.resident.reload();
    expect(fx.resident.assignedUserId).toBeNull();

    // Restore staff so later tests (if any) and cleanup stay coherent
    const { Profile } = require('../../models');
    await Profile.update(
      { role: 'nursing_home_user', nursingHomeFacilityId: fx.facility.id },
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
});
