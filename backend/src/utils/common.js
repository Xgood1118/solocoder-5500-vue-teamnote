const uuid = require('uuid');

function generateId(prefix = '') {
  return prefix + uuid.v4().replace(/-/g, '').slice(0, 16);
}

function now() {
  return new Date().toISOString();
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

function sendSuccess(res, data = null, message = 'success') {
  res.json({ code: 0, message, data });
}

function sendError(res, error) {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    code: error.code || 'INTERNAL_ERROR',
    message: error.message || 'Internal Server Error',
    data: null,
  });
}

module.exports = {
  generateId,
  now,
  asyncHandler,
  AppError,
  sendSuccess,
  sendError,
};
