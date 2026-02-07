/**
 * Single entry point for /api/nursing-homes.
 * Admin routes MUST be first so GET /facilities and GET /residents are handled
 * (orders router has no /facilities). Order cannot be wrong when deployed.
 */
const express = require('express');
const nursingHomeAdminRoutes = require('./nursing-home-admin');
const nursingHomeOrdersRoutes = require('./nursing-home-orders');

const router = express.Router();
router.use(nursingHomeAdminRoutes);
router.use(nursingHomeOrdersRoutes);

module.exports = router;
