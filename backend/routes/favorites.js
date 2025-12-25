const express = require('express');
const { UserRestaurantFavorite, Restaurant } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const RESTAURANT_ID_ALIASES = {
  'five-fifty-pizza': 'five-fifty',
  'stop-chop': 'stop-chop-and-roll'
};

const resolveRestaurantId = (rawId) => {
  if (!rawId) return rawId;
  const lowered = String(rawId).toLowerCase();
  return RESTAURANT_ID_ALIASES[lowered] || lowered;
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const favorites = await UserRestaurantFavorite.findAll({
      where: { userId: req.userId },
      include: [
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['id', 'name', 'address', 'phone', 'typeOfFood', 'kosherCertification', 'logoUrl', 'featured']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const favoriteRestaurants = favorites.map(fav => ({
      ...fav.restaurant.toJSON(),
      isFavorite: true,
      favoriteId: fav.id,
      favoritedAt: fav.createdAt
    }));

    res.json(favoriteRestaurants);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch favorites'
    });
  }
});

router.post('/:restaurantId', authenticateToken, async (req, res) => {
  try {
    const restaurantId = resolveRestaurantId(req.params.restaurantId);
    const userId = req.userId;

    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }

    const existingFavorite = await UserRestaurantFavorite.findOne({
      where: { userId, restaurantId }
    });

    if (existingFavorite) {
      return res.status(409).json({
        error: 'Already favorited',
        message: 'Restaurant is already in your favorites'
      });
    }

    const favorite = await UserRestaurantFavorite.create({
      userId,
      restaurantId
    });

    res.status(201).json({
      success: true,
      data: favorite,
      message: 'Restaurant added to favorites'
    });

  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to add to favorites'
    });
  }
});

router.delete('/:restaurantId', authenticateToken, async (req, res) => {
  try {
    const restaurantId = resolveRestaurantId(req.params.restaurantId);
    const userId = req.userId;

    const deletedCount = await UserRestaurantFavorite.destroy({
      where: { userId, restaurantId }
    });

    if (deletedCount === 0) {
      return res.status(404).json({
        error: 'Favorite not found',
        message: 'Restaurant is not in your favorites'
      });
    }

    res.json({
      success: true,
      message: 'Restaurant removed from favorites'
    });

  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to remove from favorites'
    });
  }
});

router.post('/:restaurantId/toggle', authenticateToken, async (req, res) => {
  try {
    const restaurantId = resolveRestaurantId(req.params.restaurantId);
    const userId = req.userId;

    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }

    const existingFavorite = await UserRestaurantFavorite.findOne({
      where: { userId, restaurantId }
    });

    if (existingFavorite) {
      await existingFavorite.destroy();
      
      res.json({
        success: true,
        isFavorite: false,
        message: 'Restaurant removed from favorites'
      });
    } else {
      const favorite = await UserRestaurantFavorite.create({
        userId,
        restaurantId
      });

      res.json({
        success: true,
        isFavorite: true,
        data: favorite,
        message: 'Restaurant added to favorites'
      });
    }

  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to toggle favorite'
    });
  }
});

router.get('/ids', authenticateToken, async (req, res) => {
  try {
    const favorites = await UserRestaurantFavorite.findAll({
      where: { userId: req.userId },
      attributes: ['restaurantId']
    });

    const favoriteIds = favorites.map(fav => fav.restaurantId);

    res.json(favoriteIds);
  } catch (error) {
    console.error('Error fetching favorite IDs:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch favorite IDs'
    });
  }
});

module.exports = router; 