const { Router } = require('express');
const c = require('../controllers/commentController');
const { authenticate, requireResourcePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../middleware/permissions');

const router = Router();
router.use(authenticate);

router.get('/note/:noteId', c.listByNote);
router.post('/', c.create);
router.put('/:id', c.update);
router.post('/:id/resolve', c.resolve);
router.delete('/:id', c.remove);

module.exports = router;
