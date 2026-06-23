const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Kullanıcı adı zorunludur'],
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'E-posta zorunludur'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Lütfen geçerli bir e-posta adresi girin'
    ]
  },
  password: {
    type: String,
    required: [true, 'Şifre zorunludur'],
    minlength: 6,
    select: false // Normal sorgularda şifreyi gizle
  },
  role: {
    type: String,
    enum: ['admin', 'teknisyen', 'musteri'],
    default: 'musteri'
  },
  isApproved: {
    type: Boolean,
    default: true // Müşteriler otomatik onaylı, teknisyenler false olarak kayıt edilecek
  },
  notifications: [{
    message: String,
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Şifreyi kaydetmeden önce hash'le
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Şifre karşılaştırma metodu
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
