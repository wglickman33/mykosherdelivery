const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { authenticateToken } = require("../middleware/auth");
const { Order, Profile, PaymentMethod, Restaurant } = require("../models");
const { body, validationResult } = require("express-validator");
const logger = require("../utils/logger");
const { sendOrderToShipday } = require("../services/shipdayService");

const router = express.Router();

// Validate Stripe configuration
if (
  !process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET_KEY.includes("placeholder")
) {
  logger.error("Stripe secret key not configured properly");
}

// Create payment intent (secure server-side payment processing)
router.post(
  "/create-intent",
  authenticateToken,
  [
    body("amount")
      .isNumeric()
      .custom((value) => {
        if (value <= 0 || value > 999999) {
          // Max $9,999.99
          throw new Error("Invalid payment amount");
        }
        return true;
      }),
    body("currency").isIn(["usd"]),
    body("orderIds").isArray({ min: 1 }),
    body("paymentMethodId").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { amount, currency, orderIds, paymentMethodId } = req.body;
      const userId = req.userId;

      // Verify orders belong to user
      const orders = await Order.findAll({
        where: {
          id: orderIds,
          userId: userId,
          status: "pending",
        },
      });

      if (orders.length !== orderIds.length) {
        return res.status(400).json({
          error: "Invalid orders",
          message: "Some orders are invalid or already processed",
        });
      }

      // Calculate total from orders (security check)
      const calculatedTotal = orders.reduce(
        (sum, order) => sum + parseFloat(order.total),
        0
      );
      const providedTotal = amount / 100; // Convert from cents

      if (Math.abs(calculatedTotal - providedTotal) > 0.01) {
        logger.warn("Payment amount mismatch", {
          userId,
          calculated: calculatedTotal,
          provided: providedTotal,
        });
        return res.status(400).json({
          error: "Amount mismatch",
          message: "Payment amount does not match order total",
        });
      }

      // Create payment intent
      const paymentIntentData = {
        amount: Math.round(amount), // Ensure integer cents
        currency: currency || "usd",
        metadata: {
          userId: userId,
          orderIds: orderIds.join(","),
          orderCount: orderIds.length,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      };

      // If payment method provided, attach it
      if (paymentMethodId) {
        // Verify payment method belongs to user
        const paymentMethod = await PaymentMethod.findOne({
          where: {
            stripePaymentMethodId: paymentMethodId,
            userId: userId,
          },
        });

        if (!paymentMethod) {
          return res.status(400).json({
            error: "Invalid payment method",
            message: "Payment method not found or does not belong to user",
          });
        }

        paymentIntentData.payment_method = paymentMethodId;
        paymentIntentData.confirmation_method = "manual";
        paymentIntentData.confirm = true;
      }

      const paymentIntent = await stripe.paymentIntents.create(
        paymentIntentData
      );

      // Log payment intent creation
      logger.info("Payment intent created", {
        userId,
        paymentIntentId: paymentIntent.id,
        amount: amount,
        orderCount: orderIds.length,
        status: paymentIntent.status,
        confirmed: paymentIntentData.confirm === true
      });

      // If payment was confirmed immediately (saved payment method), send to Shipday
      if (paymentIntent.status === "succeeded" && paymentIntentData.confirm === true) {
        logger.info("Payment succeeded immediately (saved payment method) - preparing to send orders to Shipday", {
          userId,
          paymentIntentId: paymentIntent.id,
          orderIds: orderIds.join(',')
        });
        
        // Send orders to Shipday (non-blocking)
        try {
          const orders = await Order.findAll({
            where: { id: orderIds },
            include: [
              {
                model: Profile,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                required: false
              },
              {
                model: Restaurant,
                as: 'restaurant',
                attributes: ['id', 'name', 'address', 'phone'],
                required: false
              }
            ]
          });

          logger.info(`Found ${orders.length} order(s) to send to Shipday (saved payment method)`, {
            orderIds: orders.map(o => o.id),
            orderNumbers: orders.map(o => o.orderNumber)
          });

          // Send each order to Shipday
          for (const order of orders) {
            try {
              logger.info("Sending order to Shipday (saved payment method)", {
                orderId: order.id,
                orderNumber: order.orderNumber,
                hasUser: !!order.user,
                hasRestaurant: !!order.restaurant
              });
              
              const shipdayResult = await sendOrderToShipday(order);
              
              if (shipdayResult.success && shipdayResult.shipdayOrderId) {
                await order.update({ shipdayOrderId: shipdayResult.shipdayOrderId });
                logger.info("✅ Order sent to Shipday successfully (saved payment method)", {
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                  shipdayOrderId: shipdayResult.shipdayOrderId
                });
              } else {
                logger.error("❌ Failed to send order to Shipday (saved payment method)", {
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                  error: shipdayResult.error,
                  details: shipdayResult.details,
                  statusCode: shipdayResult.statusCode
                });
              }
            } catch (shipdayError) {
              logger.error("❌ Exception sending order to Shipday (saved payment method)", shipdayError, {
                orderId: order.id,
                orderNumber: order.orderNumber,
                errorMessage: shipdayError.message,
                stack: shipdayError.stack
              });
              // Don't throw - payment succeeded even if Shipday fails
            }
          }
        } catch (error) {
          logger.error("❌ Error processing Shipday integration (saved payment method)", error, {
            orderIds: orderIds.join(','),
            errorMessage: error.message,
            stack: error.stack
          });
          // Don't throw - payment succeeded even if Shipday fails
        }
      }

      res.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      });
    } catch (error) {
      logger.error("Payment intent creation failed:", error, {
        userId: req.userId,
        body: req.body,
      });

      // Handle Stripe-specific errors
      if (error.type === "StripeCardError") {
        return res.status(400).json({
          error: "Card error",
          message: error.message,
        });
      }

      if (error.type === "StripeInvalidRequestError") {
        return res.status(400).json({
          error: "Invalid request",
          message: "Payment request is invalid",
        });
      }

      res.status(500).json({
        error: "Payment processing error",
        message: "Unable to process payment. Please try again.",
      });
    }
  }
);

// Confirm payment intent
router.post(
  "/confirm-intent",
  authenticateToken,
  [body("paymentIntentId").isString().notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { paymentIntentId } = req.body;
      const userId = req.userId;

      // Retrieve payment intent
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId
      );

      // Verify payment intent belongs to user
      if (paymentIntent.metadata.userId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "Payment intent does not belong to user",
        });
      }

      // If payment succeeded, update orders
      // NOTE: Keep status as "pending" - it will change to "confirmed" when admin assigns driver in Shipday (via webhook)
      if (paymentIntent.status === "succeeded") {
        const orderIds = paymentIntent.metadata.orderIds.split(",");

        await Order.update(
          {
            status: "pending", // Keep as pending until driver is assigned in Shipday
            stripePaymentIntentId: paymentIntentId,
            paymentAmount: paymentIntent.amount / 100,
            updatedAt: new Date(),
          },
          {
            where: {
              id: orderIds,
              userId: userId,
            },
          }
        );

        logger.info("Payment confirmed and orders updated", {
          userId,
          paymentIntentId,
          orderIds,
          amount: paymentIntent.amount / 100,
        });

        // Send orders to Shipday (non-blocking)
        // IMPORTANT: Orders are sent to Shipday AFTER payment succeeds
        logger.info("Payment succeeded - preparing to send orders to Shipday", {
          userId,
          paymentIntentId,
          orderIds: orderIds.join(',')
        });
        
        try {
          const orders = await Order.findAll({
            where: { id: orderIds },
            include: [
              {
                model: Profile,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                required: false
              },
              {
                model: Restaurant,
                as: 'restaurant',
                attributes: ['id', 'name', 'address', 'phone'],
                required: false
              }
            ]
          });

          logger.info(`Found ${orders.length} order(s) to send to Shipday`, {
            orderIds: orders.map(o => o.id),
            orderNumbers: orders.map(o => o.orderNumber)
          });

          // Send each order to Shipday
          for (const order of orders) {
            try {
              logger.info("Sending order to Shipday", {
                orderId: order.id,
                orderNumber: order.orderNumber,
                hasUser: !!order.user,
                hasRestaurant: !!order.restaurant
              });
              
              const shipdayResult = await sendOrderToShipday(order);
              
              if (shipdayResult.success && shipdayResult.shipdayOrderId) {
                await order.update({ shipdayOrderId: shipdayResult.shipdayOrderId });
                logger.info("✅ Order sent to Shipday successfully", {
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                  shipdayOrderId: shipdayResult.shipdayOrderId
                });
              } else {
                logger.error("❌ Failed to send order to Shipday", {
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                  error: shipdayResult.error,
                  details: shipdayResult.details,
                  statusCode: shipdayResult.statusCode
                });
              }
            } catch (shipdayError) {
              logger.error("❌ Exception sending order to Shipday", shipdayError, {
                orderId: order.id,
                orderNumber: order.orderNumber,
                errorMessage: shipdayError.message,
                stack: shipdayError.stack
              });
              // Don't throw - order is confirmed even if Shipday fails
            }
          }
        } catch (error) {
          logger.error("❌ Error processing Shipday integration", error, {
            orderIds: orderIds.join(','),
            errorMessage: error.message,
            stack: error.stack
          });
          // Don't throw - order confirmation should succeed even if Shipday fails
        }
      }

      res.json({
        success: true,
        status: paymentIntent.status,
        paymentIntentId: paymentIntentId,
      });
    } catch (error) {
      logger.error("Payment confirmation failed:", error, {
        userId: req.userId,
        paymentIntentId: req.body.paymentIntentId,
      });

      res.status(500).json({
        error: "Payment confirmation error",
        message: "Unable to confirm payment. Please contact support.",
      });
    }
  }
);

// Webhook endpoint for Stripe events
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      logger.error("Webhook signature verification failed:", err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;

        // Update orders - keep status as "pending" until driver is assigned in Shipday (via webhook)
        if (paymentIntent.metadata.orderIds) {
          const orderIds = paymentIntent.metadata.orderIds.split(",");

          await Order.update(
            {
              status: "pending", // Keep as pending until driver is assigned in Shipday
              stripePaymentIntentId: paymentIntent.id,
              paymentAmount: paymentIntent.amount / 100,
              updatedAt: new Date(),
            },
            {
              where: {
                id: orderIds,
                userId: paymentIntent.metadata.userId,
              },
            }
          );

          logger.info("Orders confirmed via webhook", {
            paymentIntentId: paymentIntent.id,
            orderIds,
            userId: paymentIntent.metadata.userId,
          });

          // Send orders to Shipday (non-blocking)
          // IMPORTANT: Orders are sent to Shipday AFTER payment succeeds via webhook
          logger.info("Payment succeeded via webhook - preparing to send orders to Shipday", {
            paymentIntentId: paymentIntent.id,
            orderIds: orderIds.join(','),
            userId: paymentIntent.metadata.userId
          });
          
          try {
            const orders = await Order.findAll({
              where: { id: orderIds },
              include: [
                {
                  model: Profile,
                  as: 'user',
                  attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
                },
                {
                  model: Restaurant,
                  as: 'restaurant',
                  attributes: ['id', 'name', 'address', 'phone']
                }
              ]
            });

            logger.info(`Found ${orders.length} order(s) to send to Shipday via webhook`, {
              orderIds: orders.map(o => o.id),
              orderNumbers: orders.map(o => o.orderNumber)
            });

            // Send each order to Shipday
            for (const order of orders) {
              try {
                logger.info("Sending order to Shipday via webhook", {
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                  hasUser: !!order.user,
                  hasRestaurant: !!order.restaurant
                });
                
                const shipdayResult = await sendOrderToShipday(order);
                
                if (shipdayResult.success && shipdayResult.shipdayOrderId) {
                  await order.update({ shipdayOrderId: shipdayResult.shipdayOrderId });
                  logger.info("✅ Order sent to Shipday successfully via webhook", {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    shipdayOrderId: shipdayResult.shipdayOrderId
                  });
                } else {
                  logger.error("❌ Failed to send order to Shipday via webhook", {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    error: shipdayResult.error,
                    details: shipdayResult.details,
                    statusCode: shipdayResult.statusCode
                  });
                }
              } catch (shipdayError) {
                logger.error("❌ Exception sending order to Shipday via webhook", shipdayError, {
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                  errorMessage: shipdayError.message,
                  stack: shipdayError.stack
                });
                // Don't throw - order is confirmed even if Shipday fails
              }
            }
          } catch (error) {
            logger.error("❌ Error processing Shipday integration via webhook", error, {
              orderIds: orderIds.join(','),
              errorMessage: error.message,
              stack: error.stack
            });
            // Don't throw - order confirmation should succeed even if Shipday fails
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const failedPayment = event.data.object;

        logger.warn("Payment failed", {
          paymentIntentId: failedPayment.id,
          userId: failedPayment.metadata.userId,
          error: failedPayment.last_payment_error,
        });
        break;
      }

      default:
        logger.debug("Unhandled webhook event type:", event.type);
    }

    res.json({ received: true });
  }
);

// Get user payment methods
router.get("/methods", authenticateToken, async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.findAll({
      where: { userId: req.userId },
      order: [
        ["isDefault", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    res.json({
      success: true,
      data: paymentMethods,
    });
  } catch (error) {
    logger.error("Failed to fetch payment methods:", error, {
      userId: req.userId,
    });
    res.status(500).json({
      error: "Failed to fetch payment methods",
      message: "Unable to retrieve payment methods",
    });
  }
});

// Add payment method
router.post(
  "/methods",
  authenticateToken,
  [
    body("paymentMethodId").isString().notEmpty(),
    body("isDefault").optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { paymentMethodId, isDefault = false } = req.body;
      const userId = req.userId;

      // Get user info
      const user = await Profile.findByPk(userId);

      // Retrieve payment method from Stripe
      const stripePaymentMethod = await stripe.paymentMethods.retrieve(
        paymentMethodId
      );

      // Attach to customer if not already attached
      if (!stripePaymentMethod.customer) {
        // Get or create Stripe customer
        let customer;

        if (user.stripeCustomerId) {
          customer = await stripe.customers.retrieve(user.stripeCustomerId);
        } else {
          customer = await stripe.customers.create({
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            metadata: { userId: userId },
          });

          // Save customer ID to user profile
          await user.update({ stripeCustomerId: customer.id });
        }

        // Attach payment method to customer
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customer.id,
        });
      }

      // If setting as default, unset other defaults
      if (isDefault) {
        await PaymentMethod.update(
          { isDefault: false },
          { where: { userId: userId } }
        );
      }

      // Save payment method to database
      const paymentMethod = await PaymentMethod.create({
        userId: userId,
        stripePaymentMethodId: paymentMethodId,
        cardLastFour: stripePaymentMethod.card.last4,
        cardBrand: stripePaymentMethod.card.brand,
        cardExpMonth: stripePaymentMethod.card.exp_month,
        cardExpYear: stripePaymentMethod.card.exp_year,
        cardholderName:
          stripePaymentMethod.billing_details.name ||
          `${user.firstName} ${user.lastName}`,
        isDefault: isDefault,
      });

      logger.info("Payment method added", {
        userId,
        paymentMethodId,
        cardBrand: stripePaymentMethod.card.brand,
        cardLast4: stripePaymentMethod.card.last4,
      });

      res.json({
        success: true,
        data: paymentMethod,
      });
    } catch (error) {
      logger.error("Failed to add payment method:", error, {
        userId: req.userId,
      });

      if (error.type === "StripeInvalidRequestError") {
        return res.status(400).json({
          error: "Invalid payment method",
          message: error.message,
        });
      }

      res.status(500).json({
        error: "Failed to add payment method",
        message: "Unable to save payment method",
      });
    }
  }
);

// Set default payment method
router.patch("/methods/:id/default", authenticateToken, async (req, res) => {
  try {
    const paymentMethodId = req.params.id;
    const userId = req.userId;

    // Find payment method
    const paymentMethod = await PaymentMethod.findOne({
      where: {
        id: paymentMethodId,
        userId: userId,
      },
    });

    if (!paymentMethod) {
      return res.status(404).json({
        error: "Payment method not found",
        message: "Payment method does not exist or does not belong to user",
      });
    }

    // Unset all other defaults for this user
    await PaymentMethod.update(
      { isDefault: false },
      { where: { userId: userId } }
    );

    // Set this one as default
    await paymentMethod.update({ isDefault: true });

    logger.info("Default payment method updated", {
      userId,
      paymentMethodId,
    });

    res.json({
      success: true,
      data: paymentMethod,
      message: "Default payment method updated successfully",
    });
  } catch (error) {
    logger.error("Failed to set default payment method:", error, {
      userId: req.userId,
    });
    res.status(500).json({
      error: "Failed to set default payment method",
      message: "Unable to update default payment method",
    });
  }
});

// Delete payment method
router.delete("/methods/:id", authenticateToken, async (req, res) => {
  try {
    const paymentMethodId = req.params.id;
    const userId = req.userId;

    // Find payment method
    const paymentMethod = await PaymentMethod.findOne({
      where: {
        id: paymentMethodId,
        userId: userId,
      },
    });

    if (!paymentMethod) {
      return res.status(404).json({
        error: "Payment method not found",
        message: "Payment method does not exist or does not belong to user",
      });
    }

    // Detach from Stripe
    try {
      await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);
    } catch (stripeError) {
      logger.warn("Failed to detach payment method from Stripe:", stripeError);
      // Continue with database deletion even if Stripe fails
    }

    // Delete from database
    await paymentMethod.destroy();

    logger.info("Payment method deleted", {
      userId,
      paymentMethodId,
      stripePaymentMethodId: paymentMethod.stripePaymentMethodId,
    });

    res.json({
      success: true,
      message: "Payment method deleted successfully",
    });
  } catch (error) {
    logger.error("Failed to delete payment method:", error, {
      userId: req.userId,
    });
    res.status(500).json({
      error: "Failed to delete payment method",
      message: "Unable to delete payment method",
    });
  }
});

module.exports = router;
