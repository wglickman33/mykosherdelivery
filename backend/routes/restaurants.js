const express = require('express');
const { query, validationResult } = require('express-validator');
const { Op, sequelize } = require('sequelize');
const { Restaurant, MenuItem, UserRestaurantFavorite } = require('../models');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

const listRestaurantsQueryValidation = [
  query('featured').optional().isIn(['true', 'false']),
  query('search').optional().isString().trim().isLength({ max: 200 }),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
];

const buildLogoUrl = (req, logoFileName) => {
  if (!logoFileName) return null;
  const base = `${req.protocol}://${req.get('host')}`;
  return `${base}/static/restaurant-logos/${logoFileName}`;
};

const normalizeMenuItem = (mi) => {
  const item = typeof mi.toJSON === 'function' ? mi.toJSON() : mi;
  let labels = item.labels;
  if (typeof labels === 'string') {
    try { labels = JSON.parse(labels); } catch { labels = []; }
  }
  return {
    ...item,
    price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
    labels,
  };
};

const mapRestaurant = (req, restaurantInstance) => {
  const r = restaurantInstance.toJSON();
  const storedFile = r.logo_url || null;
  const extracted = (!storedFile && r.logoUrl) ? String(r.logoUrl).split('/').pop() : null;
  const logoFile = storedFile || extracted || null;
  const withMenu = Array.isArray(r.menuItems)
    ? { menuItems: r.menuItems.map(normalizeMenuItem) }
    : {};
  const logoUrl = logoFile ? buildLogoUrl(req, logoFile) : (r.logoUrl || null);
  return {
    ...r,
    ...withMenu,
    logoFile,
    logo: logoUrl,
    logoUrl: logoUrl,
  };
};

const RESTAURANT_ID_ALIASES = {
  'five-fifty-pizza': 'five-fifty',
  'stop-chop': 'stop-chop-and-roll'
};

const resolveRestaurantId = (rawId) => {
  if (!rawId) return rawId;
  const lowered = String(rawId).toLowerCase();
  return RESTAURANT_ID_ALIASES[lowered] || lowered;
};

router.get('/', optionalAuth, listRestaurantsQueryValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid query parameters',
        details: errors.array()
      });
    }
    const { featured, search, limit = 50, offset = 0 } = req.query;
    const limitNum = typeof limit === 'number' ? limit : Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const offsetNum = typeof offset === 'number' ? offset : Math.max(parseInt(offset, 10) || 0, 0);

    const whereClause = {};
    if (featured !== undefined) {
      whereClause.featured = featured === 'true';
    }
    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim().substring(0, 200)}%`;
      whereClause.name = { [Op.iLike]: term };
    }

    if (!req.userId || !req.userRole || req.userRole !== 'admin') {
      whereClause.active = true;
    }

    const restaurants = await Restaurant.findAll({
      where: whereClause,
      order: [['featured', 'DESC'], ['name', 'ASC']],
      limit: limitNum,
      offset: offsetNum,
      include: [
        {
          model: MenuItem,
          as: 'menuItems',
          required: false,
          limit: 5
        }
      ]
    });

    let restaurantsWithFavorites = restaurants;
    if (req.userId) {
      const userFavorites = await UserRestaurantFavorite.findAll({
        where: { userId: req.userId },
        attributes: ['restaurantId']
      });
      
      const favoriteIds = userFavorites.map(fav => fav.restaurantId);
      
      restaurantsWithFavorites = restaurants.map(restaurant => ({
        ...mapRestaurant(req, restaurant),
        isFavorite: favoriteIds.includes(restaurant.id)
      }));
    } else {
      restaurantsWithFavorites = restaurants.map(r => mapRestaurant(req, r));
    }

    res.json(restaurantsWithFavorites);
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch restaurants'
    });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const restaurantId = resolveRestaurantId(req.params.id);

    const restaurant = await Restaurant.findByPk(restaurantId, {
      include: [
        {
          model: MenuItem,
          as: 'menuItems',
          where: { available: true },
          required: false,
          order: [['category', 'ASC'], ['name', 'ASC']]
        }
      ]
    });

    if (!restaurant) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }

    let restaurantData = mapRestaurant(req, restaurant);

    if (req.userId) {
      const favorite = await UserRestaurantFavorite.findOne({
        where: { 
          userId: req.userId,
          restaurantId: restaurantId 
        }
      });
      
      restaurantData.isFavorite = !!favorite;
    }

    res.json(restaurantData);
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch restaurant'
    });
  }
});

router.get('/featured/list', optionalAuth, async (req, res) => {
  try {
    const restaurants = await Restaurant.findAll({
      where: { featured: true },
      order: [['name', 'ASC']],
      include: [
        {
          model: MenuItem,
          as: 'menuItems',
          required: false,
          limit: 3
        }
      ]
    });

    let restaurantsWithFavorites = restaurants;
    if (req.userId) {
      const userFavorites = await UserRestaurantFavorite.findAll({
        where: { userId: req.userId },
        attributes: ['restaurantId']
      });
      
      const favoriteIds = userFavorites.map(fav => fav.restaurantId);
      
      restaurantsWithFavorites = restaurants.map(restaurant => ({
        ...mapRestaurant(req, restaurant),
        isFavorite: favoriteIds.includes(restaurant.id)
      }));
    } else {
      restaurantsWithFavorites = restaurants.map(r => mapRestaurant(req, r));
    }

    res.json(restaurantsWithFavorites);
  } catch (error) {
    console.error('Error fetching featured restaurants:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch featured restaurants'
    });
  }
});

router.get('/:id/menu', async (req, res) => {
  try {
    const restaurantId = resolveRestaurantId(req.params.id);
    const { category, available = true, itemType, search } = req.query;

    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }

    const whereClause = { restaurantId };
    
    if (category && category !== 'all') {
      whereClause.category = category;
    }
    
    if (available !== undefined) {
      whereClause.available = available === 'true';
    }
    
    if (itemType && itemType !== 'all') {
      whereClause.itemType = itemType;
    }
    
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const menuItems = await MenuItem.findAll({
      where: whereClause,
      order: [['category', 'ASC'], ['name', 'ASC']],
      include: [
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['id', 'name']
        }
      ]
    });

    const enhancedMenuItems = menuItems.map(item => {
      const normalized = normalizeMenuItem(item);
      
      if (normalized.itemType === 'variety' && normalized.options?.variants) {
        normalized.variants = normalized.options.variants.map(variant => ({
          id: variant.id || `variant-${Math.random().toString(36).substr(2, 9)}`,
          name: variant.name,
          imageUrl: variant.imageUrl,
          priceModifier: variant.priceModifier || 0,
          available: variant.available !== false,
          finalPrice: normalized.price + (variant.priceModifier || 0)
        }));
      }
      
      if (normalized.itemType === 'builder' && normalized.options?.configurations) {
        normalized.configurations = normalized.options.configurations.map(config => ({
          category: config.category,
          required: config.required || false,
          maxSelections: config.maxSelections || 1,
          options: config.options.map(option => ({
            id: option.id || `option-${Math.random().toString(36).substr(2, 9)}`,
            name: option.name,
            priceModifier: option.priceModifier || 0,
            available: option.available !== false
          }))
        }));
      }
      
      return normalized;
    });

    res.json({
      success: true,
      data: enhancedMenuItems,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        typeOfFood: restaurant.typeOfFood
      }
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch menu items'
    });
  }
});

router.get('/:id/menu/categories', async (req, res) => {
  try {
    const restaurantId = resolveRestaurantId(req.params.id);
    
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        error: 'Restaurant not found',
        message: 'Restaurant does not exist'
      });
    }

    const categories = await MenuItem.findAll({
      where: { 
        restaurantId,
        available: true 
      },
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'itemCount']
      ],
      group: ['category'],
      order: [['category', 'ASC']]
    });

    res.json({
      success: true,
      data: categories.map(cat => ({
        name: cat.category,
        itemCount: parseInt(cat.dataValues.itemCount)
      }))
    });
  } catch (error) {
    console.error('Error fetching menu categories:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch menu categories'
    });
  }
});

router.get('/:id/menu/:itemId', async (req, res) => {
  try {
    const restaurantId = resolveRestaurantId(req.params.id);
    const { itemId } = req.params;

    const menuItem = await MenuItem.findOne({
      where: { 
        id: itemId,
        restaurantId,
        available: true 
      },
      include: [
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['id', 'name', 'typeOfFood']
        }
      ]
    });

    if (!menuItem) {
      return res.status(404).json({
        error: 'Menu item not found',
        message: 'Menu item does not exist or is not available'
      });
    }

    const normalized = normalizeMenuItem(menuItem);
    
    if (normalized.itemType === 'variety' && normalized.options?.variants) {
      normalized.variants = normalized.options.variants.map(variant => ({
        id: variant.id || `variant-${Math.random().toString(36).substr(2, 9)}`,
        name: variant.name,
        imageUrl: variant.imageUrl,
        priceModifier: variant.priceModifier || 0,
        available: variant.available !== false,
        finalPrice: normalized.price + (variant.priceModifier || 0)
      }));
    }
    
    if (normalized.itemType === 'builder' && normalized.options?.configurations) {
      normalized.configurations = normalized.options.configurations.map(config => ({
        category: config.category,
        required: config.required || false,
        maxSelections: config.maxSelections || 1,
        options: config.options.map(option => ({
          id: option.id || `option-${Math.random().toString(36).substr(2, 9)}`,
          name: option.name,
          priceModifier: option.priceModifier || 0,
          available: option.available !== false
        }))
      }));
    }

    res.json({
      success: true,
      data: normalized
    });
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch menu item'
    });
  }
});

module.exports = router; 