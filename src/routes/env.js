const express = require('express');
const router = express.Router();
const envController = require('../controllers/envController');
const { authenticateToken } = require('../middleware/auth');

// Solo administradores deberían poder tocar el .env
router.use(authenticateToken);

router.get('/', envController.getEnv);
router.post('/', envController.saveEnv);

module.exports = router;
