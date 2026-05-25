const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { restoreDatabaseIfNeeded, persistDatabase, persistDatabaseNow } = require('./lib/db-persist');
const { persistUploadedFile, resolveMediaUrl, streamPrivateMedia, getBlobAccess } = require('./lib/media-storage');
const { evaluateAutoVerification, getMaxVideoBytes, MIN_VIDEO_DURATION_SEC, MAX_VIDEO_DURATION_SEC, MIN_FACE_MATCH_SCORE } = require('./lib/auto-verification');
const { addPostToFeedIndex, getPostsFromFeedIndex, syncPostsToFeedIndex } = require('./lib/category-feed-index');
const { resolveCityQuery, postMatchesCity, listSupportedCities } = require('./lib/supported-cities');
const { validatePhoneRequired, validateServicePrice } = require('./lib/service-pricing');
const {
    validateUserProfileFields,
    userHasCompleteProfile,
    getProfileIncompleteMessage
} = require('./lib/user-profile');
const { listCountries } = require('./lib/supported-cities');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV !== 'production';
const isServerless =
    process.env.VERCEL === '1' ||
    Boolean(process.env.VERCEL_ENV) ||
    __dirname.includes('/var/task');
const isVercel = isServerless;
const publicDir = path.join(__dirname, 'public');
const vercelUploadRoot = path.join(os.tmpdir(), 'deseo_libre_uploads');

// JWT_SECRET debe estar configurado en producción (en Vercel usar variables de entorno del proyecto)
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && isDevelopment) {
    console.warn('⚠️  ADVERTENCIA: JWT_SECRET no configurado, usando valor por defecto (SOLO DESARROLLO)');
    JWT_SECRET = 'deseo_libre_secret_key_2024_dev_only';
    process.env.JWT_SECRET = JWT_SECRET;
} else if (!JWT_SECRET && isVercel) {
    console.warn('⚠️  JWT_SECRET no está en el dashboard de Vercel; usando valor por defecto. Configurá JWT_SECRET en Production.');
    JWT_SECRET = 'deseo_libre_secret_key_2024_dev_only';
    process.env.JWT_SECRET = JWT_SECRET;
} else if (!JWT_SECRET) {
    console.error('❌ ERROR CRÍTICO: JWT_SECRET no está configurado. La aplicación no puede iniciar en producción.');
    process.exit(1);
}

const VALID_CONTENT_CATEGORIES = [
    'acompañantes-mujeres',
    'acompañantes-hombres',
    'masajes',
    'sugar-daddy',
    'sugar-mommy'
];

const LEGACY_CATEGORY_MAP = {
    'acompañantes-mujeres': { category: 'acompañantes-mujeres', audience: null },
    'acompañantes-hombres': { category: 'acompañantes-hombres', audience: null },
    'acompañantes-trans': { category: 'acompañantes-mujeres', audience: null }
};

const CATEGORY_ALIASES = {
    'acompanhantes-hombres': 'acompañantes-hombres',
    'acompanantes-hombres': 'acompañantes-hombres',
    'acompanhantes-mujeres': 'acompañantes-mujeres',
    'acompanantes-mujeres': 'acompañantes-mujeres',
    'acompanhantes-trans': 'acompañantes-trans',
    'acompanantes-trans': 'acompañantes-trans'
};

function normalizeCategorySlug(value) {
    let slug;
    try {
        slug = decodeURIComponent(String(value || '').trim()).normalize('NFC');
    } catch {
        slug = String(value || '').trim();
    }
    return CATEGORY_ALIASES[slug] || slug;
}

function resolveCategoryAndAudience(category, audience) {
    const normalized = normalizeCategorySlug(category);
    if (LEGACY_CATEGORY_MAP[normalized]) {
        return LEGACY_CATEGORY_MAP[normalized];
    }
    if (normalized === 'acompañantes') {
        const aud = (audience || '').trim().toLowerCase();
        if (aud === 'hombres') {
            return { category: 'acompañantes-hombres', audience: null };
        }
        return { category: 'acompañantes-mujeres', audience: null };
    }
    return { category: normalized, audience: null };
}

function isValidCategory(category) {
    const { category: canonical } = resolveCategoryAndAudience(category, null);
    return VALID_CONTENT_CATEGORIES.includes(canonical);
}

function getCategorySearchVariants(canonical) {
    const variants = new Set([canonical]);
    if (canonical === 'acompañantes-mujeres' || canonical === 'acompañantes-hombres') {
        variants.add('acompañantes');
    }
    Object.entries(CATEGORY_ALIASES).forEach(([alias, target]) => {
        if (target === canonical || target.startsWith(canonical)) {
            variants.add(alias);
            variants.add(target);
        }
    });
    return [...variants];
}

function filterPostsForCategory(canonical, rows) {
    const list = rows || [];
    if (canonical === 'acompañantes-mujeres') {
        return list.filter((p) => {
            const cat = normalizeCategorySlug(p.category);
            if (cat === 'acompañantes-mujeres') return true;
            if (cat === 'acompañantes') {
                return !p.audience || p.audience === 'mujeres' || p.audience === 'trans';
            }
            return false;
        });
    }
    if (canonical === 'acompañantes-hombres') {
        return list.filter((p) => {
            const cat = normalizeCategorySlug(p.category);
            if (cat === 'acompañantes-hombres') return true;
            if (cat === 'acompañantes') return p.audience === 'hombres';
            return false;
        });
    }
    return list;
}

/** Por defecto público; solo oculto si el cliente envía explícitamente false */
function parseIsPublic(value) {
    if (value === 'false' || value === false || value === 0 || value === '0') {
        return 0;
    }
    return 1;
}

function getRequestOrigin(req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host') || '';
    return `${proto}://${host}`;
}

function enrichPostsWithMediaUrls(posts, req) {
    const origin = getRequestOrigin(req);
    return (posts || []).map((post) => {
        const media = resolveMediaUrl(post.media_url || post.file_url || '', origin);
        const thumb = resolveMediaUrl(post.thumbnail_url || media, origin);
        return {
            ...post,
            media_url: media,
            file_url: media,
            thumbnail_url: thumb,
            profile_picture: post.profile_picture
                ? resolveMediaUrl(post.profile_picture, origin)
                : post.profile_picture
        };
    });
}

function runDb(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
}

function runDbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

function runDbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row || null);
            }
        });
    });
}

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet para headers de seguridad
app.use(helmet({
    contentSecurityPolicy: false, // Desactivado para permitir contenido dinámico
    crossOriginEmbedderPolicy: false
}));

// Compresión de respuestas
app.use(compression());

// Rate limiting global
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: isDevelopment ? 1000 : 100, // Más permisivo en desarrollo
    message: 'Demasiadas solicitudes desde esta IP, intenta nuevamente en 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiting más estricto para autenticación
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: isDevelopment ? 50 : 25,
    message: 'Demasiados intentos de autenticación, intenta nuevamente en 15 minutos.',
    skipSuccessfulRequests: true,
});

// Rate limiting para subida de archivos
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: isDevelopment ? 100 : 20, // 20 uploads por hora en producción
    message: 'Límite de subida de archivos alcanzado, intenta nuevamente más tarde.',
});

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        if (isDevelopment) {
            // En desarrollo, permitir localhost y sin origin (Postman, etc.)
            if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
                callback(null, true);
            } else {
                callback(null, true); // Permisivo en desarrollo
            }
        } else {
            const allowedOrigins = process.env.ALLOWED_ORIGINS 
                ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
                : null;

            if (!origin) {
                return callback(null, true);
            }

            if (!allowedOrigins) {
                try {
                    const { hostname } = new URL(origin);
                    if (
                        hostname.endsWith('.vercel.app') ||
                        hostname.endsWith('.github.io') ||
                        hostname === 'localhost' ||
                        hostname === '127.0.0.1'
                    ) {
                        return callback(null, true);
                    }
                } catch (_) {
                    return callback(null, true);
                }
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('No permitido por CORS'));
            }
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Servir archivos de Blob privado (imágenes/videos subidos en Vercel)
app.use('/api/media', async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
    }
    const pathname = decodeURIComponent((req.path || '').replace(/^\//, ''));
    if (!pathname) {
        return res.status(400).json({ error: 'Falta ruta del archivo' });
    }
    try {
        await streamPrivateMedia(pathname, res, req.method === 'HEAD');
    } catch (error) {
        console.error('Error al servir media privada:', error);
        res.status(500).json({ error: 'No se pudo cargar el archivo' });
    }
});

// Aplicar rate limiting global a todas las rutas API
app.use('/api/', globalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' })); // Increased limit for large JSON payloads
app.use(express.urlencoded({ limit: '50mb', extended: true })); // For form data

// En Vercel las subidas van a /tmp; servir /uploads desde ahí antes que public/
if (isVercel) {
    app.use('/uploads', express.static(path.join(vercelUploadRoot, 'uploads')));
}
// Servir archivos estáticos de public (CSS, JS, uploads locales)
app.use(express.static(publicDir));

// Configure multer for file uploads (memoria en Vercel = más fiable que disco en /tmp)
const localUploadsDir = path.join(publicDir, 'uploads');
const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (!fs.existsSync(localUploadsDir)) {
            fs.mkdirSync(localUploadsDir, { recursive: true });
        }
        cb(null, localUploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: isServerless ? multer.memoryStorage() : diskStorage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit (para videos)
    },
    fileFilter: function (req, file, cb) {
        // Imágenes: jpeg, jpg, png, gif, webp, bmp
        // Videos: mp4, avi, mov, wmv, flv, mkv, webm, mpeg, mpg
        // Audios: mp3, wav, m4a, aac, ogg, flac, wma
        const allowedTypes = /jpeg|jpg|png|gif|webp|bmp|mp4|avi|mov|wmv|flv|mkv|webm|mpeg|mpg|mp3|wav|m4a|aac|ogg|flac|wma/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = file.mimetype.startsWith('image/') || 
                         file.mimetype.startsWith('video/') || 
                         file.mimetype.startsWith('audio/');
        
        // Logging condicional (solo en desarrollo)
        if (isDevelopment) {
            console.log('📁 Validando archivo:', {
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: (file.size / 1024 / 1024).toFixed(2) + ' MB'
            });
        }
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes, videos y audios.'));
        }
    }
});

// Configure multer for reel uploads
const reelStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = isVercel
            ? path.join(vercelUploadRoot, 'uploads', 'reels')
            : path.join(publicDir, 'uploads', 'reels');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const reelUpload = multer({
    storage: isServerless ? multer.memoryStorage() : reelStorage,
    limits: {
        fileSize: 200 * 1024 * 1024 // 200MB limit específico para reels
    },
    fileFilter: function (req, file, cb) {
        const videoTypes = /mp4|mov|mkv|webm|avi|flv|wmv|m4v/;
        const imageTypes = /jpeg|jpg|png|gif|webp/;
        const extension = path.extname(file.originalname).toLowerCase().replace('.', '');

        if (file.fieldname === 'video') {
            if (videoTypes.test(extension)) {
                return cb(null, true);
            }
            return cb(new Error('Formato de video no soportado para reels'));
        }

        if (file.fieldname === 'thumbnail') {
            if (imageTypes.test(extension)) {
                return cb(null, true);
            }
            return cb(new Error('Formato de miniatura no soportado para reels'));
        }

        return cb(new Error('Campo de archivo no permitido para reels'));
    }
});

const reelFieldsUpload = reelUpload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]);

const handleReelUpload = (req, res, next) => {
    reelFieldsUpload(req, res, (err) => {
        if (err) {
            console.error('❌ Error al subir reel:', err.message || err);
            return res.status(400).json({ error: err.message || 'Error al subir reel' });
        }
        next();
    });
};

const deleteFileIfExists = (relativePath) => {
    if (!relativePath || typeof relativePath !== 'string') {
        return;
    }

    const normalized = relativePath.replace(/^\/+/, '');
    const absolutePath = path.join(__dirname, normalized);

    fs.access(absolutePath, fs.constants.F_OK, (accessErr) => {
        if (accessErr) {
            return;
        }

        fs.unlink(absolutePath, (unlinkErr) => {
            if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                console.error('❌ Error al eliminar archivo:', absolutePath, unlinkErr);
            }
        });
    });
};

// Database setup (en Vercel el FS de despliegue es de solo lectura; tmp del sistema es escribible)
const dbPath = isVercel ? path.join(os.tmpdir(), 'deseo_libre.db') : path.join(__dirname, 'deseo_libre.db');
let db;

let dbDirty = false;

function markDbDirty() {
    dbDirty = true;
}

function saveDatabase() {
    markDbDirty();
    persistDatabaseNow(dbPath, isVercel)
        .then(() => {
            dbDirty = false;
        })
        .catch((error) => {
            console.error('Error al guardar la base de datos en Blob:', error.message);
        });
}

async function saveDatabaseAsync() {
    markDbDirty();
    await persistDatabaseNow(dbPath, isVercel);
    dbDirty = false;
}

function initializeDatabaseSchema(database) {
    return new Promise((resolve) => {
        database.serialize(() => {
    // Users table
    database.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        bio TEXT,
        location TEXT,
        phone TEXT,
        age INTEGER,
        category TEXT,
        profile_picture TEXT,
        cover_photo TEXT,
        age_verified BOOLEAN DEFAULT FALSE,
        age_verification_date DATETIME,
        is_verified BOOLEAN DEFAULT FALSE,
        verification_status TEXT DEFAULT 'pending',
        verification_data TEXT,
        verification_date DATETIME,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Add is_admin column if it doesn't exist (for existing databases)
    database.run(`ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE`, (err) => {
        // Ignore error if column already exists
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding is_admin column:', err);
        }
    });

    // User verification log table
    database.run(`CREATE TABLE IF NOT EXISTS user_verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        verification_type TEXT NOT NULL,
        verification_data TEXT,
        status TEXT DEFAULT 'pending',
        verified_at DATETIME,
        rejection_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Add rejection_reason column if it doesn't exist (for existing databases)
    database.run(`ALTER TABLE user_verifications ADD COLUMN rejection_reason TEXT`, (err) => {
        // Ignore error if column already exists
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding rejection_reason column:', err);
        }
    });

    // User profiles table
    database.run(`CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        display_name TEXT,
        bio TEXT,
        phone_number TEXT,
        location TEXT,
        services TEXT,
        profile_image_url TEXT,
        body_verification_video_url TEXT,
        face_obscured BOOLEAN DEFAULT 0,
        is_public BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Add new verification fields for existing databases
    database.run(`ALTER TABLE user_profiles ADD COLUMN body_verification_video_url TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding body_verification_video_url column:', err);
        }
    });
    database.run(`ALTER TABLE user_profiles ADD COLUMN face_obscured BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding face_obscured column:', err);
        }
    });

    // Content posts table
    database.run(`CREATE TABLE IF NOT EXISTS content_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        content_type TEXT NOT NULL CHECK (content_type IN ('photo', 'video', 'audio')),
        file_url TEXT NOT NULL,
        thumbnail_url TEXT,
        price DECIMAL(10,2),
        is_premium BOOLEAN DEFAULT FALSE,
        is_public BOOLEAN DEFAULT TRUE,
        category TEXT DEFAULT 'general',
        audience TEXT,
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Likes table
    database.run(`CREATE TABLE IF NOT EXISTS post_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (post_id) REFERENCES content_posts (id),
        UNIQUE(user_id, post_id)
    )`);

    // Comments table
    database.run(`CREATE TABLE IF NOT EXISTS post_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        comment TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (post_id) REFERENCES content_posts (id)
    )`);

    // Reels table
    database.run(`CREATE TABLE IF NOT EXISTS reels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        video_url TEXT NOT NULL,
        thumbnail_url TEXT,
        category TEXT NOT NULL,
        is_public BOOLEAN DEFAULT TRUE,
        duration_seconds INTEGER,
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        views_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Reels likes table
    database.run(`CREATE TABLE IF NOT EXISTS reel_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reel_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reel_id) REFERENCES reels (id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(reel_id, user_id)
    )`);

    // Reels comments table
    database.run(`CREATE TABLE IF NOT EXISTS reel_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reel_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        comment TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reel_id) REFERENCES reels (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Reports table
    database.run(`CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER NOT NULL,
        reported_user_id INTEGER,
        reported_post_id INTEGER,
        report_type TEXT NOT NULL CHECK (report_type IN ('inappropriate_content', 'harassment', 'spam', 'fake_profile', 'underage', 'other')),
        description TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
        admin_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reporter_id) REFERENCES users (id),
        FOREIGN KEY (reported_user_id) REFERENCES users (id),
        FOREIGN KEY (reported_post_id) REFERENCES content_posts (id)
    )`);

    // User bans table
    database.run(`CREATE TABLE IF NOT EXISTS user_bans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        banned_by INTEGER,
        banned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        is_permanent BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (banned_by) REFERENCES users (id)
    )`);

    // User follows table (for social network features)
    database.run(`CREATE TABLE IF NOT EXISTS user_follows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        follower_id INTEGER NOT NULL,
        following_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (follower_id) REFERENCES users (id),
        FOREIGN KEY (following_id) REFERENCES users (id),
        UNIQUE(follower_id, following_id)
    )`);

    // Notifications table
    database.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        related_user_id INTEGER,
        related_post_id INTEGER,
        is_read BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Post shares table
    database.run(`CREATE TABLE IF NOT EXISTS post_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (post_id) REFERENCES content_posts (id)
    )`);

    // User interests table (for personalized recommendations)
    database.run(`CREATE TABLE IF NOT EXISTS user_interests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        weight INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(user_id, category)
    )`);

    // Add statistics columns to users table if they don't exist
    database.run(`ALTER TABLE users ADD COLUMN followers_count INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding followers_count:', err);
        }
    });
    
    database.run(`ALTER TABLE users ADD COLUMN following_count INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding following_count:', err);
        }
    });
    
    database.run(`ALTER TABLE users ADD COLUMN posts_count INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding posts_count:', err);
        }
        resolve();
    });
        });
    });
}

async function applyDatabaseMigrations(database) {
    const conn = database || db;
    if (!conn) {
        return;
    }

    const exec = (sql) => new Promise((resolve) => {
        conn.run(sql, (err) => {
            if (err && !String(err.message || '').includes('duplicate column')) {
                console.warn('Migración BD:', err.message);
            }
            resolve();
        });
    });

    await exec('UPDATE content_posts SET is_public = 1 WHERE is_public = 0');
    await exec('ALTER TABLE content_posts ADD COLUMN audience TEXT');
    await exec(
        `UPDATE content_posts SET category = 'acompañantes-mujeres', audience = NULL
         WHERE category = 'acompañantes' AND (audience IN ('mujeres', 'trans') OR audience IS NULL OR audience = '')`
    );
    await exec(
        `UPDATE content_posts SET category = 'acompañantes-hombres', audience = NULL
         WHERE category = 'acompañantes' AND audience = 'hombres'`
    );
    await exec('ALTER TABLE content_posts ADD COLUMN price_unit TEXT');
    await exec('ALTER TABLE users ADD COLUMN country TEXT');
    await exec('ALTER TABLE users ADD COLUMN city TEXT');
    await exec('ALTER TABLE users ADD COLUMN service_price DECIMAL(10,2)');
    await exec('ALTER TABLE users ADD COLUMN service_price_unit TEXT');
}

async function ensureDatabaseSchemaUpToDate() {
    if (!db) {
        return;
    }
    await initializeDatabaseSchema(db);
    await applyDatabaseMigrations(db);
}

const dbReady = (async () => {
    await restoreDatabaseIfNeeded(dbPath, isVercel);
    db = new sqlite3.Database(dbPath);
    await ensureDatabaseSchemaUpToDate();
    if (isVercel && process.env.BLOB_READ_WRITE_TOKEN) {
        console.log('Persistencia de base de datos en Vercel Blob activa');
        try {
            const publicPosts = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT cp.id, cp.title, cp.description, cp.content_type, cp.file_url as media_url,
                            cp.thumbnail_url, cp.price, cp.price_unit, cp.is_premium, cp.is_public, cp.category, cp.audience,
                            cp.likes_count, cp.comments_count, cp.created_at,
                            u.id as user_id, u.username, u.full_name, u.profile_picture, u.is_verified,
                            u.location, u.country, u.city, u.phone, u.service_price, u.service_price_unit
                     FROM content_posts cp
                     JOIN users u ON cp.user_id = u.id
                     WHERE cp.is_public = 1`,
                    [],
                    (err, rows) => (err ? reject(err) : resolve(rows || []))
                );
            });
            const byCategory = {};
            publicPosts.forEach((post) => {
                const cat = normalizeCategorySlug(post.category);
                if (!isValidCategory(cat)) {
                    return;
                }
                if (!byCategory[cat]) {
                    byCategory[cat] = [];
                }
                byCategory[cat].push({ ...post, category: cat });
            });
            for (const [cat, posts] of Object.entries(byCategory)) {
                await syncPostsToFeedIndex(posts, getCategorySearchVariants(cat));
            }
            if (publicPosts.length) {
                console.log(`Índice de feeds actualizado con ${publicPosts.length} publicaciones`);
            }
        } catch (indexErr) {
            console.warn('No se pudo reconstruir índice de feeds:', indexErr.message);
        }
    } else if (isVercel) {
        console.warn('En Vercel sin BLOB_READ_WRITE_TOKEN los usuarios no persisten entre reinicios. Añade un Blob store en el proyecto.');
    }
    return db;
})();

let dbRefreshQueue = Promise.resolve();

async function refreshDatabaseFromBlob() {
    if (!isVercel || !process.env.BLOB_READ_WRITE_TOKEN) {
        return;
    }

    dbRefreshQueue = dbRefreshQueue.then(async () => {
        try {
            if (dbDirty) {
                await persistDatabaseNow(dbPath, isVercel);
                dbDirty = false;
            }
            if (db) {
                await new Promise((resolve, reject) => {
                    db.close((err) => (err ? reject(err) : resolve()));
                });
            }
            await restoreDatabaseIfNeeded(dbPath, isVercel);
            db = new sqlite3.Database(dbPath);
            await ensureDatabaseSchemaUpToDate();
        } catch (error) {
            console.error('Error al refrescar base de datos desde Blob:', error.message);
            if (!db) {
                db = new sqlite3.Database(dbPath);
                await ensureDatabaseSchemaUpToDate();
            }
        }
    });

    await dbRefreshQueue;
}

app.use('/api', async (req, res, next) => {
    try {
        await dbReady;
        next();
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
        res.status(503).json({ error: 'Servicio temporalmente no disponible. Intenta de nuevo.' });
    }
});

// Middleware to check if user is verified (can upload content)
const requireUserVerification = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        db.get('SELECT is_verified FROM users WHERE id = ?', [decoded.userId], (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Error interno del servidor' });
            }
            
            if (!user) {
                return res.status(401).json({ error: 'Usuario no encontrado' });
            }
            
            if (!user.is_verified) {
                return res.status(403).json({ 
                    error: 'Usuario no verificado', 
                    message: 'Debes verificar tu identidad para subir contenido',
                    requiresVerification: true 
                });
            }
            
            req.user = decoded;
            next();
        });
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

// JWT Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        req.user = user;
        next();
    });
};

function getAuthUserId(req) {
    const raw = req.user?.userId ?? req.user?.id;
    const id = Number.parseInt(String(raw), 10);
    return Number.isFinite(id) ? id : null;
}

async function findUserRecordById(userId) {
    return runDbGet(
        `SELECT id, username, email, full_name, bio, location, country, city, phone,
                service_price, service_price_unit, category,
                profile_picture, cover_photo, is_verified, verification_status, age_verified, created_at
         FROM users WHERE id = ?`,
        [userId]
    );
}

function mapUserForClient(user) {
    if (!user) {
        return null;
    }
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        bio: user.bio,
        location: user.location,
        country: user.country,
        city: user.city,
        phone: user.phone,
        service_price: user.service_price,
        service_price_unit: user.service_price_unit,
        category: user.category,
        profile_picture: user.profile_picture,
        cover_photo: user.cover_photo,
        is_verified: user.is_verified,
        age_verified: user.age_verified,
        profile_complete: userHasCompleteProfile(user),
        created_at: user.created_at
    };
}

async function resolveAuthUser(req) {
    const userId = getAuthUserId(req);
    if (!userId) {
        return null;
    }

    let user = await findUserRecordById(userId);
    if (!user && isVercel && process.env.BLOB_READ_WRITE_TOKEN) {
        await refreshDatabaseFromBlob();
        user = await findUserRecordById(userId);
    }

    return user;
}

// Age verification middleware
const requireAgeVerification = (req, res, next) => {
    const userId = req.user.userId;
    
    db.get('SELECT age_verified FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
        
        if (!user || !user.age_verified) {
            return res.status(403).json({ 
                error: 'Debes verificar tu edad para acceder a este contenido',
                requires_age_verification: true 
            });
        }
        
        next();
    });
};

// Check if user is banned
const checkUserBan = (req, res, next) => {
    const userId = req.user.userId;
    
    db.get(
        `SELECT * FROM user_bans 
         WHERE user_id = ? AND (is_permanent = 1 OR expires_at > CURRENT_TIMESTAMP)`,
        [userId],
        (err, ban) => {
            if (err) {
                return res.status(500).json({ error: 'Error interno del servidor' });
            }
            
            if (ban) {
                return res.status(403).json({ 
                    error: 'Tu cuenta ha sido suspendida',
                    ban_reason: ban.reason,
                    expires_at: ban.expires_at,
                    is_permanent: ban.is_permanent
                });
            }
            
            next();
        }
    );
};

// Routes

app.get('/api/health', async (req, res) => {
    try {
        await dbReady;
        res.json({
            ok: true,
            environment: NODE_ENV,
            vercel: isVercel,
            database: dbPath,
            blobPersistence: Boolean(isVercel && process.env.BLOB_READ_WRITE_TOKEN),
            blobAccess: getBlobAccess()
        });
    } catch (error) {
        res.status(503).json({ ok: false, error: error.message });
    }
});

// Register endpoint
app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            full_name,
            country,
            city,
            phone,
            service_price,
            service_price_unit
        } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Usuario, email y contraseña son requeridos' });
        }

        const profileCheck = validateUserProfileFields({
            full_name,
            country,
            city,
            phone,
            service_price,
            service_price_unit
        });
        if (!profileCheck.ok) {
            return res.status(400).json({ error: profileCheck.error });
        }

        if (username.length < 3) {
            return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'El email no es válido' });
        }

        await dbReady;

        const existing = await runDbGet(
            'SELECT id FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        if (existing) {
            return res.status(400).json({ error: 'El usuario o email ya existe' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const insertResult = await runDb(
            `INSERT INTO users (
                username, email, password_hash, full_name, country, city, location,
                phone, service_price, service_price_unit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                username,
                email,
                passwordHash,
                profileCheck.full_name,
                profileCheck.country,
                profileCheck.city,
                profileCheck.location,
                profileCheck.phone,
                profileCheck.service_price,
                profileCheck.service_price_unit
            ]
        );

        await saveDatabaseAsync();

        const newUser = await findUserRecordById(insertResult.lastID);

        const token = jwt.sign(
            { userId: insertResult.lastID, username, email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            token,
            user: mapUserForClient(newUser)
        });
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Login endpoint
app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        await dbReady;
        if (isVercel && process.env.BLOB_READ_WRITE_TOKEN) {
            await refreshDatabaseFromBlob();
        }

        const user = await runDbGet('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username, email: user.email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                age_verified: user.age_verified,
                is_verified: user.is_verified,
                verification_status: user.verification_status
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Age verification endpoint
app.post('/api/auth/verify-age', authenticateToken, (req, res) => {
    const { confirmed } = req.body;
    const userId = req.user.userId;

    if (!confirmed) {
        return res.status(400).json({ error: 'Debe confirmar su mayoría de edad' });
    }

    const currentDate = new Date().toISOString();

    db.run(
        'UPDATE users SET age_verified = TRUE, age_verification_date = ? WHERE id = ?',
        [currentDate, userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error al verificar la edad' });
            }

            // Log the verification
            db.run(
                'INSERT INTO age_verifications (user_id, ip_address, user_agent) VALUES (?, ?, ?)',
                [userId, req.ip, req.get('User-Agent')],
                (err) => {
                    if (err) {
                        console.error('Error logging age verification:', err);
                    }
                }
            );

            res.json({
                message: 'Edad verificada exitosamente',
                age_verified: true,
                verification_date: currentDate
            });
        }
    );
});

// User verification endpoints
// Start verification process
app.post('/api/auth/start-verification', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { verificationType, verificationData } = req.body;

    if (!verificationType || !verificationData) {
        return res.status(400).json({ error: 'Tipo de verificación y datos son requeridos' });
    }

    // Check if user is already verified
    db.get('SELECT is_verified FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        if (user.is_verified) {
            return res.status(400).json({ error: 'Usuario ya está verificado' });
        }

        // Log verification attempt
        db.run(
            'INSERT INTO user_verifications (user_id, verification_type, verification_data, status) VALUES (?, ?, ?, ?)',
            [userId, verificationType, JSON.stringify(verificationData), 'pending'],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Error al iniciar verificación' });
                }

                res.json({
                    message: 'Proceso de verificación iniciado',
                    verificationId: this.lastID,
                    status: 'pending'
                });
            }
        );
    });
});

// Complete verification (simulated API call)
app.post('/api/auth/complete-verification', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { verificationId, verificationCode } = req.body;

    if (!verificationId || !verificationCode) {
        return res.status(400).json({ error: 'ID de verificación y código son requeridos' });
    }

    // Simulate API verification call
    // In a real implementation, you would call an external identity verification API
    const simulateVerification = async () => {
        try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Simulate verification success (in real implementation, check actual API response)
            const isVerified = verificationCode === 'VERIFY123'; // Simple test code
            
            if (isVerified) {
                // Update user verification status
                db.run(
                    'UPDATE users SET is_verified = 1, verification_status = ?, verification_date = CURRENT_TIMESTAMP WHERE id = ?',
                    ['verified', userId],
                    (err) => {
                        if (err) {
                            return res.status(500).json({ error: 'Error al actualizar verificación' });
                        }

                        // Update verification log
                        db.run(
                            'UPDATE user_verifications SET status = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                            ['verified', verificationId, userId],
                            (err) => {
                                if (err) {
                                    console.error('Error updating verification log:', err);
                                }
                            }
                        );

                        res.json({
                            message: 'Verificación completada exitosamente',
                            is_verified: true,
                            verification_date: new Date().toISOString()
                        });
                    }
                );
            } else {
                // Update verification log as failed
                db.run(
                    'UPDATE user_verifications SET status = ? WHERE id = ? AND user_id = ?',
                    ['failed', verificationId, userId],
                    (err) => {
                        if (err) {
                            console.error('Error updating verification log:', err);
                        }
                    }
                );

                res.status(400).json({ 
                    error: 'Verificación fallida', 
                    message: 'El código de verificación no es válido' 
                });
            }
        } catch (error) {
            res.status(500).json({ error: 'Error en el proceso de verificación' });
        }
    };

    simulateVerification();
});

// Get verification status
app.get('/api/auth/verification-status', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    db.get(
        'SELECT is_verified, verification_status, verification_date FROM users WHERE id = ?',
        [userId],
        (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Error interno del servidor' });
            }

            if (!user) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            res.json({
                is_verified: user.is_verified,
                verification_status: user.verification_status,
                verification_date: user.verification_date
            });
        }
    );
});

// Quick verification — solo desarrollo local (deshabilitado en Vercel/producción)
app.post('/api/auth/quick-verify', authenticateToken, (req, res) => {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        return res.status(403).json({
            error: 'Verificación manual requerida',
            message: 'En producción debes completar la verificación de identidad en verificar-identidad.html',
            requiresVerification: true
        });
    }
    const userId = req.user.userId;
    
    db.run(
        'UPDATE users SET is_verified = 1, verification_status = ?, verification_date = CURRENT_TIMESTAMP WHERE id = ?',
        ['verified', userId],
        (err) => {
            if (err) {
                return res.status(500).json({ error: 'Error al verificar usuario' });
            }
            
            res.json({
                message: 'Usuario verificado exitosamente (modo desarrollo)',
                is_verified: true
            });
        }
    );
});

// Get user profile
app.get('/api/user/profile', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    db.get('SELECT id, username, email, age_verified, age_verification_date, created_at FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ user });
    });
});

// Get public profile of any user
app.get('/api/user/public/:userId', (req, res) => {
    const userId = req.params.userId;

    db.get(
        `SELECT id, username, full_name, bio, location, country, city, phone,
                service_price, service_price_unit, category, 
                profile_picture, cover_photo, is_verified, created_at,
                followers_count, following_count, posts_count
         FROM users WHERE id = ?`,
        [userId],
        (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Error interno del servidor' });
            }

            if (!user) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            // No incluir información sensible como email
            res.json({ user });
        }
    );
});

// Get public posts of a specific user
app.get('/api/user/:userId/posts', (req, res) => {
    const userId = req.params.userId;

    const query = `
        SELECT 
            id,
            title,
            description,
            content_type,
            file_url as media_url,
            thumbnail_url,
            price,
            is_premium,
            is_public,
            category,
            likes_count,
            comments_count,
            created_at,
            updated_at
        FROM content_posts
        WHERE user_id = ? AND is_public = 1
        ORDER BY created_at DESC
    `;

    db.all(query, [userId], (err, posts) => {
        if (err) {
            console.error('Error loading user posts:', err);
            return res.status(500).json({ error: 'Error al cargar publicaciones' });
        }

        res.json({
            posts: enrichPostsWithMediaUrls(posts, req)
        });
    });
});

// Verify token endpoint
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    try {
        const user = await resolveAuthUser(req);
        if (!user) {
            return res.status(404).json({
                error: 'Usuario no encontrado',
                message: 'Tu sesión no coincide con la base de datos. Cierra sesión y vuelve a entrar.'
            });
        }

        res.json({
            valid: true,
            user: mapUserForClient(user)
        });
    } catch (error) {
        console.error('Error al verificar token:', error);
        res.status(500).json({ error: 'Error al verificar token' });
    }
});

// Profile Management Endpoints

// Create or update user profile
app.post('/api/profile', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { display_name, bio, phone_number, location, services, profile_image_url,
            body_verification_video_url, face_obscured, is_public } = req.body;

    const faceObscuredValue = face_obscured ? 1 : 0;

    // Check if profile exists
    db.get('SELECT id FROM user_profiles WHERE user_id = ?', [userId], (err, profile) => {
        if (err) {
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        if (profile) {
            // Update existing profile
            db.run(
                `UPDATE user_profiles SET 
                    display_name = ?, bio = ?, phone_number = ?, location = ?, 
                    services = ?, profile_image_url = ?, body_verification_video_url = ?, 
                    face_obscured = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE user_id = ?`,
                [display_name, bio, phone_number, location, services, profile_image_url,
                 body_verification_video_url, faceObscuredValue, is_public, userId],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Error al actualizar perfil' });
                    }
                    res.json({ message: 'Perfil actualizado exitosamente' });
                }
            );
        } else {
            // Create new profile
            db.run(
                `INSERT INTO user_profiles (user_id, display_name, bio, phone_number, location, services, profile_image_url, body_verification_video_url, face_obscured, is_public) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, display_name, bio, phone_number, location, services, profile_image_url,
                 body_verification_video_url, faceObscuredValue, is_public],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Error al crear perfil' });
                    }
                    res.json({ message: 'Perfil creado exitosamente' });
                }
            );
        }
    });
});

// Get user profile
app.get('/api/profile/:userId?', authenticateToken, (req, res) => {
    const targetUserId = req.params.userId || req.user.userId;
    const currentUserId = req.user.userId;

    const query = `
        SELECT up.*, u.username, u.email, u.age_verified, u.created_at as user_created_at
        FROM user_profiles up
        JOIN users u ON up.user_id = u.id
        WHERE up.user_id = ?
    `;

    db.get(query, [targetUserId], (err, profile) => {
        if (err) {
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        if (!profile) {
            return res.status(404).json({ error: 'Perfil no encontrado' });
        }

        // If viewing someone else's profile, only show public info
        if (targetUserId != currentUserId && !profile.is_public) {
            return res.status(403).json({ error: 'Este perfil es privado' });
        }

        res.json({ profile });
    });
});

// Get current user info
app.get('/api/user/me', authenticateToken, async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Sesión inválida' });
        }

        const baseUser = await resolveAuthUser(req);
        if (!baseUser) {
            return res.status(404).json({
                error: 'Usuario no encontrado',
                message: 'Tu sesión no coincide con la base de datos. Cierra sesión y vuelve a entrar.'
            });
        }

        const profile = await runDbGet(
            `SELECT display_name, profile_image_url, phone_number, bio,
                    body_verification_video_url, face_obscured
             FROM user_profiles WHERE user_id = ?`,
            [userId]
        );

        res.json({
            id: baseUser.id,
            username: baseUser.username,
            email: baseUser.email,
            is_verified: baseUser.is_verified,
            age_verified: baseUser.age_verified,
            display_name: profile?.display_name || null,
            profile_image_url: profile?.profile_image_url || null,
            phone_number: profile?.phone_number || null,
            bio: profile?.bio || baseUser.bio || null,
            body_verification_video_url: profile?.body_verification_video_url || null,
            face_obscured: profile?.face_obscured || 0
        });
    } catch (error) {
        console.error('Error en /api/user/me:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Get upload limits and allowed file types
app.get('/api/upload/info', (req, res) => {
    res.json({
        max_file_size: '10MB',
        allowed_types: {
            photo: ['jpeg', 'jpg', 'png', 'gif'],
            video: ['mp4', 'avi', 'mov'],
            audio: ['wav', 'mp3', 'm4a']
        },
        categories: [
            'acompañantes-mujeres', 'acompañantes-hombres', 'masajes', 'sugar-daddy', 'sugar-mommy'
        ]
    });
});

// Update user profile (bio, location, etc)
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await resolveAuthUser(req);
        if (!user) {
            return res.status(404).json({
                error: 'Usuario no encontrado',
                message: 'Tu sesión no coincide con la base de datos. Cierra sesión y vuelve a entrar.'
            });
        }

        const userId = user.id;
        const { full_name, bio, country, city, phone, service_price, service_price_unit, age, category } = req.body;

        if (isDevelopment) {
            console.log('📝 Actualizando perfil para usuario:', userId);
            console.log('📦 Datos recibidos:', {
                full_name, bio, country, city, phone, service_price, service_price_unit, age, category
            });
        }

        const profileCheck = validateUserProfileFields({
            full_name,
            country,
            city,
            phone,
            service_price,
            service_price_unit
        });
        if (!profileCheck.ok) {
            return res.status(400).json({ error: profileCheck.error });
        }

        const ageValue = age && age !== '' ? parseInt(age, 10) : null;
        const categoryValue = category && category !== '' ? category : null;

        const updateResult = await runDb(
            `UPDATE users SET 
                full_name = ?, 
                bio = ?, 
                location = ?,
                country = ?,
                city = ?,
                phone = ?, 
                service_price = ?,
                service_price_unit = ?,
                age = ?,
                category = ?,
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`,
            [
                profileCheck.full_name,
                bio || null,
                profileCheck.location,
                profileCheck.country,
                profileCheck.city,
                profileCheck.phone,
                profileCheck.service_price,
                profileCheck.service_price_unit,
                ageValue,
                categoryValue,
                userId
            ]
        );

        if (!updateResult.changes) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        await saveDatabaseAsync();
        res.json({ message: 'Perfil actualizado exitosamente' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Error al actualizar perfil' });
    }
});

// Upload profile avatar
app.post('/api/user/avatar', authenticateToken, uploadLimiter, upload.single('avatar'), async (req, res) => {
    try {
        const user = await resolveAuthUser(req);
        if (!user) {
            return res.status(404).json({
                error: 'Usuario no encontrado',
                message: 'Tu sesión no coincide con la base de datos. Cierra sesión y vuelve a entrar.'
            });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
        }

        let avatarPath;
        try {
            avatarPath = await persistUploadedFile(req.file, isVercel, localUploadsDir);
        } catch (uploadError) {
            console.error('Error al guardar avatar:', uploadError);
            return res.status(500).json({ error: uploadError.message || 'Error al guardar la imagen' });
        }

        const updateResult = await runDb(
            'UPDATE users SET profile_picture = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [avatarPath, user.id]
        );

        if (!updateResult.changes) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        await saveDatabaseAsync();
        res.json({
            message: 'Avatar actualizado exitosamente',
            avatar_url: avatarPath
        });
    } catch (error) {
        console.error('Error updating avatar:', error);
        res.status(500).json({ error: 'Error al actualizar avatar' });
    }
});

// Upload cover photo
app.post('/api/user/cover', authenticateToken, uploadLimiter, upload.single('cover'), async (req, res) => {
    try {
        const user = await resolveAuthUser(req);
        if (!user) {
            return res.status(404).json({
                error: 'Usuario no encontrado',
                message: 'Tu sesión no coincide con la base de datos. Cierra sesión y vuelve a entrar.'
            });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
        }

        let coverPath;
        try {
            coverPath = await persistUploadedFile(req.file, isVercel, localUploadsDir);
        } catch (uploadError) {
            console.error('Error al guardar portada:', uploadError);
            return res.status(500).json({ error: uploadError.message || 'Error al guardar la imagen' });
        }

        const updateResult = await runDb(
            'UPDATE users SET cover_photo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [coverPath, user.id]
        );

        if (!updateResult.changes) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        await saveDatabaseAsync();
        res.json({
            message: 'Foto de portada actualizada exitosamente',
            cover_url: coverPath
        });
    } catch (error) {
        console.error('Error updating cover:', error);
        res.status(500).json({ error: 'Error al actualizar portada' });
    }
});

// Upload body verification video
app.post('/api/user/body-video', authenticateToken, uploadLimiter, upload.single('body_video'), (req, res) => {
    const userId = req.user.userId;

    if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó ningún video' });
    }

    const allowedTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo'];
    if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'El archivo debe ser un video válido (mp4, avi, mov)' });
    }

    const videoPath = `/uploads/${req.file.filename}`;
    const faceObscured = req.body.face_obscured === 'true' || req.body.face_obscured === true;
    const faceObscuredValue = faceObscured ? 1 : 0;

    db.get('SELECT id FROM user_profiles WHERE user_id = ?', [userId], (err, profile) => {
        if (err) {
            console.error('Error fetching profile for body video:', err);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        const handleResponse = (dbErr) => {
            if (dbErr) {
                console.error('Error saving body verification video:', dbErr);
                return res.status(500).json({ error: 'Error al guardar video de verificación' });
            }

            res.json({
                message: 'Video de verificación guardado exitosamente',
                body_verification_video_url: videoPath,
                face_obscured: faceObscuredValue
            });
        };

        if (profile) {
            db.run(
                `UPDATE user_profiles SET 
                    body_verification_video_url = ?, 
                    face_obscured = ?, 
                    updated_at = CURRENT_TIMESTAMP 
                 WHERE user_id = ?`,
                [videoPath, faceObscuredValue, userId],
                handleResponse
            );
        } else {
            db.run(
                `INSERT INTO user_profiles (user_id, body_verification_video_url, face_obscured) 
                 VALUES (?, ?, ?)`,
                [userId, videoPath, faceObscuredValue],
                handleResponse
            );
        }
    });
});

// Content Management Endpoints

// Create new content post (requires login only)
// Enhanced content upload endpoint
app.post('/api/content', authenticateToken, uploadLimiter, upload.single('file'), async (req, res) => {
    const userId = getAuthUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Sesión inválida' });
    }

    const authorCheck = await resolveAuthUser(req);
    if (!authorCheck) {
        return res.status(404).json({
            error: 'Usuario no encontrado',
            message: 'Tu sesión no coincide con la base de datos. Cierra sesión y vuelve a entrar.'
        });
    }
    if (!authorCheck.is_verified) {
        return res.status(403).json({
            error: 'Verificación requerida',
            message: 'Debes verificar tu identidad antes de publicar anuncios. Solo perfiles verificados aparecen en el directorio.',
            requiresVerification: true,
            verifyUrl: '/verificar-identidad.html',
            verification_status: authorCheck.verification_status || 'pending'
        });
    }

    const { title, description, content_type, is_premium, is_public, category } = req.body;

    if (!userHasCompleteProfile(authorCheck)) {
        return res.status(400).json({
            error: 'Perfil incompleto',
            message: getProfileIncompleteMessage(),
            requiresProfile: true,
            profileUrl: '/profile.html'
        });
    }

    const priceCheck = validateServicePrice(authorCheck.service_price, authorCheck.service_price_unit);
    if (!priceCheck.ok) {
        return res.status(400).json({
            error: 'Tarifa incompleta',
            message: getProfileIncompleteMessage(),
            requiresProfile: true
        });
    }

    // Validation
    if (!title || !description || !content_type) {
        return res.status(400).json({ error: 'Título, descripción y tipo de contenido son requeridos' });
    }

    if (!['photo', 'video', 'audio'].includes(content_type)) {
        return res.status(400).json({ error: 'Tipo de contenido inválido' });
    }

    const { category: normalizedCategory, audience: postAudience } = resolveCategoryAndAudience(
        category,
        req.body.audience
    );

    if (!normalizedCategory) {
        return res.status(400).json({ error: 'La categoría es requerida' });
    }

    if (!VALID_CONTENT_CATEGORIES.includes(normalizedCategory)) {
        return res.status(400).json({ error: 'Categoría inválida' });
    }

    const isPublicValue = 1;

    if (!req.file) {
        return res.status(400).json({ error: 'Archivo es requerido' });
    }

    let fileUrl;
    try {
        fileUrl = await persistUploadedFile(req.file, isVercel, localUploadsDir);
    } catch (uploadError) {
        console.error('Error al guardar archivo:', uploadError);
        const message = uploadError.message || 'Error al guardar el archivo. Intenta de nuevo.';
        return res.status(500).json({ error: message });
    }

    const thumbnailUrl = fileUrl;
    const isPremiumValue = is_premium === 'true' || is_premium === true ? 1 : 0;
    const categoryVariants = getCategorySearchVariants(normalizedCategory);

    try {
        const insertResult = await runDb(
            `INSERT INTO content_posts (user_id, title, description, content_type, file_url, thumbnail_url, price, price_unit, is_premium, is_public, category, audience) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                title,
                description,
                content_type,
                fileUrl,
                thumbnailUrl,
                priceCheck.price,
                priceCheck.price_unit,
                isPremiumValue,
                isPublicValue,
                normalizedCategory,
                postAudience
            ]
        );

        await runDb(
            'UPDATE users SET category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [normalizedCategory, userId]
        );

        const author = await findUserRecordById(userId);

        const postRecord = {
            id: insertResult.lastID,
            user_id: userId,
            title,
            description,
            content_type,
            file_url: fileUrl,
            media_url: fileUrl,
            thumbnail_url: thumbnailUrl,
            price: priceCheck.price,
            price_unit: priceCheck.price_unit,
            service_price: author?.service_price,
            service_price_unit: author?.service_price_unit,
            is_premium: isPremiumValue,
            is_public: isPublicValue,
            category: normalizedCategory,
            audience: postAudience,
            location: author?.location || null,
            country: author?.country || null,
            city: author?.city || null,
            phone: author?.phone || null,
            likes_count: 0,
            comments_count: 0,
            created_at: new Date().toISOString(),
            username: author?.username || 'usuario',
            full_name: author?.full_name || null,
            profile_picture: author?.profile_picture || null,
            is_verified: author?.is_verified || 0
        };

        try {
            await addPostToFeedIndex(postRecord, categoryVariants);
        } catch (indexErr) {
            console.warn('No se pudo indexar publicación en feed:', indexErr.message);
        }
        await saveDatabaseAsync();

        const origin = getRequestOrigin(req);
            res.json({ 
                message: 'Contenido publicado exitosamente',
            post_id: insertResult.lastID,
            file_url: resolveMediaUrl(fileUrl, origin),
            thumbnail_url: resolveMediaUrl(thumbnailUrl, origin),
            category: normalizedCategory,
            audience: postAudience,
            is_public: isPublicValue,
            feed_indexed: Boolean(process.env.BLOB_READ_WRITE_TOKEN)
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Error al crear contenido' });
    }
});

// Delete content post
app.delete('/api/content/:postId', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const postId = req.params.postId;

    if (isDevelopment) {
        console.log('🗑️ Intentando eliminar publicación:', postId, 'por usuario:', userId);
    }

    // Verificar que el post pertenece al usuario
    db.get(
        'SELECT * FROM content_posts WHERE id = ? AND user_id = ?',
        [postId, userId],
        (err, post) => {
            if (err) {
                console.error('❌ Error al verificar publicación:', err);
                return res.status(500).json({ error: 'Error al verificar publicación' });
            }
            
            if (!post) {
                if (isDevelopment) {
                    console.log('❌ Publicación no encontrada o usuario no autorizado');
                }
                return res.status(404).json({ error: 'Publicación no encontrada o no tienes permiso para eliminarla' });
            }

            if (isDevelopment) {
                console.log('📦 Publicación encontrada:', {
                    id: post.id,
                    title: post.title,
                    file_url: post.file_url
                });
            }

            // Eliminar el archivo físico del servidor
            if (post.file_url) {
                const filePath = path.join(__dirname, 'public', post.file_url);
                if (isDevelopment) {
                    console.log('📁 Intentando eliminar archivo:', filePath);
                }
                
                fs.unlink(filePath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.warn('⚠️ No se pudo eliminar el archivo físico:', unlinkErr.message);
                        // Continuar de todos modos, el archivo podría no existir
                    } else if (isDevelopment) {
                        console.log('✅ Archivo físico eliminado correctamente');
                    }
                });
            }

            // Eliminar el post de la base de datos
            db.run('DELETE FROM content_posts WHERE id = ?', [postId], async (deleteErr) => {
                if (deleteErr) {
                    console.error('❌ Error al eliminar publicación de la BD:', deleteErr);
                    return res.status(500).json({ error: 'Error al eliminar publicación' });
                }
                
                if (isDevelopment) {
                    console.log('✅ Publicación eliminada exitosamente de la BD');
                }
                try {
                    await saveDatabaseAsync();
                } catch (persistErr) {
                    console.error('Error al persistir BD tras eliminar:', persistErr);
                }
                res.json({ message: 'Publicación eliminada exitosamente' });
            });
        }
    );
});

// Get user's own content
app.get('/api/user/content', authenticateToken, async (req, res) => {
    try {
        const user = await resolveAuthUser(req);
        if (!user) {
            return res.status(404).json({
                error: 'Usuario no encontrado',
                message: 'Tu sesión no coincide con la base de datos. Cierra sesión y vuelve a entrar.'
            });
        }

        const posts = await runDbAll(
            `SELECT 
                id,
                title,
                description,
                content_type,
                file_url as media_url,
                thumbnail_url,
                price,
                price_unit,
                is_premium,
                is_public,
                category,
                likes_count,
                comments_count,
                created_at,
                updated_at
            FROM content_posts
            WHERE user_id = ?
            ORDER BY created_at DESC`,
            [user.id]
        );

        res.json({
            content: enrichPostsWithMediaUrls(posts, req)
        });
    } catch (err) {
        console.error('Error loading user content:', err.message || err);
        res.status(500).json({ error: 'Error al cargar contenido' });
    }
});

// Get content by category (public endpoint, no auth required)
app.get('/api/cities', (req, res) => {
    const country = String(req.query.country || '').trim().toUpperCase();
    const cities = listSupportedCities(country || null);
    res.json({ cities, countries: listCountries() });
});

app.get('/api/content/category/:category', async (req, res) => {
    const { category } = resolveCategoryAndAudience(req.params.category, null);

    if (!isValidCategory(category)) {
        return res.status(400).json({ error: 'Categoría inválida', posts: [] });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const genero = String(req.query.genero || 'todos').toLowerCase();
    const ciudadRaw = String(req.query.ciudad || '').trim();
    const cityResolved = ciudadRaw ? resolveCityQuery(ciudadRaw) : null;
    if (ciudadRaw && !cityResolved.ok) {
        return res.status(400).json({
            error: cityResolved.error,
            posts: [],
            supported_cities: listSupportedCities()
        });
    }
    const ciudad = cityResolved?.ok ? cityResolved.city.name : '';
    const categoryVariants = getCategorySearchVariants(category);
    const categoryPlaceholders = categoryVariants.map(() => '?').join(', ');

    const filterPosts = (rows) => {
        let list = filterPostsForCategory(category, rows);
        list = list.filter((p) => p.is_verified === 1 || p.is_verified === true);
        if (genero && genero !== 'todos' && category !== 'acompañantes-mujeres' && category !== 'acompañantes-hombres') {
            list = list.filter((p) => {
                if (!p.audience) {
                    return true;
                }
                return p.audience === genero;
            });
        }
        if (ciudad) {
            list = list.filter((p) => postMatchesCity(p, ciudad));
        }
        return list;
    };

    try {
        let posts = [];
        let source = 'blob_index';
        const indexPosts = await getPostsFromFeedIndex(categoryVariants);

        if (!ciudad && indexPosts.length) {
            posts = filterPosts(indexPosts);
            source = 'blob_index';
        } else {
            await refreshDatabaseFromBlob();
            source = 'sqlite';

            let extraWhere = '';
            const queryParams = [...categoryVariants];

            if (genero && genero !== 'todos' && category !== 'acompañantes-mujeres' && category !== 'acompañantes-hombres') {
                extraWhere += ' AND (cp.audience = ? OR cp.audience IS NULL OR cp.audience = "")';
                queryParams.push(genero);
            }

    const query = `
        SELECT 
            cp.id,
            cp.title,
            cp.description,
            cp.content_type,
            cp.file_url as media_url,
            cp.thumbnail_url,
            cp.price,
            cp.price_unit,
            cp.is_premium,
            cp.category,
                    cp.audience,
            cp.likes_count,
            cp.comments_count,
            cp.created_at,
            u.id as user_id,
            u.username,
            u.full_name,
            u.profile_picture,
                    u.is_verified,
                    u.location,
                    u.country,
                    u.city,
                    u.phone,
                    u.service_price,
                    u.service_price_unit,
                    u.bio
        FROM content_posts cp
        JOIN users u ON cp.user_id = u.id
                WHERE cp.is_public = 1 AND u.is_verified = 1 AND cp.category IN (${categoryPlaceholders})${extraWhere}
        ORDER BY cp.created_at DESC
            `;

            posts = filterPosts(await runDbAll(query, queryParams));
            if (posts.length) {
                try {
                    await syncPostsToFeedIndex(posts, categoryVariants);
                } catch (syncErr) {
                    console.warn('No se pudo sincronizar índice de feeds:', syncErr.message);
                }
            }
        }

        const total = posts.length;
        const pagedPosts = posts.slice(offset, offset + limit);

                res.json({
            posts: enrichPostsWithMediaUrls(pagedPosts, req),
                    pagination: {
                        page,
                        limit,
                total,
                pages: Math.ceil(total / limit) || 1
                    },
            category,
            source,
            city: ciudad || null
                });
    } catch (err) {
        console.error('Error loading category content:', err.message || err);
        res.status(500).json({ error: 'Error al cargar contenido' });
            }
});

// Get feed (all public content) - No authentication required, only age verification
app.get('/api/feed', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const query = `
        SELECT cp.*, u.username, up.display_name, up.profile_image_url, up.phone_number
        FROM content_posts cp
        JOIN users u ON cp.user_id = u.id
        LEFT JOIN user_profiles up ON cp.user_id = up.user_id
        WHERE cp.is_public = 1
        ORDER BY cp.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.all(query, [limit, offset], (err, posts) => {
        if (err) {
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        // Get total count
        db.get('SELECT COUNT(*) as total FROM content_posts WHERE is_public = 1', (err, count) => {
            if (err) {
                return res.status(500).json({ error: 'Error interno del servidor' });
            }

            res.json({
                posts,
                pagination: {
                    page,
                    limit,
                    total: count.total,
                    pages: Math.ceil(count.total / limit)
                }
            });
        });
    });
});

// Get feed by category (no authentication required, only age verification)
app.get('/api/feed/:category', async (req, res) => {
    await refreshDatabaseFromBlob();

    const category = normalizeCategorySlug(req.params.category);

    if (!isValidCategory(category)) {
        return res.status(400).json({ error: 'Categoría inválida', posts: [] });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const offset = (page - 1) * limit;
    const categoryVariants = getCategorySearchVariants(category);
    const categoryPlaceholders = categoryVariants.map(() => '?').join(', ');
    
    const query = `
        SELECT cp.*, u.username, up.display_name, up.profile_image_url, up.phone_number
        FROM content_posts cp
        JOIN users u ON cp.user_id = u.id
        LEFT JOIN user_profiles up ON cp.user_id = up.user_id
        WHERE cp.is_public = 1 AND cp.category IN (${categoryPlaceholders})
        ORDER BY cp.created_at DESC
        LIMIT ? OFFSET ?
    `;
    
    db.all(query, [...categoryVariants, limit, offset], (err, posts) => {
        if (err) {
            return res.status(500).json({ error: 'Error al cargar contenido' });
        }
        
        // Count total posts for pagination
        db.get(
            `SELECT COUNT(*) as total FROM content_posts WHERE is_public = 1 AND category IN (${categoryPlaceholders})`,
            categoryVariants,
            (err, count) => {
            if (err) {
                return res.status(500).json({ error: 'Error al contar contenido' });
            }
            
            res.json({
                posts: enrichPostsWithMediaUrls(posts, req),
                pagination: {
                    page,
                    limit,
                    total: count.total,
                    pages: Math.ceil(count.total / limit)
                }
            });
        });
    });
});

// Get user's own content
app.get('/api/content/my', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    const query = `
        SELECT cp.*, u.username, up.display_name, up.profile_image_url
        FROM content_posts cp
        JOIN users u ON cp.user_id = u.id
        LEFT JOIN user_profiles up ON cp.user_id = up.user_id
        WHERE cp.user_id = ?
        ORDER BY cp.created_at DESC
    `;

    db.all(query, [userId], (err, posts) => {
        if (err) {
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
        res.json({ posts });
    });
});

// Like/Unlike post
app.post('/api/content/:postId/like', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const postId = req.params.postId;

    // Check if already liked
    db.get('SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?', [userId, postId], (err, like) => {
        if (err) {
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        if (like) {
            // Unlike
            db.run('DELETE FROM post_likes WHERE user_id = ? AND post_id = ?', [userId, postId], (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al quitar like' });
                }
                res.json({ message: 'Like removido', liked: false });
            });
        } else {
            // Like
            db.run('INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)', [userId, postId], (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al dar like' });
                }
                res.json({ message: 'Like agregado', liked: true });
            });
        }
    });
});

// Add comment to post
app.post('/api/content/:postId/comment', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const postId = req.params.postId;
    const { comment } = req.body;

    if (!comment || comment.trim().length === 0) {
        return res.status(400).json({ error: 'El comentario no puede estar vacío' });
    }

    db.run(
        'INSERT INTO post_comments (user_id, post_id, comment) VALUES (?, ?, ?)',
        [userId, postId, comment.trim()],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error al agregar comentario' });
            }
            res.json({ 
                message: 'Comentario agregado exitosamente',
                comment_id: this.lastID
            });
        }
    );
});

// Get post comments
app.get('/api/content/:postId/comments', authenticateToken, requireAgeVerification, checkUserBan, (req, res) => {
    const postId = req.params.postId;

    const query = `
        SELECT pc.*, u.username, up.display_name, up.profile_image_url
        FROM post_comments pc
        JOIN users u ON pc.user_id = u.id
        LEFT JOIN user_profiles up ON pc.user_id = up.user_id
        WHERE pc.post_id = ?
        ORDER BY pc.created_at ASC
    `;

    db.all(query, [postId], (err, comments) => {
        if (err) {
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
        res.json({ comments });
    });
});

// Reporting System Endpoints

// Submit a report
app.post('/api/reports', authenticateToken, requireAgeVerification, checkUserBan, (req, res) => {
    const reporterId = req.user.userId;
    const { reported_user_id, reported_post_id, report_type, description } = req.body;

    if (!report_type || !description) {
        return res.status(400).json({ error: 'Tipo de reporte y descripción son requeridos' });
    }

    const validReportTypes = ['inappropriate_content', 'harassment', 'spam', 'fake_profile', 'underage', 'other'];
    if (!validReportTypes.includes(report_type)) {
        return res.status(400).json({ error: 'Tipo de reporte inválido' });
    }

    if (!reported_user_id && !reported_post_id) {
        return res.status(400).json({ error: 'Debe reportar un usuario o una publicación' });
    }

    // Check if user already reported this
    const checkQuery = `
        SELECT id FROM reports 
        WHERE reporter_id = ? AND 
        ((reported_user_id = ? AND reported_user_id IS NOT NULL) OR 
         (reported_post_id = ? AND reported_post_id IS NOT NULL))
    `;
    
    db.get(checkQuery, [reporterId, reported_user_id, reported_post_id], (err, existingReport) => {
        if (err) {
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        if (existingReport) {
            return res.status(400).json({ error: 'Ya has reportado este contenido' });
        }

        // Create new report
        db.run(
            `INSERT INTO reports (reporter_id, reported_user_id, reported_post_id, report_type, description) 
             VALUES (?, ?, ?, ?, ?)`,
            [reporterId, reported_user_id, reported_post_id, report_type, description],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Error al crear el reporte' });
                }
                res.json({ 
                    message: 'Reporte enviado exitosamente',
                    report_id: this.lastID
                });
            }
        );
    });
});

// Get user's reports
app.get('/api/reports/my', authenticateToken, requireAgeVerification, checkUserBan, (req, res) => {
    const userId = req.user.userId;

    const query = `
        SELECT r.*, 
               u1.username as reporter_username,
               u2.username as reported_username,
               cp.title as post_title
        FROM reports r
        JOIN users u1 ON r.reporter_id = u1.id
        LEFT JOIN users u2 ON r.reported_user_id = u2.id
        LEFT JOIN content_posts cp ON r.reported_post_id = cp.id
        WHERE r.reporter_id = ?
        ORDER BY r.created_at DESC
    `;

    db.all(query, [userId], (err, reports) => {
        if (err) {
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
        res.json({ reports });
    });
});

// Get policies
app.get('/api/policies', (req, res) => {
    const policies = {
        age_verification: {
            title: "Verificación de Edad",
            content: "Esta plataforma es exclusivamente para mayores de 18 años. Todos los usuarios deben verificar su edad antes de acceder al contenido."
        },
        content_policy: {
            title: "Política de Contenido",
            content: `
                - Todo el contenido debe ser legal y consensuado
                - No se permite contenido que involucre menores de edad
                - El contenido debe respetar la dignidad humana
                - No se permite contenido violento o no consensuado
                - Los usuarios son responsables del contenido que publican
            `
        },
        community_guidelines: {
            title: "Normas de la Comunidad",
            content: `
                - Respeta a todos los usuarios
                - No hagas acoso, intimidación o bullying
                - No compartas información personal de otros sin consentimiento
                - No uses la plataforma para actividades ilegales
                - Mantén un comportamiento profesional y respetuoso
            `
        },
        reporting_system: {
            title: "Sistema de Reportes",
            content: `
                Puedes reportar contenido o usuarios que violen nuestras políticas:
                - Contenido inapropiado
                - Acoso o intimidación
                - Spam o perfiles falsos
                - Usuarios menores de edad
                - Cualquier otra violación de las normas
            `
        },
        privacy_policy: {
            title: "Política de Privacidad",
            content: `
                - Respetamos tu privacidad y protegemos tus datos
                - Solo compartimos información con tu consentimiento explícito
                - Puedes controlar la visibilidad de tu perfil
                - Mantenemos registros de seguridad para proteger la plataforma
            `
        }
    };
    
    res.json({ policies });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Algo salió mal!' });
});

// ==================== IDENTITY VERIFICATION SYSTEM ====================

// Upload verification documents + video corporal → aprobación automática (sin costo)
app.post('/api/verification/upload', authenticateToken, upload.fields([
    { name: 'id_front', maxCount: 1 },
    { name: 'id_back', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'body_video', maxCount: 1 }
]), async (req, res) => {
    try {
        const authUser = await resolveAuthUser(req);
        if (!authUser) {
            return res.status(404).json({
                error: 'Usuario no encontrado',
                message: 'Tu sesión no coincide con la base de datos. Cierra sesión y vuelve a entrar.'
            });
        }
        const userId = authUser.id;

        const { verification_type, additional_info, country, body_video_duration_sec, face_match_score } = req.body;
        const files = req.files || {};

        const existingUser = await runDbGet(
            'SELECT is_verified FROM users WHERE id = ?',
            [userId]
        );
        if (existingUser?.is_verified) {
            return res.status(400).json({ error: 'Tu cuenta ya está verificada' });
        }

        const pending = await runDbGet(
            'SELECT id FROM user_verifications WHERE user_id = ? AND status = "pending"',
            [userId]
        );
        if (pending) {
            return res.status(400).json({
                error: 'Ya tienes una verificación en proceso',
                verification_id: pending.id
            });
        }

        const autoEval = evaluateAutoVerification({
            verification_type,
            country,
            id_front: files.id_front?.[0],
            id_back: files.id_back?.[0],
            selfie: files.selfie?.[0],
            body_video: files.body_video?.[0],
            body_video_duration_sec,
            face_match_score,
            isVercel: isServerless
        });

        if (!autoEval.approved) {
            return res.status(400).json({ error: autoEval.reason || 'Verificación no aprobada' });
        }

        const idFrontUrl = await persistUploadedFile(files.id_front[0], isVercel, localUploadsDir);
        const selfieUrl = await persistUploadedFile(files.selfie[0], isVercel, localUploadsDir);
        const bodyVideoUrl = await persistUploadedFile(files.body_video[0], isVercel, localUploadsDir);
        let idBackUrl = null;
        if (verification_type !== 'passport' && files.id_back?.[0]) {
            idBackUrl = await persistUploadedFile(files.id_back[0], isVercel, localUploadsDir);
        }

        const verificationData = {
            type: verification_type,
            country: country || null,
            id_front_url: idFrontUrl,
            id_back_url: idBackUrl,
            selfie_url: selfieUrl,
            body_video_url: bodyVideoUrl,
            body_video_duration_sec: Number(body_video_duration_sec),
            face_match_score: Number(face_match_score),
            additional_info: additional_info || null,
            submitted_at: new Date().toISOString(),
            auto_verified: true,
            auto_method: autoEval.method,
            auto_checks: autoEval.checks_passed
        };

        const now = new Date().toISOString();

        const insertResult = await runDb(
            `INSERT INTO user_verifications (user_id, verification_type, verification_data, status, verified_at)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, verification_type, JSON.stringify(verificationData), 'approved', now]
        );

        await runDb(
            `UPDATE users SET is_verified = 1, verification_status = ?, verification_date = ? WHERE id = ?`,
            ['verified', now, userId]
        );

        const profileRow = await runDbGet('SELECT id FROM user_profiles WHERE user_id = ?', [userId]);
        if (profileRow) {
            await runDb(
                `UPDATE user_profiles SET body_verification_video_url = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
                [bodyVideoUrl, userId]
            );
        } else {
            await runDb(
                `INSERT INTO user_profiles (user_id, body_verification_video_url, is_public) VALUES (?, ?, 1)`,
                [userId, bodyVideoUrl]
            );
        }

        await saveDatabaseAsync();

        res.json({
            message: 'Verificación completada automáticamente. Ya puedes publicar en el directorio.',
            verification_id: insertResult.lastID,
            status: 'approved',
            is_verified: true,
            auto_verified: true
        });
    } catch (error) {
        console.error('Verification upload error:', error);
        res.status(500).json({ error: error.message || 'Error al procesar la verificación' });
    }
});

// Límites públicos para el formulario de verificación
app.get('/api/verification/limits', (req, res) => {
    res.json({
        min_video_duration_sec: MIN_VIDEO_DURATION_SEC,
        max_video_duration_sec: MAX_VIDEO_DURATION_SEC,
        max_video_bytes: getMaxVideoBytes(isServerless),
        min_face_match_score: MIN_FACE_MATCH_SCORE,
        face_match_required: true,
        auto_verification: true,
        body_video_required: true
    });
});

// Get verification status (incluye is_verified del usuario)
app.get('/api/verification/status', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    db.get(
        'SELECT is_verified, verification_status, verification_date FROM users WHERE id = ?',
        [userId],
        (userErr, userRow) => {
            if (userErr) {
                return res.status(500).json({ error: 'Error interno del servidor' });
            }
            if (!userRow) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            const query = `
        SELECT id, verification_type, verification_data, status,
               created_at, verified_at, rejection_reason
        FROM user_verifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 1
    `;

            db.get(query, [userId], (err, verification) => {
                if (err) {
                    return res.status(500).json({ error: 'Error interno del servidor' });
                }

                const base = {
                    is_verified: Boolean(userRow.is_verified),
                    verification_status: userRow.verification_status,
                    verification_date: userRow.verification_date,
                    pending: verification?.status === 'pending',
                    mandatory: true
                };

                if (!verification) {
                    return res.json({
                        ...base,
                        status: 'not_submitted',
                        message: 'No has enviado documentos de verificación'
                    });
                }

                const verificationData = verification.verification_data
                    ? JSON.parse(verification.verification_data)
                    : {};

                res.json({
                    ...base,
                    verification_id: verification.id,
                    verification_type: verification.verification_type,
                    status: verification.status,
                    submitted_at: verification.created_at,
                    verified_at: verification.verified_at,
                    rejection_reason: verification.rejection_reason,
                    country: verificationData.country || null,
                    documents: {
                        id_front_url: verificationData.id_front_url,
                        id_back_url: verificationData.id_back_url,
                        selfie_url: verificationData.selfie_url
                    },
                    additional_info: verificationData.additional_info
                });
            });
        }
    );
});

// Get verification requirements
app.get('/api/verification/requirements', (req, res) => {
    const requirements = {
        id_card: {
            name: 'Cédula de Identidad',
            description: 'Documento oficial de identificación',
            required_documents: [
                {
                    name: 'Frente de la cédula',
                    field: 'id_front',
                    description: 'Foto clara del frente de tu cédula',
                    max_size: '5MB',
                    accepted_formats: ['jpg', 'jpeg', 'png']
                },
                {
                    name: 'Reverso de la cédula',
                    field: 'id_back',
                    description: 'Foto clara del reverso de tu cédula',
                    max_size: '5MB',
                    accepted_formats: ['jpg', 'jpeg', 'png']
                },
                {
                    name: 'Selfie con cédula',
                    field: 'selfie',
                    description: 'Foto tuya sosteniendo la cédula junto a tu cara',
                    max_size: '5MB',
                    accepted_formats: ['jpg', 'jpeg', 'png']
                }
            ],
            tips: [
                'Asegúrate de que todas las fotos estén bien iluminadas',
                'El texto debe ser legible en todas las imágenes',
                'Tu cara debe ser claramente visible en el selfie',
                'No uses filtros o efectos en las fotos'
            ]
        },
        passport: {
            name: 'Pasaporte',
            description: 'Pasaporte válido y vigente',
            required_documents: [
                {
                    name: 'Página principal del pasaporte',
                    field: 'id_front',
                    description: 'Foto de la página principal con tu foto y datos',
                    max_size: '5MB',
                    accepted_formats: ['jpg', 'jpeg', 'png']
                },
                {
                    name: 'Selfie con pasaporte',
                    field: 'selfie',
                    description: 'Foto tuya sosteniendo el pasaporte junto a tu cara',
                    max_size: '5MB',
                    accepted_formats: ['jpg', 'jpeg', 'png']
                }
            ],
            tips: [
                'El pasaporte debe estar vigente',
                'La foto debe mostrar claramente tu rostro',
                'Todos los datos deben ser legibles',
                'No uses flash que pueda crear reflejos'
            ]
        },
        driver_license: {
            name: 'Licencia de Conducir',
            description: 'Licencia de conducir válida',
            required_documents: [
                {
                    name: 'Frente de la licencia',
                    field: 'id_front',
                    description: 'Foto clara del frente de tu licencia',
                    max_size: '5MB',
                    accepted_formats: ['jpg', 'jpeg', 'png']
                },
                {
                    name: 'Reverso de la licencia',
                    field: 'id_back',
                    description: 'Foto clara del reverso de tu licencia',
                    max_size: '5MB',
                    accepted_formats: ['jpg', 'jpeg', 'png']
                },
                {
                    name: 'Selfie con licencia',
                    field: 'selfie',
                    description: 'Foto tuya sosteniendo la licencia junto a tu cara',
                    max_size: '5MB',
                    accepted_formats: ['jpg', 'jpeg', 'png']
                }
            ],
            tips: [
                'La licencia debe estar vigente',
                'Todas las fotos deben estar bien enfocadas',
                'Tu rostro debe ser claramente visible',
                'Evita sombras que oculten información'
            ]
        }
    };
    
    res.json(requirements);
});

// Admin: Get all verifications (with optional status filter)
app.get('/api/admin/verifications/pending', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const status = req.query.status || 'pending'; // Default to pending for backward compatibility
    
    // Check if user is admin
    db.get('SELECT is_admin FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
        
        if (!user || !user.is_admin) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        let query = `
            SELECT uv.*, u.username, u.email, u.created_at as user_created_at
            FROM user_verifications uv
            JOIN users u ON uv.user_id = u.id
        `;
        
        const params = [];
        if (status !== 'all') {
            query += ` WHERE uv.status = ?`;
            params.push(status);
        }
        
        query += ` ORDER BY uv.created_at DESC`;
        
        db.all(query, params, (err, verifications) => {
            if (err) {
                return res.status(500).json({ error: 'Error interno del servidor' });
            }
            
            const formattedVerifications = verifications.map(verification => {
                const verificationData = verification.verification_data ? 
                    JSON.parse(verification.verification_data) : {};
                
                // Get rejection reason if exists
                let rejection_reason = null;
                if (verification.status === 'rejected') {
                    // Try to get rejection reason from user_verifications table
                    rejection_reason = verification.rejection_reason || null;
                }
                
                return {
                    id: verification.id,
                    user_id: verification.user_id,
                    username: verification.username,
                    email: verification.email,
                    user_created_at: verification.user_created_at,
                    verification_type: verification.verification_type,
                    verification_data: verificationData,
                    status: verification.status,
                    rejection_reason: rejection_reason,
                    created_at: verification.created_at,
                    verified_at: verification.verified_at
                };
            });
            
            res.json({ verifications: formattedVerifications });
        });
    });
});

// Admin: Approve verification
app.post('/api/admin/verifications/:id/approve', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const verificationId = req.params.id;
    
    // Check if user is admin
    db.get('SELECT is_admin FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
        
        if (!user || !user.is_admin) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        // Update verification status
        db.run(
            'UPDATE user_verifications SET status = ?, verified_at = ? WHERE id = ?',
            ['approved', new Date().toISOString(), verificationId],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Error al aprobar la verificación' });
                }
                
                // Get user_id from verification
                db.get('SELECT user_id FROM user_verifications WHERE id = ?', [verificationId], (err, verification) => {
                    if (err) {
                        return res.status(500).json({ error: 'Error interno del servidor' });
                    }
                    
                    // Update user verification status
                    db.run(
                        'UPDATE users SET is_verified = ?, verification_status = ? WHERE id = ?',
                        [1, 'verified', verification.user_id],
                        function(err) {
                            if (err) {
                                return res.status(500).json({ error: 'Error al actualizar el usuario' });
                            }
                            
                            res.json({ 
                                message: 'Verificación aprobada exitosamente',
                                verification_id: verificationId,
                                user_id: verification.user_id
                            });
                        }
                    );
                });
            }
        );
    });
});

// Admin: Reject verification
app.post('/api/admin/verifications/:id/reject', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const verificationId = req.params.id;
    const { reason } = req.body;
    
    if (!reason) {
        return res.status(400).json({ error: 'Razón de rechazo requerida' });
    }
    
    // Check if user is admin
    db.get('SELECT is_admin FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
        
        if (!user || !user.is_admin) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        // Update verification status
        db.run(
            'UPDATE user_verifications SET status = ?, rejection_reason = ? WHERE id = ?',
            ['rejected', reason, verificationId],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Error al rechazar la verificación' });
                }
                
                res.json({ 
                    message: 'Verificación rechazada',
                    verification_id: verificationId,
                    reason: reason
                });
            }
        );
    });
});

// Get verification statistics
app.get('/api/admin/verifications/stats', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    
    // Check if user is admin
    db.get('SELECT is_admin FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
        
        if (!user || !user.is_admin) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        const query = `
            SELECT 
                status,
                COUNT(*) as count
            FROM user_verifications 
            GROUP BY status
        `;
        
        db.all(query, [], (err, stats) => {
            if (err) {
                return res.status(500).json({ error: 'Error interno del servidor' });
            }
            
            const formattedStats = {
                pending: 0,
                approved: 0,
                rejected: 0,
                total: 0
            };
            
            stats.forEach(stat => {
                formattedStats[stat.status] = stat.count;
                formattedStats.total += stat.count;
            });
            
            res.json(formattedStats);
        });
    });
});

// ============================================
// SOCIAL NETWORK ENDPOINTS
// ============================================

// Helper function to create notification
function createNotification(userId, type, content, relatedUserId = null, relatedPostId = null) {
    db.run(
        'INSERT INTO notifications (user_id, type, content, related_user_id, related_post_id) VALUES (?, ?, ?, ?, ?)',
        [userId, type, content, relatedUserId, relatedPostId],
        (err) => {
            if (err) console.error('Error creating notification:', err);
        }
    );
}

// Helper function to update user interests
function updateUserInterest(userId, category) {
    db.run(
        `INSERT INTO user_interests (user_id, category, weight) 
         VALUES (?, ?, 1) 
         ON CONFLICT(user_id, category) 
         DO UPDATE SET weight = weight + 1, updated_at = CURRENT_TIMESTAMP`,
        [userId, category],
        (err) => {
            if (err) console.error('Error updating user interest:', err);
        }
    );
}

// ============================================
// FOLLOW/UNFOLLOW ENDPOINTS
// ============================================

// Follow a user
app.post('/api/users/:userId/follow', authenticateToken, (req, res) => {
    const followerId = req.user.userId;
    const followingId = parseInt(req.params.userId);

    if (followerId === followingId) {
        return res.status(400).json({ error: 'No puedes seguirte a ti mismo' });
    }

    // Check if already following
    db.get(
        'SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?',
        [followerId, followingId],
        (err, existing) => {
            if (err) {
                return res.status(500).json({ error: 'Error al verificar seguimiento' });
            }

            if (existing) {
                return res.status(400).json({ error: 'Ya sigues a este usuario' });
            }

            // Create follow relationship
            db.run(
                'INSERT INTO user_follows (follower_id, following_id) VALUES (?, ?)',
                [followerId, followingId],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Error al seguir usuario' });
                    }

                    // Update counters
                    db.run('UPDATE users SET following_count = following_count + 1 WHERE id = ?', [followerId]);
                    db.run('UPDATE users SET followers_count = followers_count + 1 WHERE id = ?', [followingId]);

                    // Get follower info for notification
                    db.get('SELECT username FROM users WHERE id = ?', [followerId], (err, follower) => {
                        if (!err && follower) {
                            createNotification(
                                followingId,
                                'follow',
                                `${follower.username} comenzó a seguirte`,
                                followerId,
                                null
                            );
                        }
                    });

                    res.json({ message: 'Usuario seguido exitosamente', following: true });
                }
            );
        }
    );
});

// Unfollow a user
app.delete('/api/users/:userId/unfollow', authenticateToken, (req, res) => {
    const followerId = req.user.userId;
    const followingId = parseInt(req.params.userId);

    db.run(
        'DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?',
        [followerId, followingId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error al dejar de seguir' });
            }

            if (this.changes === 0) {
                return res.status(400).json({ error: 'No sigues a este usuario' });
            }

            // Update counters
            db.run('UPDATE users SET following_count = following_count - 1 WHERE id = ?', [followerId]);
            db.run('UPDATE users SET followers_count = followers_count - 1 WHERE id = ?', [followingId]);

            res.json({ message: 'Dejaste de seguir al usuario', following: false });
        }
    );
});

// Check if following a user
app.get('/api/users/:userId/is-following', authenticateToken, (req, res) => {
    const followerId = req.user.userId;
    const followingId = parseInt(req.params.userId);

    db.get(
        'SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?',
        [followerId, followingId],
        (err, follow) => {
            if (err) {
                return res.status(500).json({ error: 'Error al verificar seguimiento' });
            }

            res.json({ is_following: !!follow });
        }
    );
});

// Get user's followers
app.get('/api/users/:userId/followers', (req, res) => {
    const userId = parseInt(req.params.userId);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const query = `
        SELECT u.id, u.username, u.full_name, u.profile_picture, u.bio, u.is_verified,
               uf.created_at as followed_at
        FROM user_follows uf
        JOIN users u ON uf.follower_id = u.id
        WHERE uf.following_id = ?
        ORDER BY uf.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.all(query, [userId, limit, offset], (err, followers) => {
        if (err) {
            return res.status(500).json({ error: 'Error al cargar seguidores' });
        }

        db.get(
            'SELECT COUNT(*) as total FROM user_follows WHERE following_id = ?',
            [userId],
            (err, count) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al contar seguidores' });
                }

                res.json({
                    followers: followers || [],
                    pagination: {
                        page,
                        limit,
                        total: count.total,
                        pages: Math.ceil(count.total / limit)
                    }
                });
            }
        );
    });
});

// Get user's following
app.get('/api/users/:userId/following', (req, res) => {
    const userId = parseInt(req.params.userId);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const query = `
        SELECT u.id, u.username, u.full_name, u.profile_picture, u.bio, u.is_verified,
               uf.created_at as followed_at
        FROM user_follows uf
        JOIN users u ON uf.following_id = u.id
        WHERE uf.follower_id = ?
        ORDER BY uf.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.all(query, [userId, limit, offset], (err, following) => {
        if (err) {
            return res.status(500).json({ error: 'Error al cargar seguidos' });
        }

        db.get(
            'SELECT COUNT(*) as total FROM user_follows WHERE follower_id = ?',
            [userId],
            (err, count) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al contar seguidos' });
                }

                res.json({
                    following: following || [],
                    pagination: {
                        page,
                        limit,
                        total: count.total,
                        pages: Math.ceil(count.total / limit)
                    }
                });
            }
        );
    });
});

// ============================================
// REELS ENDPOINTS
// ============================================

app.post('/api/reels', authenticateToken, handleReelUpload, checkUserBan, (req, res) => {
    const userId = req.user.userId;
    const { title, description, category, is_public, duration_seconds } = req.body;

    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Título es requerido' });
    }

    if (!category || !isValidCategory(category)) {
        return res.status(400).json({ error: 'Categoría inválida' });
    }

    const videoFile = req.files && Array.isArray(req.files.video) ? req.files.video[0] : null;
    if (!videoFile) {
        return res.status(400).json({ error: 'Archivo de video es requerido' });
    }

    const thumbnailFile = req.files && Array.isArray(req.files.thumbnail) ? req.files.thumbnail[0] : null;

    const videoUrl = `/uploads/reels/${videoFile.filename}`;
    const thumbnailUrl = thumbnailFile ? `/uploads/reels/${thumbnailFile.filename}` : null;

    let duration = null;
    if (duration_seconds !== undefined && duration_seconds !== null && duration_seconds !== '') {
        const parsed = parseInt(duration_seconds, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
            duration = parsed;
        }
    }

    const isPublicFlag = (() => {
        if (typeof is_public === 'string') {
            const normalized = is_public.toLowerCase();
            return normalized === 'false' || normalized === '0' || normalized === 'off' ? 0 : 1;
        }
        if (typeof is_public === 'boolean') {
            return is_public ? 1 : 0;
        }
        return 1;
    })();

    db.run(
        `INSERT INTO reels (user_id, title, description, video_url, thumbnail_url, category, is_public, duration_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            userId,
            title.trim(),
            description ? description.trim() : null,
            videoUrl,
            thumbnailUrl,
            category,
            isPublicFlag,
            duration
        ],
        function(err) {
            if (err) {
                console.error('❌ Error al crear reel:', err);
                return res.status(500).json({ error: 'Error al crear reel' });
            }

            res.json({
                message: 'Reel publicado exitosamente',
                reel_id: this.lastID,
                video_url: videoUrl,
                thumbnail_url: thumbnailUrl
            });
        }
    );
});

app.get('/api/reels/category/:category', authenticateToken, requireAgeVerification, checkUserBan, (req, res) => {
    const userId = req.user.userId;
    const category = req.params.category;

    if (!isValidCategory(category)) {
        return res.status(400).json({ error: 'Categoría inválida' });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const offset = (page - 1) * limit;

    const query = `
        SELECT 
            r.id, r.title, r.description, r.video_url, r.thumbnail_url, r.category,
            r.is_public, r.duration_seconds, r.likes_count, r.comments_count, r.views_count,
            r.created_at, r.updated_at,
            u.id as user_id, u.username, u.full_name, u.profile_picture, u.is_verified,
            CASE WHEN rl.id IS NULL THEN 0 ELSE 1 END as is_liked_by_me
        FROM reels r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN reel_likes rl ON rl.reel_id = r.id AND rl.user_id = ?
        WHERE r.category = ? AND (r.is_public = 1 OR r.user_id = ?)
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.all(query, [userId, category, userId, limit, offset], (err, reels) => {
        if (err) {
            console.error('❌ Error al obtener reels:', err);
            return res.status(500).json({ error: 'Error al cargar reels' });
        }

        const countQuery = `
            SELECT COUNT(*) as total
            FROM reels r
            WHERE r.category = ? AND (r.is_public = 1 OR r.user_id = ?)
        `;

        db.get(countQuery, [category, userId], (countErr, countResult) => {
            if (countErr) {
                console.error('❌ Error al contar reels:', countErr);
                return res.status(500).json({ error: 'Error al contar reels' });
            }

            res.json({
                reels: reels || [],
                pagination: {
                    page,
                    limit,
                    total: countResult ? countResult.total : 0,
                    pages: countResult ? Math.ceil((countResult.total || 0) / limit) : 0
                }
            });
        });
    });
});

app.get('/api/reels/:reelId', authenticateToken, requireAgeVerification, checkUserBan, (req, res) => {
    const userId = req.user.userId;
    const reelId = parseInt(req.params.reelId, 10);

    if (Number.isNaN(reelId)) {
        return res.status(400).json({ error: 'Identificador de reel inválido' });
    }

    const query = `
        SELECT
            r.id, r.title, r.description, r.video_url, r.thumbnail_url, r.category,
            r.is_public, r.duration_seconds, r.likes_count, r.comments_count, r.views_count,
            r.created_at, r.updated_at,
            u.id as user_id, u.username, u.full_name, u.profile_picture, u.is_verified,
            CASE WHEN rl.id IS NULL THEN 0 ELSE 1 END as is_liked_by_me
        FROM reels r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN reel_likes rl ON rl.reel_id = r.id AND rl.user_id = ?
        WHERE r.id = ?
    `;

    db.get(query, [userId, reelId], (err, reel) => {
        if (err) {
            console.error('❌ Error al obtener reel:', err);
            return res.status(500).json({ error: 'Error al obtener reel' });
        }

        if (!reel) {
            return res.status(404).json({ error: 'Reel no encontrado' });
        }

        if (!reel.is_public && reel.user_id !== userId) {
            return res.status(403).json({ error: 'No tienes acceso a este reel' });
        }

        res.json({ reel });
    });
});

app.post('/api/reels/:reelId/like', authenticateToken, requireAgeVerification, checkUserBan, (req, res) => {
    const userId = req.user.userId;
    const reelId = parseInt(req.params.reelId, 10);

    if (Number.isNaN(reelId)) {
        return res.status(400).json({ error: 'Identificador de reel inválido' });
    }

    db.get('SELECT user_id, is_public FROM reels WHERE id = ?', [reelId], (err, reel) => {
        if (err) {
            return res.status(500).json({ error: 'Error al verificar reel' });
        }

        if (!reel) {
            return res.status(404).json({ error: 'Reel no encontrado' });
        }

        if (!reel.is_public && reel.user_id !== userId) {
            return res.status(403).json({ error: 'No tienes acceso a este reel' });
        }

        db.run(
            'INSERT INTO reel_likes (reel_id, user_id) VALUES (?, ?)',
            [reelId, userId],
            function(insertErr) {
                if (insertErr) {
                    if (insertErr.message && insertErr.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Ya diste like a este reel' });
                    }
                    return res.status(500).json({ error: 'Error al registrar like' });
                }

                db.run(
                    'UPDATE reels SET likes_count = likes_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [reelId],
                    (updateErr) => {
                        if (updateErr) {
                            console.error('❌ Error al actualizar likes de reel:', updateErr);
                            return res.status(500).json({ error: 'Error al actualizar likes' });
                        }

                        res.json({ message: 'Like registrado' });
                    }
                );
            }
        );
    });
});

app.delete('/api/reels/:reelId/like', authenticateToken, requireAgeVerification, checkUserBan, (req, res) => {
    const userId = req.user.userId;
    const reelId = parseInt(req.params.reelId, 10);

    if (Number.isNaN(reelId)) {
        return res.status(400).json({ error: 'Identificador de reel inválido' });
    }

    db.run(
        'DELETE FROM reel_likes WHERE reel_id = ? AND user_id = ?',
        [reelId, userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error al eliminar like' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'No habías dado like a este reel' });
            }

            db.run(
                `UPDATE reels 
                 SET likes_count = CASE WHEN likes_count > 0 THEN likes_count - 1 ELSE 0 END,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [reelId],
                (updateErr) => {
                    if (updateErr) {
                        console.error('❌ Error al actualizar likes de reel:', updateErr);
                        return res.status(500).json({ error: 'Error al actualizar contador de likes' });
                    }

                    res.json({ message: 'Like eliminado' });
                }
            );
        }
    );
});

app.post('/api/reels/:reelId/comment', authenticateToken, requireAgeVerification, checkUserBan, (req, res) => {
    const userId = req.user.userId;
    const reelId = parseInt(req.params.reelId, 10);
    const { comment } = req.body;

    if (Number.isNaN(reelId)) {
        return res.status(400).json({ error: 'Identificador de reel inválido' });
    }

    if (!comment || !comment.trim()) {
        return res.status(400).json({ error: 'Comentario requerido' });
    }

    db.get('SELECT user_id, is_public FROM reels WHERE id = ?', [reelId], (err, reel) => {
        if (err) {
            return res.status(500).json({ error: 'Error al verificar reel' });
        }

        if (!reel) {
            return res.status(404).json({ error: 'Reel no encontrado' });
        }

        if (!reel.is_public && reel.user_id !== userId) {
            return res.status(403).json({ error: 'No tienes acceso a este reel' });
        }

        db.run(
            'INSERT INTO reel_comments (reel_id, user_id, comment) VALUES (?, ?, ?)',
            [reelId, userId, comment.trim()],
            function(insertErr) {
                if (insertErr) {
                    console.error('❌ Error al crear comentario en reel:', insertErr);
                    return res.status(500).json({ error: 'Error al comentar reel' });
                }

                const commentId = this.lastID;

                db.run(
                    'UPDATE reels SET comments_count = comments_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [reelId],
                    (updateErr) => {
                        if (updateErr) {
                            console.error('❌ Error al actualizar contador de comentarios:', updateErr);
                        }
                    }
                );

                const fetchQuery = `
                    SELECT rc.id, rc.comment, rc.created_at,
                           u.id as user_id, u.username, u.full_name, u.profile_picture, u.is_verified
                    FROM reel_comments rc
                    JOIN users u ON rc.user_id = u.id
                    WHERE rc.id = ?
                `;

                db.get(fetchQuery, [commentId], (fetchErr, newComment) => {
                    if (fetchErr) {
                        console.error('❌ Error al obtener comentario de reel:', fetchErr);
                        return res.status(500).json({ error: 'Comentario creado pero no se pudo recuperar' });
                    }

                    res.json({
                        message: 'Comentario agregado',
                        comment: newComment
                    });
                });
            }
        );
    });
});

app.get('/api/reels/:reelId/comments', authenticateToken, requireAgeVerification, checkUserBan, (req, res) => {
    const userId = req.user.userId;
    const reelId = parseInt(req.params.reelId, 10);

    if (Number.isNaN(reelId)) {
        return res.status(400).json({ error: 'Identificador de reel inválido' });
    }

    db.get('SELECT user_id, is_public FROM reels WHERE id = ?', [reelId], (err, reel) => {
        if (err) {
            return res.status(500).json({ error: 'Error al verificar reel' });
        }

        if (!reel) {
            return res.status(404).json({ error: 'Reel no encontrado' });
        }

        if (!reel.is_public && reel.user_id !== userId) {
            return res.status(403).json({ error: 'No tienes acceso a este reel' });
        }

        const query = `
            SELECT rc.id, rc.comment, rc.created_at,
                   u.id as user_id, u.username, u.full_name, u.profile_picture, u.is_verified
            FROM reel_comments rc
            JOIN users u ON rc.user_id = u.id
            WHERE rc.reel_id = ?
            ORDER BY rc.created_at DESC
        `;

        db.all(query, [reelId], (commentsErr, comments) => {
            if (commentsErr) {
                console.error('❌ Error al obtener comentarios de reel:', commentsErr);
                return res.status(500).json({ error: 'Error al obtener comentarios' });
            }

            res.json({ comments: comments || [] });
        });
    });
});

app.post('/api/reels/:reelId/view', authenticateToken, requireAgeVerification, checkUserBan, (req, res) => {
    const reelId = parseInt(req.params.reelId, 10);

    if (Number.isNaN(reelId)) {
        return res.status(400).json({ error: 'Identificador de reel inválido' });
    }

    db.run(
        'UPDATE reels SET views_count = views_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [reelId],
        function(err) {
            if (err) {
                console.error('❌ Error al registrar vista de reel:', err);
                return res.status(500).json({ error: 'Error al registrar vista' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Reel no encontrado' });
            }

            res.json({ message: 'Vista registrada' });
        }
    );
});

app.delete('/api/reels/:reelId', authenticateToken, checkUserBan, (req, res) => {
    const userId = req.user.userId;
    const reelId = parseInt(req.params.reelId, 10);

    if (Number.isNaN(reelId)) {
        return res.status(400).json({ error: 'Identificador de reel inválido' });
    }

    db.get(
        'SELECT id, user_id, video_url, thumbnail_url FROM reels WHERE id = ?',
        [reelId],
        (err, reel) => {
            if (err) {
                console.error('❌ Error al verificar reel antes de eliminar:', err);
                return res.status(500).json({ error: 'Error al buscar el reel' });
            }

            if (!reel) {
                return res.status(404).json({ error: 'Reel no encontrado' });
            }

            if (reel.user_id !== userId) {
                return res.status(403).json({ error: 'No tienes permiso para eliminar este reel' });
            }

            db.serialize(() => {
                db.run('DELETE FROM reel_likes WHERE reel_id = ?', [reelId], (likesErr) => {
                    if (likesErr) {
                        console.error('❌ Error al eliminar likes del reel:', likesErr);
                        return res.status(500).json({ error: 'Error al eliminar los likes del reel' });
                    }

                    db.run('DELETE FROM reel_comments WHERE reel_id = ?', [reelId], (commentsErr) => {
                        if (commentsErr) {
                            console.error('❌ Error al eliminar comentarios del reel:', commentsErr);
                            return res.status(500).json({ error: 'Error al eliminar los comentarios del reel' });
                        }

                        db.run('DELETE FROM reels WHERE id = ?', [reelId], function(deleteErr) {
                            if (deleteErr) {
                                console.error('❌ Error al eliminar el reel:', deleteErr);
                                return res.status(500).json({ error: 'Error al eliminar el reel' });
                            }

                            deleteFileIfExists(reel.video_url);
                            deleteFileIfExists(reel.thumbnail_url);

                            res.json({ message: 'Reel eliminado correctamente' });
                        });
                    });
                });
            });
        }
    );
});

// ============================================
// FEED ENDPOINTS
// ============================================

// Get recommended feed (personalized)
app.get('/api/feed/recommended', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Complex query that combines multiple factors for recommendations
    const query = `
        SELECT DISTINCT
            cp.id, cp.title, cp.description, cp.content_type, cp.file_url as media_url,
            cp.thumbnail_url, cp.price, cp.is_premium, cp.category, cp.likes_count,
            cp.comments_count, cp.created_at,
            u.id as user_id, u.username, u.full_name, u.profile_picture, u.is_verified,
            CASE
                WHEN uf.id IS NOT NULL THEN 40
                ELSE 0
            END +
            CASE
                WHEN ui.weight IS NOT NULL THEN ui.weight * 3
                ELSE 0
            END +
            CASE
                WHEN cp.created_at > datetime('now', '-24 hours') THEN cp.likes_count * 2
                ELSE cp.likes_count
            END +
            CASE
                WHEN cp.created_at > datetime('now', '-1 hour') THEN 10
                ELSE 0
            END as score
        FROM content_posts cp
        JOIN users u ON cp.user_id = u.id
        LEFT JOIN user_follows uf ON uf.following_id = cp.user_id AND uf.follower_id = ?
        LEFT JOIN user_interests ui ON ui.user_id = ? AND ui.category = cp.category
        WHERE cp.is_public = 1 AND cp.user_id != ?
        ORDER BY score DESC, cp.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.all(query, [userId, userId, userId, limit, offset], (err, posts) => {
        if (err) {
            console.error('Error loading recommended feed:', err);
            return res.status(500).json({ error: 'Error al cargar feed' });
        }

        db.get(
            'SELECT COUNT(DISTINCT cp.id) as total FROM content_posts cp WHERE cp.is_public = 1 AND cp.user_id != ?',
            [userId],
            (err, count) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al contar posts' });
                }

                res.json({
                    posts: posts || [],
                    pagination: {
                        page,
                        limit,
                        total: count.total,
                        pages: Math.ceil(count.total / limit)
                    }
                });
            }
        );
    });
});

// Get feed from followed users only
app.get('/api/feed/following', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const query = `
        SELECT 
            cp.id, cp.title, cp.description, cp.content_type, cp.file_url as media_url,
            cp.thumbnail_url, cp.price, cp.is_premium, cp.category, cp.likes_count,
            cp.comments_count, cp.created_at,
            u.id as user_id, u.username, u.full_name, u.profile_picture, u.is_verified
        FROM content_posts cp
        JOIN users u ON cp.user_id = u.id
        JOIN user_follows uf ON uf.following_id = cp.user_id
        WHERE uf.follower_id = ? AND cp.is_public = 1
        ORDER BY cp.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.all(query, [userId, limit, offset], (err, posts) => {
        if (err) {
            return res.status(500).json({ error: 'Error al cargar feed' });
        }

        db.get(
            `SELECT COUNT(*) as total FROM content_posts cp
             JOIN user_follows uf ON uf.following_id = cp.user_id
             WHERE uf.follower_id = ? AND cp.is_public = 1`,
            [userId],
            (err, count) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al contar posts' });
                }

                res.json({
                    posts: posts || [],
                    pagination: {
                        page,
                        limit,
                        total: count.total,
                        pages: Math.ceil(count.total / limit)
                    }
                });
            }
        );
    });
});

// Get trending feed (last 24 hours, most popular)
app.get('/api/feed/trending', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const query = `
        SELECT 
            cp.id, cp.title, cp.description, cp.content_type, cp.file_url as media_url,
            cp.thumbnail_url, cp.price, cp.is_premium, cp.category, cp.likes_count,
            cp.comments_count, cp.created_at,
            u.id as user_id, u.username, u.full_name, u.profile_picture, u.is_verified,
            (cp.likes_count * 2 + cp.comments_count * 3) as engagement_score
        FROM content_posts cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.is_public = 1 AND cp.created_at > datetime('now', '-24 hours')
        ORDER BY engagement_score DESC, cp.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.all(query, [limit, offset], (err, posts) => {
        if (err) {
            return res.status(500).json({ error: 'Error al cargar trending' });
        }

        db.get(
            `SELECT COUNT(*) as total FROM content_posts 
             WHERE is_public = 1 AND created_at > datetime('now', '-24 hours')`,
            [],
            (err, count) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al contar posts' });
                }

                res.json({
                    posts: posts || [],
                    pagination: {
                        page,
                        limit,
                        total: count.total,
                        pages: Math.ceil(count.total / limit)
                    }
                });
            }
        );
    });
});

// ============================================
// INTERACTION ENDPOINTS (Like, Comment, Share)
// ============================================

// Like a post
app.post('/api/posts/:postId/like', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const postId = parseInt(req.params.postId);

    // Check if already liked
    db.get(
        'SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?',
        [userId, postId],
        (err, existing) => {
            if (err) {
                return res.status(500).json({ error: 'Error al verificar like' });
            }

            if (existing) {
                return res.status(400).json({ error: 'Ya diste like a este post' });
            }

            // Add like
            db.run(
                'INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)',
                [userId, postId],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Error al dar like' });
                    }

                    // Update likes count
                    db.run('UPDATE content_posts SET likes_count = likes_count + 1 WHERE id = ?', [postId]);

                    // Get post info for notification and interest update
                    db.get(
                        'SELECT user_id, category FROM content_posts WHERE id = ?',
                        [postId],
                        (err, post) => {
                            if (!err && post) {
                                // Update user interests
                                updateUserInterest(userId, post.category);

                                // Create notification if not own post
                                if (post.user_id !== userId) {
                                    db.get('SELECT username FROM users WHERE id = ?', [userId], (err, user) => {
                                        if (!err && user) {
                                            createNotification(
                                                post.user_id,
                                                'like',
                                                `${user.username} le dio like a tu publicación`,
                                                userId,
                                                postId
                                            );
                                        }
                                    });
                                }
                            }
                        }
                    );

                    res.json({ message: 'Like agregado', liked: true });
                }
            );
        }
    );
});

// Unlike a post
app.delete('/api/posts/:postId/unlike', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const postId = parseInt(req.params.postId);

    db.run(
        'DELETE FROM post_likes WHERE user_id = ? AND post_id = ?',
        [userId, postId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error al quitar like' });
            }

            if (this.changes === 0) {
                return res.status(400).json({ error: 'No has dado like a este post' });
            }

            // Update likes count
            db.run('UPDATE content_posts SET likes_count = likes_count - 1 WHERE id = ?', [postId]);

            res.json({ message: 'Like removido', liked: false });
        }
    );
});

// Check if user liked a post
app.get('/api/posts/:postId/liked', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const postId = parseInt(req.params.postId);

    db.get(
        'SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?',
        [userId, postId],
        (err, like) => {
            if (err) {
                return res.status(500).json({ error: 'Error al verificar like' });
            }

            res.json({ liked: !!like });
        }
    );
});

// Add comment to post
app.post('/api/posts/:postId/comment', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const postId = parseInt(req.params.postId);
    const { comment } = req.body;

    if (!comment || comment.trim().length === 0) {
        return res.status(400).json({ error: 'El comentario no puede estar vacío' });
    }

    if (comment.length > 500) {
        return res.status(400).json({ error: 'El comentario no puede exceder 500 caracteres' });
    }

    db.run(
        'INSERT INTO post_comments (user_id, post_id, comment) VALUES (?, ?, ?)',
        [userId, postId, comment.trim()],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error al agregar comentario' });
            }

            // Update comments count
            db.run('UPDATE content_posts SET comments_count = comments_count + 1 WHERE id = ?', [postId]);

            // Get post info for notification and interest update
            db.get(
                'SELECT user_id, category FROM content_posts WHERE id = ?',
                [postId],
                (err, post) => {
                    if (!err && post) {
                        // Update user interests
                        updateUserInterest(userId, post.category);

                        // Create notification if not own post
                        if (post.user_id !== userId) {
                            db.get('SELECT username FROM users WHERE id = ?', [userId], (err, user) => {
                                if (!err && user) {
                                    createNotification(
                                        post.user_id,
                                        'comment',
                                        `${user.username} comentó en tu publicación`,
                                        userId,
                                        postId
                                    );
                                }
                            });
                        }
                    }
                }
            );

            res.json({ 
                message: 'Comentario agregado',
                comment_id: this.lastID
            });
        }
    );
});

// Get post comments
app.get('/api/posts/:postId/comments', (req, res) => {
    const postId = parseInt(req.params.postId);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const query = `
        SELECT 
            pc.id, pc.comment, pc.created_at,
            u.id as user_id, u.username, u.full_name, u.profile_picture, u.is_verified
        FROM post_comments pc
        JOIN users u ON pc.user_id = u.id
        WHERE pc.post_id = ?
        ORDER BY pc.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.all(query, [postId, limit, offset], (err, comments) => {
        if (err) {
            return res.status(500).json({ error: 'Error al cargar comentarios' });
        }

        db.get(
            'SELECT COUNT(*) as total FROM post_comments WHERE post_id = ?',
            [postId],
            (err, count) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al contar comentarios' });
                }

                res.json({
                    comments: comments || [],
                    pagination: {
                        page,
                        limit,
                        total: count.total,
                        pages: Math.ceil(count.total / limit)
                    }
                });
            }
        );
    });
});

// Share a post
app.post('/api/posts/:postId/share', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const postId = parseInt(req.params.postId);

    db.run(
        'INSERT INTO post_shares (user_id, post_id) VALUES (?, ?)',
        [userId, postId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error al compartir post' });
            }

            // Get post info for notification
            db.get(
                'SELECT user_id FROM content_posts WHERE id = ?',
                [postId],
                (err, post) => {
                    if (!err && post && post.user_id !== userId) {
                        db.get('SELECT username FROM users WHERE id = ?', [userId], (err, user) => {
                            if (!err && user) {
                                createNotification(
                                    post.user_id,
                                    'share',
                                    `${user.username} compartió tu publicación`,
                                    userId,
                                    postId
                                );
                            }
                        });
                    }
                }
            );

            res.json({ 
                message: 'Post compartido exitosamente',
                share_id: this.lastID
            });
        }
    );
});

// Get post shares count
app.get('/api/posts/:postId/shares', (req, res) => {
    const postId = parseInt(req.params.postId);

    db.get(
        'SELECT COUNT(*) as total FROM post_shares WHERE post_id = ?',
        [postId],
        (err, count) => {
            if (err) {
                return res.status(500).json({ error: 'Error al contar compartidos' });
            }

            res.json({ shares_count: count.total });
        }
    );
});

// ============================================
// AI SFW IMAGE GENERATION (Provider-agnostic)
// ============================================

// Simple in-memory rate limiter: 10 requests/min por IP
const aiRateBucket = new Map();
function isRateLimited(ip) {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxReq = 10;

    const entry = aiRateBucket.get(ip) || [];
    const recent = entry.filter(ts => now - ts < windowMs);
    if (recent.length >= maxReq) return true;
    recent.push(now);
    aiRateBucket.set(ip, recent);
    return false;
}

// Basic SFW blocklist
const SFW_BLOCKLIST = [
    'nsfw','porn','sex','sexual','xxx','hentai','incest','rape','loli','shota','bestiality',
    'nude','nudity','boobs','genitals','penis','vagina','cum','ejaculation','fetish'
];

// POST /api/ai/generate-image
// Body: { prompt: string }
app.post('/api/ai/generate-image', async (req, res) => {
    try {
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
        if (isRateLimited(clientIp)) {
            return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta nuevamente en un minuto.' });
        }

        const { prompt } = req.body || {};
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
            return res.status(400).json({ error: 'Prompt inválido. Escribe una descripción más detallada.' });
        }

        const lower = prompt.toLowerCase();
        if (SFW_BLOCKLIST.some(w => lower.includes(w))) {
            return res.status(400).json({ error: 'Contenido no permitido. Solo SFW.' });
        }

        // TODO: Integrar con un proveedor SFW (p.ej., Stability/Imagen SFW) usando process.env.AI_PROVIDER_API_KEY
        // Ejemplo (pseudo):
        // const aiResp = await fetch('https://PROVEEDOR_SFW/generate', { method:'POST', headers:{ 'Authorization': `Bearer ${process.env.AI_PROVIDER_API_KEY}`, 'Content-Type':'application/json' }, body: JSON.stringify({ prompt }) });
        // const aiData = await aiResp.json();
        // const imageBase64 = aiData.image_base64;

        // Placeholder PNG 1x1 transparente para no romper la UI
        const placeholder = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFYQJ4o2qJxQAAAABJRU5ErkJggg==';
        return res.json({ imageDataUrl: `data:image/png;base64,${placeholder}` });
    } catch (err) {
        console.error('AI SFW error:', err);
        return res.status(500).json({ error: 'Error generando imagen' });
    }
});

// ============================================
// NOTIFICATIONS ENDPOINTS
// ============================================

// Get user notifications
app.get('/api/notifications', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const query = `
        SELECT 
            n.id, n.type, n.content, n.is_read, n.created_at,
            n.related_post_id,
            u.id as related_user_id, u.username as related_username, 
            u.profile_picture as related_user_picture
        FROM notifications n
        LEFT JOIN users u ON n.related_user_id = u.id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.all(query, [userId, limit, offset], (err, notifications) => {
        if (err) {
            return res.status(500).json({ error: 'Error al cargar notificaciones' });
        }

        db.get(
            'SELECT COUNT(*) as total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread FROM notifications WHERE user_id = ?',
            [userId],
            (err, count) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al contar notificaciones' });
                }

                res.json({
                    notifications: notifications || [],
                    unread_count: count.unread || 0,
                    pagination: {
                        page,
                        limit,
                        total: count.total,
                        pages: Math.ceil(count.total / limit)
                    }
                });
            }
        );
    });
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const notificationId = parseInt(req.params.id);

    db.run(
        'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
        [notificationId, userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error al marcar notificación' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Notificación no encontrada' });
            }

            res.json({ message: 'Notificación marcada como leída' });
        }
    );
});

// Mark all notifications as read
app.put('/api/notifications/read-all', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    db.run(
        'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
        [userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error al marcar notificaciones' });
            }

            res.json({ 
                message: 'Todas las notificaciones marcadas como leídas',
                updated: this.changes
            });
        }
    );
});

// ============================================
// SEARCH ENDPOINTS
// ============================================

// Search users
app.get('/api/search/users', (req, res) => {
    const query = req.query.q;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: 'Query de búsqueda requerido' });
    }

    const searchQuery = `
        SELECT 
            id, username, full_name, profile_picture, bio, category,
            is_verified, followers_count, posts_count
        FROM users
        WHERE (username LIKE ? OR full_name LIKE ? OR bio LIKE ?)
        ORDER BY followers_count DESC, username ASC
        LIMIT ? OFFSET ?
    `;

    const searchTerm = `%${query.trim()}%`;

    db.all(searchQuery, [searchTerm, searchTerm, searchTerm, limit, offset], (err, users) => {
        if (err) {
            return res.status(500).json({ error: 'Error al buscar usuarios' });
        }

        db.get(
            'SELECT COUNT(*) as total FROM users WHERE (username LIKE ? OR full_name LIKE ? OR bio LIKE ?)',
            [searchTerm, searchTerm, searchTerm],
            (err, count) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al contar resultados' });
                }

                res.json({
                    users: users || [],
                    pagination: {
                        page,
                        limit,
                        total: count.total,
                        pages: Math.ceil(count.total / limit)
                    }
                });
            }
        );
    });
});

// Search posts
app.get('/api/search/posts', (req, res) => {
    const query = req.query.q;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: 'Query de búsqueda requerido' });
    }

    const searchQuery = `
        SELECT 
            cp.id, cp.title, cp.description, cp.content_type, cp.file_url as media_url,
            cp.thumbnail_url, cp.price, cp.is_premium, cp.category, cp.likes_count,
            cp.comments_count, cp.created_at,
            u.id as user_id, u.username, u.full_name, u.profile_picture, u.is_verified
        FROM content_posts cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.is_public = 1 AND (cp.title LIKE ? OR cp.description LIKE ?)
        ORDER BY cp.likes_count DESC, cp.created_at DESC
        LIMIT ? OFFSET ?
    `;

    const searchTerm = `%${query.trim()}%`;

    db.all(searchQuery, [searchTerm, searchTerm, limit, offset], (err, posts) => {
        if (err) {
            return res.status(500).json({ error: 'Error al buscar publicaciones' });
        }

        db.get(
            'SELECT COUNT(*) as total FROM content_posts WHERE is_public = 1 AND (title LIKE ? OR description LIKE ?)',
            [searchTerm, searchTerm],
            (err, count) => {
                if (err) {
                    return res.status(500).json({ error: 'Error al contar resultados' });
                }

                res.json({
                    posts: posts || [],
                    pagination: {
                        page,
                        limit,
                        total: count.total,
                        pages: Math.ceil(count.total / limit)
                    }
                });
            }
        );
    });
});

// Get suggested users to follow
app.get('/api/users/suggested', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 10;

    // Suggest users based on:
    // 1. Popular users (high followers count)
    // 2. Users in similar categories
    // 3. Users not already followed
    const query = `
        SELECT DISTINCT
            u.id, u.username, u.full_name, u.profile_picture, u.bio, u.category,
            u.is_verified, u.followers_count, u.posts_count
        FROM users u
        LEFT JOIN user_follows uf ON uf.following_id = u.id AND uf.follower_id = ?
        LEFT JOIN user_interests ui ON ui.user_id = ?
        LEFT JOIN content_posts cp ON cp.user_id = u.id AND cp.category = ui.category
        WHERE u.id != ? AND uf.id IS NULL AND u.posts_count > 0
        ORDER BY 
            CASE WHEN cp.id IS NOT NULL THEN 1 ELSE 0 END DESC,
            u.followers_count DESC,
            u.posts_count DESC
        LIMIT ?
    `;

    db.all(query, [userId, userId, userId, limit], (err, users) => {
        if (err) {
            console.error('Error getting suggested users:', err);
            return res.status(500).json({ error: 'Error al obtener sugerencias' });
        }

        res.json({ suggested_users: users || [] });
    });
});

// ==================== RUTAS HTML (al final, después de todas las rutas de API) ====================

// Rutas para páginas HTML principales
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/home.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/feed.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'feed.html'));
});

app.get('/profile.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
});

app.get('/create-post.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'create-post.html'));
});

app.get('/verificar-identidad.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'verificar-identidad.html'));
});

app.get('/admin-verificaciones.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-verificaciones.html'));
});

app.get('/policies.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'policies.html'));
});

// Rutas para feeds de categorías
app.get('/feed-:category.html', (req, res) => {
    const category = req.params.category;
    const filename = `feed-${category}.html`;
    const filePath = path.join(__dirname, filename);
    
    // Verificar que el archivo existe
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Página no encontrada');
    }
});

// Ruta catch-all para otros archivos HTML (debe ir al final)
app.get('*.html', (req, res) => {
    const filename = req.path.substring(1); // Remover el / inicial
    const filePath = path.join(__dirname, filename);
    
    // Verificar que el archivo existe
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Página no encontrada');
    }
});

// ============================================
// ERROR HANDLING MIDDLEWARE (debe ir al final, después de todas las rutas)
// ============================================

// Manejo de errores global (solo para errores, no para rutas no encontradas)
app.use((err, req, res, next) => {
    // Log del error
    console.error('❌ Error:', {
        message: err.message,
        stack: isDevelopment ? err.stack : undefined,
        path: req.path,
        method: req.method
    });

    // Respuesta al cliente
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'El archivo es demasiado grande' });
        }
        return res.status(400).json({ error: 'Error al subir archivo: ' + err.message });
    }

    // Error de validación
    if (err.message && err.message.includes('Tipo de archivo no permitido')) {
        return res.status(400).json({ error: err.message });
    }

    // Error de CORS
    if (err.message && err.message.includes('CORS')) {
        return res.status(403).json({ error: 'Acceso denegado por CORS' });
    }

    // Error genérico
    res.status(err.status || 500).json({
        error: isDevelopment 
            ? err.message || 'Error interno del servidor'
            : 'Error interno del servidor'
    });
});

// 404 handler para rutas API no encontradas
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Ruta API no encontrada' });
});

// Servidor HTTP solo en ejecución local / hosting tradicional (no en Vercel serverless)
if (require.main === module) {
    dbReady.then(() => {
    app.listen(PORT, () => {
        console.log(`✅ Servidor Deseo Libre ejecutándose en puerto ${PORT}`);
        console.log(`🌐 Modo: ${NODE_ENV}`);
        if (isDevelopment) {
            console.log(`🔗 Accede a: http://localhost:${PORT}`);
        } else {
            console.log(`🔒 Modo producción activado`);
        }
        });
    }).catch((error) => {
        console.error('No se pudo iniciar la base de datos:', error);
        process.exit(1);
    });

    process.on('SIGINT', () => {
        console.log('\nCerrando servidor...');
        db.close((err) => {
            if (err) {
                console.error(err.message);
            }
            console.log('Base de datos cerrada.');
            process.exit(0);
        });
    });
}

module.exports = app;
