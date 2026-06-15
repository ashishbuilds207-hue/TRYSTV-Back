const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')

const uploadDir = path.join(__dirname, '../../uploads/photos')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
        cb(null, `${uuidv4()}${ext}`)
    },
})

const fileFilter = (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)
    cb(ok ? null : new Error('Only JPEG, PNG, WebP, GIF allowed'), ok)
}

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: 6 },
})

module.exports = { upload, uploadDir }
