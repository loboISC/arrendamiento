const express = require('express');
const router = express.Router();
const previewController = require('../controllers/preview');

router.post('/', previewController.createPreview);
router.get('/:id', previewController.getPreview);

module.exports = router;
