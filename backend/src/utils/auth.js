const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (e) {
    return null;
  }
}

function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return req.query.token || req.body.token || null;
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  extractToken,
};
