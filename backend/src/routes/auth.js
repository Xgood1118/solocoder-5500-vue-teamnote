const { Router } = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/login-invite', authController.loginWithInvite);
router.get('/profile', authenticate, authController.profile);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/password', authenticate, authController.changePassword);

module.exports = router;
