// vercel.json routes the complete /api/* contract through this Node Function.
const { requestHandler } = require('../server');

module.exports = requestHandler;
