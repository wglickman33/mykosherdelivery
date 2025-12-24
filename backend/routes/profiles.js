const express = require("express");
const bcrypt = require("bcryptjs");
const { Profile, Order, UserRestaurantFavorite } = require("../models");
const { authenticateToken } = require("../middleware/auth");
const { body, validationResult } = require("express-validator");

const router = express.Router();

// Helper function to ensure all addresses have consistent IDs
const ensureAddressIds = (addresses) => {
  return addresses.map((addr, index) => {
    if (addr.id) {
      return addr; // Already has an ID
    }

    // Generate a consistent ID based on address content
    const streetPart = (addr.street || addr.address?.street || "unknown")
      .replace(/\s+/g, "_")
      .toLowerCase();
    const cityPart = (addr.city || addr.address?.city || "city")
      .replace(/\s+/g, "_")
      .toLowerCase();

    return {
      ...addr,
      id: `addr_${index}_${streetPart}_${cityPart}`,
    };
  });
};

// ===== New: Current user profile endpoints (/me) =====

// Get current user's profile
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const profile = await Profile.findByPk(req.userId, {
      attributes: { exclude: ["password"] },
    });

    if (!profile) {
      return res.status(404).json({
        error: "Profile not found",
        message: "User profile does not exist",
      });
    }

    res.json(profile);
  } catch (error) {
    console.error("Error fetching current profile:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch profile",
    });
  }
});

// Update current user's profile
router.put(
  "/me",
  authenticateToken,
  [
    body("firstName").optional().trim(),
    body("lastName").optional().trim(),
    body("phone").optional().trim(),
    body("addresses").optional().isArray(),
    body("primaryAddressIndex").optional().isInt({ min: 0 }),
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

      const updates = { ...req.body };
      delete updates.password;
      delete updates.email;
      delete updates.role;

      updates.updatedAt = new Date();

      const [updatedRows] = await Profile.update(updates, {
        where: { id: req.userId },
        returning: true,
      });

      if (updatedRows === 0) {
        return res.status(404).json({
          error: "Profile not found",
          message: "User profile does not exist",
        });
      }

      const updatedProfile = await Profile.findByPk(req.userId, {
        attributes: { exclude: ["password"] },
      });

      res.json({ success: true, data: updatedProfile });
    } catch (error) {
      console.error("Error updating current profile:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to update profile",
      });
    }
  }
);

// Add new address to current user
router.post(
  "/me/addresses",
  authenticateToken,
  [body("address").optional().isObject()],
  async (req, res) => {
    try {
      const profile = await Profile.findByPk(req.userId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const addresses = Array.isArray(profile.addresses)
        ? [...profile.addresses]
        : [];
      if (addresses.length >= 3) {
        return res.status(400).json({
          error: "Address limit reached",
          message: "You can save up to 3 addresses",
        });
      }

      // Accept either top-level fields or nested under address
      const payload =
        req.body.address && typeof req.body.address === "object"
          ? req.body.address
          : req.body;

      // Ensure an id; if provided, keep it
      const id = payload.id || `addr_${Date.now()}`;

      // Set primary if this is the first address
      const isPrimary = addresses.length === 0;

      const newAddress = {
        id,
        ...payload,
        is_primary: isPrimary,
      };

      // If setting as primary explicitly, clear others
      if (payload.is_primary) {
        addresses.forEach((a) => {
          a.is_primary = false;
        });
        newAddress.is_primary = true;
      }

      addresses.push(newAddress);

      await Profile.update(
        { addresses, updatedAt: new Date() },
        { where: { id: req.userId } }
      );
      const updatedProfile = await Profile.findByPk(req.userId, {
        attributes: { exclude: ["password"] },
      });

      res.status(201).json({ success: true, data: updatedProfile });
    } catch (error) {
      console.error("Error adding address:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to add address",
      });
    }
  }
);

// Update an existing address by id for current user
router.put("/me/addresses/:addressId", authenticateToken, async (req, res) => {
  try {
    const { addressId } = req.params;
    const profile = await Profile.findByPk(req.userId);
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    const addresses = Array.isArray(profile.addresses)
      ? [...profile.addresses]
      : [];
    const idx = addresses.findIndex((a) => a.id === addressId);
    if (idx === -1) return res.status(404).json({ error: "Address not found" });

    const updated = { ...addresses[idx], ...req.body };
    // Maintain only one primary
    if (req.body.is_primary === true) {
      addresses.forEach((a) => {
        a.is_primary = false;
      });
      updated.is_primary = true;
    }

    addresses[idx] = updated;

    await Profile.update(
      { addresses, updatedAt: new Date() },
      { where: { id: req.userId } }
    );
    const updatedProfile = await Profile.findByPk(req.userId, {
      attributes: { exclude: ["password"] },
    });

    res.json({ success: true, data: updatedProfile });
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to update address",
    });
  }
});

// Delete an address by id for current user
router.delete(
  "/me/addresses/:addressId",
  authenticateToken,
  async (req, res) => {
    try {
      const { addressId } = req.params;
      const profile = await Profile.findByPk(req.userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      let addresses = Array.isArray(profile.addresses)
        ? [...profile.addresses]
        : [];
      const idx = addresses.findIndex((a) => a.id === addressId);
      if (idx === -1)
        return res.status(404).json({ error: "Address not found" });

      const wasPrimary = !!addresses[idx].is_primary;
      addresses.splice(idx, 1);

      // If we removed the primary, set first remaining as primary
      if (wasPrimary && addresses.length > 0) {
        addresses = addresses.map((a, i) => ({ ...a, is_primary: i === 0 }));
      }

      await Profile.update(
        { addresses, updatedAt: new Date() },
        { where: { id: req.userId } }
      );
      const updatedProfile = await Profile.findByPk(req.userId, {
        attributes: { exclude: ["password"] },
      });

      res.json({ success: true, data: updatedProfile });
    } catch (error) {
      console.error("Error deleting address:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to delete address",
      });
    }
  }
);

// Set an address as primary for current user
router.patch(
  "/me/addresses/:addressId/primary",
  authenticateToken,
  async (req, res) => {
    try {
      const { addressId } = req.params;
      const profile = await Profile.findByPk(req.userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      let addresses = Array.isArray(profile.addresses)
        ? [...profile.addresses]
        : [];

      // Ensure all addresses have IDs so frontend IDs can be matched/persisted
      const addressesWithIds = ensureAddressIds(addresses);

      // Try exact id match first
      let idx = addressesWithIds.findIndex((a) => a.id === addressId);

      // If not found, try to match by suffix street+city (id pattern: addr_{index}_{street}_{city})
      if (idx === -1) {
        const tokens = String(addressId).split("_");
        const suffix = tokens.length > 3 ? tokens.slice(2).join("_") : null; // drop 'addr' and index
        const slugify = (s) =>
          String(s || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\s_]/g, "")
            .replace(/\s+/g, "_");

        if (suffix) {
          idx = addressesWithIds.findIndex((a) => {
            const street = a.street || a.address?.street;
            const city = a.city || a.address?.city;
            const candidateSuffix = `${slugify(street)}_${slugify(city)}`;
            return candidateSuffix === suffix;
          });
        }
      }

      if (idx === -1)
        return res.status(404).json({ error: "Address not found" });

      // Set only this one as primary
      addressesWithIds.forEach((a, i) => {
        a.is_primary = i === idx;
      });

      await Profile.update(
        { addresses: addressesWithIds, updatedAt: new Date() },
        { where: { id: req.userId } }
      );
      const updatedProfile = await Profile.findByPk(req.userId, {
        attributes: { exclude: ["password"] },
      });

      res.json({ success: true, data: updatedProfile });
    } catch (error) {
      console.error("Error setting primary address:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to set primary address",
      });
    }
  }
);

// ===== Existing routes by id remain below =====

// Get user profile
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;

    // Users can only access their own profile (except admins)
    if (req.user.role !== "admin" && req.userId !== userId) {
      return res.status(403).json({
        error: "Access denied",
        message: "You can only access your own profile",
      });
    }

    const profile = await Profile.findByPk(userId, {
      attributes: { exclude: ["password"] },
    });

    if (!profile) {
      return res.status(404).json({
        error: "Profile not found",
        message: "User profile does not exist",
      });
    }

    res.json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch profile",
    });
  }
});

// Update user profile
router.put(
  "/:id",
  authenticateToken,
  [
    body("firstName").optional().trim(),
    body("lastName").optional().trim(),
    body("phone").optional().trim(),
    body("addresses").optional().isArray(),
    body("primaryAddressIndex").optional().isInt({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const userId = req.params.id;

      // Users can only update their own profile (except admins)
      if (req.user.role !== "admin" && req.userId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only update your own profile",
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const updates = { ...req.body };
      delete updates.password; // Never allow password updates through this route
      delete updates.email; // Never allow email updates
      delete updates.role; // Never allow role updates (except through admin routes)

      updates.updatedAt = new Date();

      const [updatedRows] = await Profile.update(updates, {
        where: { id: userId },
        returning: true,
      });

      if (updatedRows === 0) {
        return res.status(404).json({
          error: "Profile not found",
          message: "User profile does not exist",
        });
      }

      const updatedProfile = await Profile.findByPk(userId, {
        attributes: { exclude: ["password"] },
      });

      res.json({
        success: true,
        data: updatedProfile,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to update profile",
      });
    }
  }
);

// Get user orders
router.get("/:id/orders", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;

    // Users can only access their own orders (except admins)
    if (req.user.role !== "admin" && req.userId !== userId) {
      return res.status(403).json({
        error: "Access denied",
        message: "You can only access your own orders",
      });
    }

    const { status, limit = 50, offset = 0 } = req.query;

    const whereClause = { userId };
    if (status) {
      whereClause.status = status;
    }

    const orders = await Order.findAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Profile,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
    });

    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch orders",
    });
  }
});

// Get user statistics
router.get("/:id/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;

    // Users can only access their own stats (except admins)
    if (req.user.role !== "admin" && req.userId !== userId) {
      return res.status(403).json({
        error: "Access denied",
        message: "You can only access your own statistics",
      });
    }

    // Get order statistics
    const totalOrders = await Order.count({ where: { userId } });

    const totalSpent =
      (await Order.sum("total", {
        where: {
          userId,
          status: ["delivered", "confirmed"], // Only count completed orders
        },
      })) || 0;

    const favoriteRestaurantsCount = await UserRestaurantFavorite.count({
      where: { userId },
    });

    res.json({
      totalOrders,
      totalSpent: parseFloat(totalSpent),
      favoriteRestaurantsCount,
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch user statistics",
    });
  }
});

// Add address to user profile
router.post(
  "/:id/addresses",
  authenticateToken,
  [
    body("street").notEmpty().trim(),
    body("city").notEmpty().trim(),
    body("state").notEmpty().trim(),
    body("zip_code").notEmpty().trim(),
    body("apartment").optional().trim(),
    body("delivery_instructions").optional().trim(),
  ],
  async (req, res) => {
    try {
      const userId = req.params.id;

      // Users can only add to their own profile (except admins)
      if (req.user.role !== "admin" && req.userId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only modify your own profile",
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const user = await Profile.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: "User not found",
          message: "User does not exist",
        });
      }

      const addresses = user.addresses || [];

      // Limit to 3 addresses
      if (addresses.length >= 3) {
        return res.status(400).json({
          error: "Address limit reached",
          message: "You can only save up to 3 addresses",
        });
      }

      // Create new address with unique ID
      const newAddress = {
        id: Date.now().toString(),
        ...req.body,
        is_primary: addresses.length === 0, // First address is primary
        created_at: new Date().toISOString(),
      };

      addresses.push(newAddress);

      await user.update({
        addresses,
        primaryAddressIndex:
          addresses.length === 1 ? 0 : user.primaryAddressIndex,
        updatedAt: new Date(),
      });

      // Return updated user profile
      const updatedUser = await Profile.findByPk(userId, {
        attributes: { exclude: ["password"] },
      });

      res.json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      console.error("Error adding address:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to add address",
      });
    }
  }
);

// Update address
router.put(
  "/:id/addresses/:addressId",
  authenticateToken,
  [
    body("street").optional().trim(),
    body("city").optional().trim(),
    body("state").optional().trim(),
    body("zip_code").optional().trim(),
    body("apartment").optional().trim(),
    body("delivery_instructions").optional().trim(),
  ],
  async (req, res) => {
    try {
      const userId = req.params.id;
      const addressId = req.params.addressId;

      // Users can only update their own profile (except admins)
      if (req.user.role !== "admin" && req.userId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only modify your own profile",
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const user = await Profile.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: "User not found",
          message: "User does not exist",
        });
      }

      const addresses = user.addresses || [];
      const addressIndex = addresses.findIndex((addr) => addr.id === addressId);

      if (addressIndex === -1) {
        return res.status(404).json({
          error: "Address not found",
          message: "Address does not exist",
        });
      }

      // Update the address
      addresses[addressIndex] = {
        ...addresses[addressIndex],
        ...req.body,
        updated_at: new Date().toISOString(),
      };

      await user.update({
        addresses,
        updatedAt: new Date(),
      });

      // Return updated user profile
      const updatedUser = await Profile.findByPk(userId, {
        attributes: { exclude: ["password"] },
      });

      res.json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      console.error("Error updating address:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to update address",
      });
    }
  }
);

// Delete address
router.delete(
  "/:id/addresses/:addressId",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.params.id;
      const addressId = req.params.addressId;

      // Users can only delete from their own profile (except admins)
      if (req.user.role !== "admin" && req.userId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only modify your own profile",
        });
      }

      const user = await Profile.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: "User not found",
          message: "User does not exist",
        });
      }

      const addresses = user.addresses || [];
      const addressIndex = addresses.findIndex((addr) => addr.id === addressId);

      if (addressIndex === -1) {
        return res.status(404).json({
          error: "Address not found",
          message: "Address does not exist",
        });
      }

      // Remove the address
      addresses.splice(addressIndex, 1);

      // Update primary address index if needed
      let newPrimaryIndex = user.primaryAddressIndex;
      if (addressIndex === user.primaryAddressIndex) {
        // If we deleted the primary address, make the first remaining address primary
        newPrimaryIndex = addresses.length > 0 ? 0 : 0;
      } else if (addressIndex < user.primaryAddressIndex) {
        // If we deleted an address before the primary, adjust the index
        newPrimaryIndex = user.primaryAddressIndex - 1;
      }

      // Update is_primary flags
      addresses.forEach((addr, index) => {
        addr.is_primary = index === newPrimaryIndex;
      });

      await user.update({
        addresses,
        primaryAddressIndex: newPrimaryIndex,
        updatedAt: new Date(),
      });

      res.json({
        success: true,
        message: "Address deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting address:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to delete address",
      });
    }
  }
);

// Set primary address
router.patch(
  "/:id/addresses/:addressId/primary",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.params.id;
      const addressId = req.params.addressId;

      // Users can only update their own profile (except admins)
      if (req.user.role !== "admin" && req.userId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only modify your own profile",
        });
      }

      const user = await Profile.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: "User not found",
          message: "User does not exist",
        });
      }

      const addresses = user.addresses || [];
      const addressIndex = addresses.findIndex((addr) => addr.id === addressId);

      if (addressIndex === -1) {
        return res.status(404).json({
          error: "Address not found",
          message: "Address does not exist",
        });
      }

      // Update is_primary flags
      addresses.forEach((addr, index) => {
        addr.is_primary = index === addressIndex;
      });

      await user.update({
        addresses,
        primaryAddressIndex: addressIndex,
        updatedAt: new Date(),
      });

      // Return updated user profile
      const updatedUser = await Profile.findByPk(userId, {
        attributes: { exclude: ["password"] },
      });

      res.json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      console.error("Error setting primary address:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to set primary address",
      });
    }
  }
);

// Update password
router.patch(
  "/:id/password",
  authenticateToken,
  [
    body("currentPassword").notEmpty(),
    body("newPassword").isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const userId = req.params.id;

      // Users can only update their own password (except admins)
      if (req.user.role !== "admin" && req.userId !== userId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only update your own password",
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const user = await Profile.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: "User not found",
          message: "User does not exist",
        });
      }

      // Verify current password (admins can skip this check)
      if (req.user.role !== "admin") {
        const isValidPassword = await bcrypt.compare(
          currentPassword,
          user.password
        );
        if (!isValidPassword) {
          return res.status(401).json({
            error: "Invalid password",
            message: "Current password is incorrect",
          });
        }
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(
        newPassword,
        parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12
      );

      // Update password
      await Profile.update(
        { password: hashedPassword, updatedAt: new Date() },
        { where: { id: userId } }
      );

      res.json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (error) {
      console.error("Error updating password:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to update password",
      });
    }
  }
);

module.exports = router;
