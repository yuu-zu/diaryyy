const { verifyToken } = require('../utils/jwt');

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
}

function requireLogin(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ message: 'Chua dang nhap.' });
    }

    req.user = verifyToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Phien dang nhap khong hop le hoac da het han.' });
  }
}

module.exports = { requireLogin };
