const express = require('express');
const nursingHomeAdminRoutes = require('./nursing-home-admin');
const nursingHomeOrdersRoutes = require('./nursing-home-orders');

const router = express.Router();
router.use(nursingHomeAdminRoutes);
router.use(nursingHomeOrdersRoutes);

module.exports = router;
