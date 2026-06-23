const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// JWT üretme fonksiyonu
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'arizatakip_gizli_anahtar_123!', {
    expiresIn: '30d'
  });
};

// @desc    Yeni kullanıcı kaydı
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Sadece musteri ve teknisyen rollerine izin ver (admin dışarıdan kayıt olamaz)
    const allowedRoles = ['musteri', 'teknisyen'];
    const assignedRole = allowedRoles.includes(role) ? role : 'musteri';

    // Kullanıcı var mı kontrol et
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Bu kullanıcı adı veya e-posta zaten kullanımda' });
    }

    // Teknisyen kayıtları onay bekler (isApproved: false)
    const isApproved = assignedRole === 'musteri' ? true : false;

    const user = await User.create({
      username,
      email,
      password,
      role: assignedRole,
      isApproved
    });

    // Teknisyen onay bekliyorsa token verme, bilgi mesajı dön
    if (!isApproved) {
      return res.status(201).json({
        success: true,
        pendingApproval: true,
        message: 'Teknisyen hesabınız oluşturuldu. Yönetici onayından sonra giriş yapabilirsiniz.'
      });
    }

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Kullanıcı girişi
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ success: false, message: 'Lütfen e-posta/kullanıcı adı ve şifre girin' });
    }

    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }]
    }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Geçersiz kullanıcı adı/e-posta veya şifre' });
    }

    // Onay bekleyen teknisyen kontrolü
    if (!user.isApproved) {
      return res.status(403).json({
        success: false,
        pendingApproval: true,
        message: 'Hesabınız henüz yönetici tarafından onaylanmadı. Lütfen bekleyin.'
      });
    }

    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Mevcut kullanıcı profilini getir
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        notifications: user.notifications
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Onaylı teknisyen listesini getir (Teknisyen atama için)
// @route   GET /api/auth/technicians
// @access  Private (Admin ve Teknisyenler)
router.get('/technicians', protect, authorize('admin', 'teknisyen'), async (req, res) => {
  try {
    const technicians = await User.find({ role: 'teknisyen', isApproved: true }).select('username email');
    res.json({ success: true, data: technicians });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Onay bekleyen teknisyenleri listele
// @route   GET /api/auth/pending-technicians
// @access  Private (Sadece Admin)
router.get('/pending-technicians', protect, authorize('admin'), async (req, res) => {
  try {
    const pending = await User.find({ role: 'teknisyen', isApproved: false })
      .select('username email createdAt');
    res.json({ success: true, data: pending });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Teknisyeni onayla
// @route   PUT /api/auth/approve/:id
// @access  Private (Sadece Admin)
router.put('/approve/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
    }
    res.json({
      success: true,
      message: `${user.username} adlı teknisyen başarıyla onaylandı.`,
      data: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Teknisyen kaydını reddet / sil
// @route   DELETE /api/auth/reject/:id
// @access  Private (Sadece Admin)
router.delete('/reject/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
    }
    res.json({
      success: true,
      message: `${user.username} adlı teknisyen kaydı reddedildi ve silindi.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Bildirimleri okundu olarak işaretle
// @route   PUT /api/auth/notifications/read
// @access  Private
router.put('/notifications/read', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      user.notifications.forEach(notif => notif.isRead = true);
      await user.save();
    }
    res.json({ success: true, message: 'Bildirimler okundu' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
