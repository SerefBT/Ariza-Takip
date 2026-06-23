const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT Token Doğrulama Middleware'i
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Token'ı al
      token = req.headers.authorization.split(' ')[1];

      // Token'ı doğrula
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'arizatakip_gizli_anahtar_123!');

      // Kullanıcıyı al (şifreyi dahil etmeden)
      req.user = await User.findById(decoded.id);

      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Bu token ile ilişkili bir kullanıcı bulunamadı' });
      }

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ success: false, message: 'Yetkilendirme hatası, token geçersiz' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Yetkilendirme hatası, token bulunamadı' });
  }
};

// Rol Doğrulama Middleware'i
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Bu işlemi yapabilmek için '${req.user ? req.user.role : 'misafir'}' rolü yetersizdir.`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
