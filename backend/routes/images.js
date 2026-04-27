const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// ---------------------------------------------------------------------------
// Cloudinary vs local-disk strategy
// ---------------------------------------------------------------------------
// When CLOUDINARY_URL (or the three separate env vars) are set we upload to
// Cloudinary so images persist across Heroku dyno restarts/redeploys.
// Otherwise files are written to backend/public/images/ (fine for local dev).
// ---------------------------------------------------------------------------

const CLOUDINARY_URL = process.env.CLOUDINARY_URL;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const USE_CLOUDINARY = !!(CLOUDINARY_URL || (CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET));

let cloudinary;
if (USE_CLOUDINARY) {
  cloudinary = require('cloudinary').v2;
  if (CLOUDINARY_URL) {
    cloudinary.config({ cloudinary_url: CLOUDINARY_URL });
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
  logger.info('Image storage: Cloudinary (persistent CDN)');
} else {
  logger.info('Image storage: local disk (development mode)');
}

// ---------------------------------------------------------------------------
// Allowed types
// ---------------------------------------------------------------------------
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/heic',
  'image/heif',
];

const SVG_TYPES = new Set(['image/svg+xml']);
const HEIC_TYPES = new Set(['image/heic', 'image/heif']);

const imageFileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, SVG, and HEIC images are allowed'), false);
  }
};

// ---------------------------------------------------------------------------
// Multer setup — memory storage when using Cloudinary, disk otherwise
// ---------------------------------------------------------------------------
const createDiskStorageConfig = (subDir) => {
  const uploadsDir = path.resolve(__dirname, '..', 'public', 'images', subDir);
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  });
};

const memoryStorage = multer.memoryStorage();

const multerOptions = (subDir) => ({
  storage: USE_CLOUDINARY ? memoryStorage : createDiskStorageConfig(subDir),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const restaurantLogoUpload = multer(multerOptions('restaurant-logos'));
const menuItemImageUpload = multer(multerOptions('menu-items'));

// ---------------------------------------------------------------------------
// Cloudinary upload helper
// ---------------------------------------------------------------------------
const uploadToCloudinary = (buffer, folder, mimetype) => {
  return new Promise((resolve, reject) => {
    const isSvg = SVG_TYPES.has(mimetype);
    const resourceType = isSvg ? 'raw' : 'image';

    // Apply Cloudinary transformations at upload time for raster images
    const uploadOptions = {
      folder,
      resource_type: resourceType,
      unique_filename: true,
      overwrite: false,
    };

    if (!isSvg) {
      uploadOptions.transformation = [
        { width: 800, height: 600, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' },
      ];
    }

    const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });

    uploadStream.end(buffer);
  });
};

// ---------------------------------------------------------------------------
// Local disk: image optimization helpers (unchanged)
// ---------------------------------------------------------------------------
const optimizeImage = async (inputPath, outputPath, options = {}) => {
  const { width = 800, height = 600, quality = 85, mimetype = 'image/jpeg' } = options;
  const sharpOptions = HEIC_TYPES.has(mimetype) ? {} : { density: 150 };
  await sharp(inputPath, sharpOptions)
    .resize(width, height, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality })
    .toFile(outputPath);
};

const generateImageVariants = async (originalPath, filename, subDir, mimetype = 'image/jpeg') => {
  const baseName = path.parse(filename).name;
  const variantsDir = path.resolve(__dirname, '..', 'public', 'images', subDir, 'variants');
  if (!fs.existsSync(variantsDir)) fs.mkdirSync(variantsDir, { recursive: true });

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

// ---------------------------------------------------------------------------
// Upload routes
// ---------------------------------------------------------------------------

router.post('/restaurant-logo', requireAdmin, restaurantLogoUpload.single('logo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded',
      message: 'Please select an image file to upload',
    });
  }

  try {
    if (USE_CLOUDINARY) {
      const result = await uploadToCloudinary(req.file.buffer, 'mkd/restaurant-logos', req.file.mimetype);
      return res.json({
        success: true,
        data: {
          filename: result.public_id,
          variants: [
            { type: 'thumbnail', path: result.secure_url },
            { type: 'medium', path: result.secure_url },
            { type: 'optimized', path: result.secure_url },
          ],
          originalUrl: result.secure_url,
        },
      });
    }

    // Local disk path
    const { filename, path: originalPath, mimetype } = req.file;
    const subDir = 'restaurant-logos';
    const variants = await generateImageVariants(originalPath, filename, subDir, mimetype);
    fs.unlinkSync(originalPath);
    const baseName = path.parse(filename).name;
    const isSvg = SVG_TYPES.has(mimetype);
    const optimizedUrl = `images/${subDir}/variants/${baseName}_optimized${isSvg ? '.svg' : '.jpg'}`;
    res.json({ success: true, data: { filename, variants, originalUrl: optimizedUrl } });

  } catch (error) {
    logger.error('Error uploading restaurant logo:', error);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Upload failed', message: 'Failed to upload restaurant logo. Please try again.' });
  }
});

router.post('/menu-item', requireAdmin, menuItemImageUpload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded',
      message: 'Please select an image file to upload',
    });
  }

  try {
    if (USE_CLOUDINARY) {
      const result = await uploadToCloudinary(req.file.buffer, 'mkd/menu-items', req.file.mimetype);
      return res.json({
        success: true,
        data: {
          filename: result.public_id,
          variants: [
            { type: 'thumbnail', path: result.secure_url },
            { type: 'medium', path: result.secure_url },
            { type: 'optimized', path: result.secure_url },
          ],
          originalUrl: result.secure_url,
        },
      });
    }

    // Local disk path
    const { filename, path: originalPath, mimetype } = req.file;
    const subDir = 'menu-items';
    const variants = await generateImageVariants(originalPath, filename, subDir, mimetype);
    fs.unlinkSync(originalPath);
    const baseName = path.parse(filename).name;
    const isSvg = SVG_TYPES.has(mimetype);
    const optimizedUrl = `images/${subDir}/variants/${baseName}_optimized${isSvg ? '.svg' : '.jpg'}`;
    res.json({ success: true, data: { filename, variants, originalUrl: optimizedUrl } });

  } catch (error) {
    logger.error('Error uploading menu item image:', error);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Upload failed', message: 'Failed to upload menu item image. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// Info / list / delete routes (local disk only — Cloudinary has its own API)
// ---------------------------------------------------------------------------

router.get('/info/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    const allowedTypes = ['restaurant-logos', 'menu-items'];
    if (!allowedTypes.includes(type)) return res.status(400).json({ error: 'Invalid image type' });

    const baseName = path.parse(filename).name;
    const variantsDir = path.resolve(__dirname, '..', 'public', 'images', type, 'variants');
    const isSvg = fs.existsSync(path.join(variantsDir, `${baseName}_optimized.svg`));
    const ext = isSvg ? '.svg' : '.jpg';

    const variantDefs = {
      thumbnail: `images/${type}/variants/${baseName}_thumb${ext}`,
      medium: `images/${type}/variants/${baseName}_medium${ext}`,
      optimized: `images/${type}/variants/${baseName}_optimized${ext}`,
    };

    const existingVariants = {};
    for (const [variantType, variantPath] of Object.entries(variantDefs)) {
      const fullPath = path.resolve(__dirname, '..', 'public', variantPath);
      if (fs.existsSync(fullPath)) existingVariants[variantType] = variantPath;
    }

    res.json({ success: true, data: { filename, variants: existingVariants } });
  } catch (error) {
    logger.error('Error getting image info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:type/:filename', requireAdmin, async (req, res) => {
  try {
    const { type, filename } = req.params;
    const allowedTypes = ['restaurant-logos', 'menu-items'];
    if (!allowedTypes.includes(type)) return res.status(400).json({ error: 'Invalid image type' });

    const baseName = path.parse(filename).name;
    const variantsDir = path.resolve(__dirname, '..', 'public', 'images', type, 'variants');
    const isSvg = fs.existsSync(path.join(variantsDir, `${baseName}_optimized.svg`));
    const ext = isSvg ? '.svg' : '.jpg';

    let deletedCount = 0;
    for (const variant of ['thumbnail', 'medium', 'optimized']) {
      const variantPath = path.join(variantsDir, `${baseName}_${variant}${ext}`);
      if (fs.existsSync(variantPath)) { fs.unlinkSync(variantPath); deletedCount++; }
    }

    res.json({ success: true, message: `Deleted ${deletedCount} image variants`, data: { deletedCount } });
  } catch (error) {
    logger.error('Error deleting image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/list/:type', requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const allowedTypes = ['restaurant-logos', 'menu-items'];
    if (!allowedTypes.includes(type)) return res.status(400).json({ error: 'Invalid image type' });

    const variantsDir = path.resolve(__dirname, '..', 'public', 'images', type, 'variants');
    if (!fs.existsSync(variantsDir)) return res.json({ success: true, data: [] });

    const files = fs.readdirSync(variantsDir);
    const optimizedImages = files
      .filter(f => f.includes('_optimized.jpg') || f.includes('_optimized.svg'))
      .map(f => {
        const isSvg = f.endsWith('_optimized.svg');
        const ext = isSvg ? '.svg' : '.jpg';
        const baseName = f.replace(`_optimized${ext}`, '');
        return {
          filename: baseName,
          variants: {
            thumbnail: `images/${type}/variants/${baseName}_thumb${ext}`,
            medium: `images/${type}/variants/${baseName}_medium${ext}`,
            optimized: `images/${type}/variants/${baseName}_optimized${ext}`,
          },
        };
      });

    res.json({ success: true, data: optimizedImages });
  } catch (error) {
    logger.error('Error listing images:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Multer error handler
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (req.file?.path && fs.existsSync(req.file.path)) {
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large', message: 'Maximum file size is 15 MB.' });
  }
  if (err.message?.includes('Only')) {
    return res.status(400).json({ error: 'Invalid file type', message: err.message });
  }
  logger.error('Image upload error:', err);
  res.status(500).json({ error: 'Upload failed', message: 'An unexpected error occurred.' });
});

module.exports = router;
