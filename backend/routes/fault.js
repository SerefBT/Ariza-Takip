const express = require('express');
const router = express.Router();
const Fault = require('../models/Fault');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @desc    Yeni arıza bildirimi oluştur
// @route   POST /api/faults
// @access  Private (Müşteriler veya Adminler oluşturabilir)
router.post('/', protect, authorize('musteri', 'admin'), async (req, res) => {
  try {
    const { title, description, priority, deviceInfo } = req.body;

    const fault = await Fault.create({
      title,
      description,
      priority: priority || 'orta',
      deviceInfo,
      customer: req.user.id
    });

    res.status(201).json({
      success: true,
      data: fault
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Arıza kayıtlarını listele (Rol bazlı filtreleme ile)
// @route   GET /api/faults
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { status, priority } = req.query;
    let query = {};

    // 1. Durum ve öncelik filtreleri
    if (status) {
      query.status = status;
    }
    if (priority) {
      query.priority = priority;
    }

    // 2. Rol bazlı sınırlamalar
    if (req.user.role === 'musteri') {
      // Müşteri sadece kendi oluşturduğu arızaları görebilir
      query.customer = req.user.id;
    } else if (req.user.role === 'teknisyen') {
      // Teknisyen kendisine atanan arızaları VEYA henüz kimseye atanmamış arızaları görebilir
      query.$or = [
        { technician: req.user.id },
        { technician: null }
      ];
    }
    // Admin her şeyi görebilir, filtreleme yapılmasına gerek yoktur.

    const faults = await Fault.find(query)
      .populate('customer', 'username email')
      .populate('technician', 'username email')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: faults.length,
      data: faults
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Tekil arıza detayı getir
// @route   GET /api/faults/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const fault = await Fault.findById(req.id || req.params.id)
      .populate('customer', 'username email')
      .populate('technician', 'username email')
      .populate('comments.user', 'username role');

    if (!fault) {
      return res.status(404).json({ success: false, message: 'Arıza kaydı bulunamadı' });
    }

    // Yetki kontrolü (Müşteri başkasının arızasını göremez)
    if (req.user.role === 'musteri' && fault.customer._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bu arıza kaydını görüntüleme yetkiniz yok' });
    }

    res.json({
      success: true,
      data: fault
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Arızaya teknisyen ata
// @route   PUT /api/faults/:id/assign
// @access  Private (Sadece Admin)
router.put('/:id/assign', protect, authorize('admin'), async (req, res) => {
  try {
    const { technicianId } = req.body;

    const fault = await Fault.findById(req.params.id);
    if (!fault) {
      return res.status(404).json({ success: false, message: 'Arıza kaydı bulunamadı' });
    }

    // Teknisyeni ata ve durumu 'islemde' yap (e-posta veya kullanıcı adı doğrulaması yapılabilir)
    fault.technician = technicianId || null;
    if (technicianId && fault.status === 'beklemede') {
      fault.status = 'islemde';
    } else if (!technicianId && fault.status === 'islemde') {
      fault.status = 'beklemede';
    }

    await fault.save();

    // Yeni teknisyene bildirim ekle
    if (technicianId) {
      await User.findByIdAndUpdate(technicianId, {
        $push: {
          notifications: {
            message: `"${fault.title}" başlıklı yeni bir iş ataması yapıldı.`,
            isRead: false
          }
        }
      });
    }

    const updatedFault = await Fault.findById(req.params.id)
      .populate('customer', 'username email')
      .populate('technician', 'username email');

    res.json({
      success: true,
      data: updatedFault
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Arıza önceliğini güncelle
// @route   PUT /api/faults/:id/priority
// @access  Private (Sadece Admin)
router.put('/:id/priority', protect, authorize('admin'), async (req, res) => {
  try {
    const { priority } = req.body;

    if (!['dusuk', 'orta', 'yuksek', 'kritik'].includes(priority)) {
      return res.status(400).json({ success: false, message: 'Geçersiz arıza önceliği' });
    }

    const fault = await Fault.findById(req.params.id);
    if (!fault) {
      return res.status(404).json({ success: false, message: 'Arıza kaydı bulunamadı' });
    }

    fault.priority = priority;
    
    // Yorum ekle
    fault.comments.push({
      user: req.user.id,
      comment: `Sistem Mesajı: Arıza önceliği "${priority}" olarak değiştirildi.`
    });
    
    await fault.save();

    res.json({
      success: true,
      data: fault
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Arıza durumunu güncelle
// @route   PUT /api/faults/:id/status
// @access  Private (Admin ve Teknisyen)
router.put('/:id/status', protect, authorize('admin', 'teknisyen'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!['beklemede', 'islemde', 'tamamlandi'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Geçersiz arıza durumu' });
    }

    const fault = await Fault.findById(req.params.id);
    if (!fault) {
      return res.status(404).json({ success: false, message: 'Arıza kaydı bulunamadı' });
    }

    // Teknisyen kontrolü (Eğer atanan teknisyen ise veya atanmamışsa kendisi üstlenebilir)
    if (req.user.role === 'teknisyen') {
      if (fault.technician && fault.technician.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Bu arıza başka bir teknisyene atanmış' });
      }
      // Kendisine atanmamışsa otomatik olarak üstlenir
      if (!fault.technician) {
        fault.technician = req.user.id;
      }
    }

    fault.status = status;
    await fault.save();

    res.json({
      success: true,
      data: fault
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Arızayı Tamamla (İşlemi kapat)
// @route   PUT /api/faults/:id/complete
// @access  Private (Admin ve Teknisyen)
router.put('/:id/complete', protect, authorize('admin', 'teknisyen'), async (req, res) => {
  try {
    const fault = await Fault.findById(req.params.id);
    if (!fault) {
      return res.status(404).json({ success: false, message: 'Arıza kaydı bulunamadı' });
    }

    // Teknisyen yetki kontrolü
    if (req.user.role === 'teknisyen') {
      if (fault.technician && fault.technician.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Bu arıza başka bir teknisyene atanmış' });
      }
      if (!fault.technician) {
        fault.technician = req.user.id;
      }
    }

    fault.status = 'tamamlandi';
    
    // Otomatik kapanış yorumu ekle
    fault.comments.push({
      user: req.user.id,
      comment: 'Sistem Mesajı: Arıza başarıyla tamamlandı olarak işaretlendi.'
    });

    await fault.save();

    const updatedFault = await Fault.findById(req.params.id)
      .populate('customer', 'username email')
      .populate('technician', 'username email')
      .populate('comments.user', 'username role');

    res.json({
      success: true,
      data: updatedFault
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Arızaya yorum ekle
// @route   POST /api/faults/:id/comments
// @access  Private
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment) {
      return res.status(400).json({ success: false, message: 'Yorum boş olamaz' });
    }

    const fault = await Fault.findById(req.params.id);
    if (!fault) {
      return res.status(404).json({ success: false, message: 'Arıza kaydı bulunamadı' });
    }

    // Yetki kontrolü (Müşteri sadece kendi arızasına yorum yazabilir)
    if (req.user.role === 'musteri' && fault.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bu arıza kaydına yorum yazma yetkiniz yok' });
    }

    // Yorum ekle
    fault.comments.push({
      user: req.user.id,
      comment
    });

    await fault.save();

    const updatedFault = await Fault.findById(req.params.id)
      .populate('customer', 'username email')
      .populate('technician', 'username email')
      .populate('comments.user', 'username role');

    res.json({
      success: true,
      data: updatedFault
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
