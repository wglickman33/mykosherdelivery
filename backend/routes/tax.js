const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { authenticateToken } = require("../middleware/auth");
const { body, validationResult } = require("express-validator");
const logger = require("../utils/logger");

const router = express.Router();

/**
 * Calculate tax using Stripe Tax API
 * POST /api/tax/calculate
 * Body: {
 *   items: [{ amount: number, description: string }],
 *   currency: string (default: 'usd'),
 *   customer: { address: { line1, city, state, postal_code, country } },
 *   shipping: { address: { line1, city, state, postal_code, country } } (optional)
 * }
 */
router.post(
  "/calculate",
  authenticateToken,
  [
    body("items").isArray({ min: 1 }).withMessage("Items array is required"),
    body("items.*.amount").isNumeric().withMessage("Item amount must be numeric"),
    body("currency").optional().isIn(["usd"]).withMessage("Currency must be USD"),
    body("customer.address").isObject().withMessage("Customer address is required"),
    body("customer.address.line1").notEmpty().withMessage("Address line1 is required"),
    body("customer.address.city").notEmpty().withMessage("City is required"),
    body("customer.address.state").notEmpty().withMessage("State is required"),
    body("customer.address.postal_code").notEmpty().withMessage("Postal code is required"),
    body("customer.address.country").optional().isIn(["US"]).withMessage("Country must be US"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn("Tax calculation validation failed:", { errors: errors.array(), body: req.body });
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const {
        items,
        currency = "usd",
        customer,
        shipping,
      } = req.body;

      // Validate required fields
      if (!customer || !customer.address) {
        logger.error("Missing customer address in tax calculation request:", { body: req.body });
        return res.status(400).json({
          success: false,
          error: "Customer address is required",
        });
      }

      if (!items || items.length === 0) {
        logger.error("Missing items in tax calculation request:", { body: req.body });
        return res.status(400).json({
          success: false,
          error: "Items array is required",
        });
      }

      // Validate address fields are not empty
      const address = customer.address;
      if (!address.line1 || !address.city || !address.state || !address.postal_code) {
        logger.error("Invalid customer address fields:", { address });
        return res.status(400).json({
          success: false,
          error: "All address fields (line1, city, state, postal_code) are required",
        });
      }

      // Validate items have valid amounts
      const invalidItems = items.filter(item => !item.amount || item.amount <= 0);
      if (invalidItems.length > 0) {
        logger.error("Invalid item amounts:", { invalidItems });
        return res.status(400).json({
          success: false,
          error: "All items must have a valid amount greater than 0",
        });
      }

      // Log the request for debugging (without sensitive data)
      logger.debug("Creating Stripe tax calculation", {
        itemCount: items.length,
        hasShipping: !!shipping,
        customerCity: address.city,
        customerState: address.state,
        shippingAmount: shipping?.amount,
      });

      // Prepare line items for Stripe
      const lineItems = items.map((item) => ({
        amount: Math.round((item.amount || 0) * 100), // Convert to cents
        reference: item.description || item.id || `item_${Date.now()}`,
      }));

      // Prepare customer details
      const customerDetails = {
        address: {
          line1: address.line1.trim(),
          city: address.city.trim(),
          state: address.state.trim(),
          postal_code: address.postal_code.trim(),
          country: address.country || "US",
        },
        address_source: "shipping",
      };

      // Add shipping as a line item instead of shipping_cost
      if (shipping && shipping.amount > 0) {
        lineItems.push({
          amount: Math.round(shipping.amount * 100), // Convert to cents
          reference: 'shipping_delivery_fee',
        });
      }

      // Create Stripe Tax Calculation payload
      const stripePayload = {
        currency,
        line_items: lineItems,
        customer_details: customerDetails,
      };

      logger.debug("Stripe tax calculation payload:", {
        currency,
        lineItemCount: lineItems.length,
        hasShipping: shipping && shipping.amount > 0,
      });

      // Create a Stripe Tax Calculation
      const calculation = await stripe.tax.calculations.create(stripePayload);

      // Extract tax breakdown
      const taxAmount = calculation.tax_amount_exclusive / 100; // Convert back to dollars
      const totalAmount = calculation.amount_total / 100;
      const subtotal = calculation.amount_subtotal / 100;

      // Get tax breakdown by jurisdiction
      const taxBreakdown = calculation.tax_breakdown?.map((breakdown) => ({
        jurisdiction: breakdown.jurisdiction,
        taxRate: breakdown.tax_rate / 10000, // Convert from basis points to decimal
        taxAmount: breakdown.tax_amount / 100,
        taxableAmount: breakdown.taxable_amount / 100,
      })) || [];

      res.json({
        success: true,
        data: {
          subtotal,
          taxAmount,
          totalAmount,
          taxBreakdown,
          calculationId: calculation.id,
        },
      });
    } catch (error) {
      logger.error("Error calculating tax with Stripe:", {
        error: error.message,
        stack: error.stack,
        type: error.type,
        code: error.code,
        requestBody: {
          itemCount: req.body?.items?.length,
          hasCustomer: !!req.body?.customer,
          hasShipping: !!req.body?.shipping,
        },
      });
      res.status(500).json({
        success: false,
        error: "Failed to calculate tax",
        message: error.message || "An unexpected error occurred",
        ...(process.env.NODE_ENV === 'development' && { details: error.stack }),
      });
    }
  }
);

module.exports = router;

