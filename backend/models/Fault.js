const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  comment: {
    type: String,
    required: [true, 'Yorum alanı boş bırakılamaz']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const FaultSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Arıza başlığı zorunludur'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Arıza açıklaması zorunludur']
  },
  status: {
    type: String,
    enum: ['beklemede', 'islemde', 'tamamlandi'],
    default: 'beklemede'
  },
  priority: {
    type: String,
    enum: ['dusuk', 'orta', 'yuksek', 'kritik'],
    default: 'orta'
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  technician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  deviceInfo: {
    type: String,
    trim: true
  },
  comments: [CommentSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Güncellendiğinde updatedAt alanını güncelle
FaultSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Fault', FaultSchema);
