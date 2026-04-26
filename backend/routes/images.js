const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

const createStorageConfig = (subDir) => {
  const uploadsDir = path.resolve(__dirname, '..', 'public', 'images', subDir);
  
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

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/heic',
  'image/heif',
];

// SVGs are served as-is; HEIC/HEIF need special sharp input handling
const SVG_TYPES = new Set(['image/svg+xml']);
const HEIC_TYPES = new Set(['image/heic', 'image/heif']);

const imageFileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, SVG, and HEIC images are allowed'), false);
  }
};

const restaurantLogoUpload = multer({
  storage: createStorageConfig('restaurant-logos'),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB (HEIC files can be large)
  fileFilter: imageFileFilter
});

const menuItemImageUpload = multer({
  storage: createStorageConfig('menu-items'),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: imageFileFilter
});

const optimizeImage = async (inputPath, outputPath, options = {}) => {
  const {
    width = 800,
    height = 600,
    quality = 85,
    mimetype = 'image/jpeg'
  } = options;

  const sharpOptions = HEIC_TYPES.has(mimetype) ? {} : { density: 150 };

  await sharp(inputPath, sharpOptions)
    .resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality })
    .toFile(outputPath);
};

const generateImageVariants = async (originalPath, filename, subDir, mimetype = 'image/jpeg') => {
  const baseName = path.parse(filename).name;
  const variantsDir = path.resolve(__dirname, '..', 'public', 'images', subDir, 'variants');
  if (!fs.existsSync(variantsDir)) {
    fs.mkdirSync(variantsDir, { recursive: true });
  }

  // SVGs don't need rasterization — serve the original directly as all variants
  if (SVG_TYPES.has(mimetype)) {
    const svgDest = path.join(variantsDir, `${baseName}_optimized.svg`);
    fs.copyFileSync(originalPath, svgDest);
    const svgPath = `images/${subDir}/variants/${baseName}_optimized.svg`;
    return [
      { type: 'thumbnail', path: svgPath },
      { type: 'medium', path: svgPath },
      { type: 'optimized', path: svgPath },
    ];
  }

  const ext = '.jpg';
  const variants = [];

  const thumbnailPath = path.join(variantsDir, `${baseName}_thumb${ext}`);
  await optimizeImage(originalPath, thumbnailPath, { width: 200, height: 200, quality: 80, mimetype });
  variants.push({ type: 'thumbnail', path: `images/${subDir}/variants/${baseName}_thumb${ext}` });

  const mediumPath = path.join(variantsDir, `${baseName}_medium${ext}`);
  await optimizeImage(originalPath, mediumPath, { width: 400, height: 300, quality: 85, mimetype });
  variants.push({ type: 'medium', path: `images/${subDir}/variants/${baseName}_medium${ext}` });

  const optimizedPath = path.join(variantsDir, `${baseName}_optimized${ext}`);
  await optimizeImage(originalPath, optimizedPath, { width: 800, height: 600, quality: 90, mimetype });
  variants.push({ type: 'optimized', path: `images/${subDir}/variants/${baseName}_optimized${ext}` });

  return variants;
};

router.post('/restaurant-logo', requireAdmin, restaurantLogoUpload.single('logo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      error: 'No file uploaded',
      message: 'Please select an image file to upload'
    });
  }

  try {
    const { filename, path: originalPath, mimetype } = req.file;
    const subDir = 'restaurant-logos';

    const variants = await generateImageVariants(originalPath, filename, subDir, mimetype);

    fs.unlinkSync(originalPath);

    const baseName = path.parse(filename).name;
    const isSvg = SVG_TYPES.has(mimetype);
    const optimizedUrl = `images/${subDir}/variants/${baseName}_optimized${isSvg ? '.svg' : '.jpg'}`;

    res.json({
      success: true,
      data: {
        filename,
        variants,
        originalUrl: optimizedUrl
      }
    });

  } catch (error) {
    logger.error('Error uploading restaurant logo:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ 
      error: 'Upload failed',
      message: 'Failed to upload restaurant logo. Please try again.'
    });
  }
});

router.post('/menu-item', requireAdmin, menuItemImageUpload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      error: 'No file uploaded',
      message: 'Please select an image file to upload'
    });
  }

  try {
    const { filename, path: originalPath, mimetype } = req.file;
    const subDir = 'menu-items';

    const variants = await generateImageVariants(originalPath, filename, subDir, mimetype);

    fs.unlinkSync(originalPath);

    const baseName = path.parse(filename).name;
    const isSvg = SVG_TYPES.has(mimetype);
    const optimizedUrl = `images/${subDir}/variants/${baseName}_optimized${isSvg ? '.svg' : '.jpg'}`;

    res.json({
      success: true,
      data: {
        filename,
        variants,
        originalUrl: optimizedUrl
      }
    });

  } catch (error) {
    logger.error('Error uploading menu item image:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ 
      error: 'Upload failed',
      message: 'Failed to upload menu item image. Please try again.'
    });
  }
});

router.get('/info/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    const allowedTypes = ['restaurant-logos', 'menu-items'];
    
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid image type' });
    }

    const baseName = path.parse(filename).name;
    const variantsDir = path.resolve(__dirname, '..', 'public', 'images', type, 'variants');

    // Detect whether this was stored as SVG by checking for the SVG optimized file
    const isSvg = fs.existsSync(path.join(variantsDir, `${baseName}_optimized.svg`));
    const ext = isSvg ? '.svg' : '.jpg';

    const variantDefs = {
      thumbnail: `images/${type}/variants/${baseName}_thumb${ext}`,
      medium: `images/${type}/variants/${baseName}_medium${ext}`,
      optimized: `images/${type}/variants/${baseName}_optimized${ext}`
    };

    const existingVariants = {};
    for (const [variantType, variantPath] of Object.entries(variantDefs)) {
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

router.delete('/:type/:filename', requireAdmin, async (req, res) => {
  try {
    const { type, filename } = req.params;
    const allowedTypes = ['restaurant-logos', 'menu-items'];
    
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid image type' });
    }

    const baseName = path.parse(filename).name;
    const variantsDir = path.resolve(__dirname, '..', 'public', 'images', type, 'variants');

    const isSvg = fs.existsSync(path.join(variantsDir, `${baseName}_optimized.svg`));
    const ext = isSvg ? '.svg' : '.jpg';

    const variantNames = ['thumbnail', 'medium', 'optimized'];
    let deletedCount = 0;
    
    for (const variant of variantNames) {
      const variantPath = path.join(variantsDir, `${baseName}_${variant}${ext}`);
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
      .filter(file => file.includes('_optimized.jpg') || file.includes('_optimized.svg'))
      .map(file => {
        const isSvg = file.endsWith('_optimized.svg');
        const ext = isSvg ? '.svg' : '.jpg';
        const baseName = file.replace(`_optimized${ext}`, '');
        return {
          filename: baseName,
          variants: {
            thumbnail: `images/${type}/variants/${baseName}_thumb${ext}`,
            medium: `images/${type}/variants/${baseName}_medium${ext}`,
            optimized: `images/${type}/variants/${baseName}_optimized${ext}`
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

// Multer errors (file type rejected, file too large) arrive here as err.code
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (req.file && fs.existsSync(req.file.path)) {
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large', message: 'Maximum file size is 15 MB.' });
  }
  if (err.message && err.message.includes('Only')) {
    return res.status(400).json({ error: 'Invalid file type', message: err.message });
  }
  logger.error('Image upload error:', err);
  res.status(500).json({ error: 'Upload failed', message: 'An unexpected error occurred.' });
});

module.exports = router;
