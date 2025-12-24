const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Image storage configuration
const createStorageConfig = (subDir) => {
  const uploadsDir = path.resolve(__dirname, '..', 'public', 'images', subDir);
  
  // Ensure directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `${uuidv4()}${ext}`;
      cb(null, filename);
    }
  });
};

// Multer configurations for different image types
const restaurantLogoUpload = multer({
  storage: createStorageConfig('restaurant-logos'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
    }
  }
});

const menuItemImageUpload = multer({
  storage: createStorageConfig('menu-items'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
    }
  }
});

// Image optimization function
const optimizeImage = async (inputPath, outputPath, options = {}) => {
  const {
    width = 800,
    height = 600,
    quality = 85
  } = options;

  await sharp(inputPath)
    .resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality })
    .toFile(outputPath);
};

// Generate optimized versions
const generateImageVariants = async (originalPath, filename, subDir) => {
  const variants = [];
  const baseName = path.parse(filename).name;
  const ext = '.jpg';
  
  const variantsDir = path.resolve(__dirname, '..', 'public', 'images', subDir, 'variants');
  if (!fs.existsSync(variantsDir)) {
    fs.mkdirSync(variantsDir, { recursive: true });
  }

  // Thumbnail (200x200)
  const thumbnailPath = path.join(variantsDir, `${baseName}_thumb${ext}`);
  await optimizeImage(originalPath, thumbnailPath, { width: 200, height: 200, quality: 80 });
  variants.push({ type: 'thumbnail', path: `images/${subDir}/variants/${baseName}_thumb${ext}` });

  // Medium (400x300)
  const mediumPath = path.join(variantsDir, `${baseName}_medium${ext}`);
  await optimizeImage(originalPath, mediumPath, { width: 400, height: 300, quality: 85 });
  variants.push({ type: 'medium', path: `images/${subDir}/variants/${baseName}_medium${ext}` });

  // Original optimized (800x600)
  const optimizedPath = path.join(variantsDir, `${baseName}_optimized${ext}`);
  await optimizeImage(originalPath, optimizedPath, { width: 800, height: 600, quality: 90 });
  variants.push({ type: 'optimized', path: `images/${subDir}/variants/${baseName}_optimized${ext}` });

  return variants;
};

// Upload restaurant logo
router.post('/restaurant-logo', requireAdmin, restaurantLogoUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        message: 'Please select an image file to upload'
      });
    }

    const filename = req.file.filename;
    const originalPath = req.file.path;
    const subDir = 'restaurant-logos';

    // Generate optimized variants
    const variants = await generateImageVariants(originalPath, filename, subDir);

    // Delete original file after optimization
    fs.unlinkSync(originalPath);

    res.json({
      success: true,
      data: {
        filename: filename,
        variants: variants,
        originalUrl: `images/${subDir}/variants/${path.parse(filename).name}_optimized.jpg`
      }
    });

  } catch (error) {
    logger.error('Error uploading restaurant logo:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Upload failed',
      message: 'Failed to upload restaurant logo. Please try again.'
    });
  }
});

// Upload menu item image
router.post('/menu-item', requireAdmin, menuItemImageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        message: 'Please select an image file to upload'
      });
    }

    const filename = req.file.filename;
    const originalPath = req.file.path;
    const subDir = 'menu-items';

    // Generate optimized variants
    const variants = await generateImageVariants(originalPath, filename, subDir);

    // Delete original file after optimization
    fs.unlinkSync(originalPath);

    res.json({
      success: true,
      data: {
        filename: filename,
        variants: variants,
        originalUrl: `images/${subDir}/variants/${path.parse(filename).name}_optimized.jpg`
      }
    });

  } catch (error) {
    logger.error('Error uploading menu item image:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Upload failed',
      message: 'Failed to upload menu item image. Please try again.'
    });
  }
});

// Get image info
router.get('/info/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    const allowedTypes = ['restaurant-logos', 'menu-items'];
    
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid image type' });
    }

    const baseName = path.parse(filename).name;
    
    const variants = {
      thumbnail: `images/${type}/variants/${baseName}_thumb.jpg`,
      medium: `images/${type}/variants/${baseName}_medium.jpg`,
      optimized: `images/${type}/variants/${baseName}_optimized.jpg`
    };

    // Check which variants exist
    const existingVariants = {};
    for (const [variantType, variantPath] of Object.entries(variants)) {
      const fullPath = path.resolve(__dirname, '..', 'public', variantPath);
      if (fs.existsSync(fullPath)) {
        existingVariants[variantType] = variantPath;
      }
    }

    res.json({
      success: true,
      data: {
        filename: filename,
        variants: existingVariants
      }
    });

  } catch (error) {
    logger.error('Error getting image info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete image
router.delete('/:type/:filename', requireAdmin, async (req, res) => {
  try {
    const { type, filename } = req.params;
    const allowedTypes = ['restaurant-logos', 'menu-items'];
    
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid image type' });
    }

    const baseName = path.parse(filename).name;
    const variantsDir = path.resolve(__dirname, '..', 'public', 'images', type, 'variants');
    
    // Delete all variants
    const variants = ['thumbnail', 'medium', 'optimized'];
    let deletedCount = 0;
    
    for (const variant of variants) {
      const variantPath = path.join(variantsDir, `${baseName}_${variant}.jpg`);
      if (fs.existsSync(variantPath)) {
        fs.unlinkSync(variantPath);
        deletedCount++;
      }
    }

    res.json({
      success: true,
      message: `Deleted ${deletedCount} image variants`,
      data: { deletedCount }
    });

  } catch (error) {
    logger.error('Error deleting image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List images by type
router.get('/list/:type', requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const allowedTypes = ['restaurant-logos', 'menu-items'];
    
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid image type' });
    }

    const variantsDir = path.resolve(__dirname, '..', 'public', 'images', type, 'variants');
    
    if (!fs.existsSync(variantsDir)) {
      return res.json({ success: true, data: [] });
    }

    const files = fs.readdirSync(variantsDir);
    const optimizedImages = files
      .filter(file => file.includes('_optimized.jpg'))
      .map(file => {
        const baseName = file.replace('_optimized.jpg', '');
        return {
          filename: baseName,
          variants: {
            thumbnail: `images/${type}/variants/${baseName}_thumb.jpg`,
            medium: `images/${type}/variants/${baseName}_medium.jpg`,
            optimized: `images/${type}/variants/${baseName}_optimized.jpg`
          }
        };
      });

    res.json({
      success: true,
      data: optimizedImages
    });

  } catch (error) {
    logger.error('Error listing images:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
