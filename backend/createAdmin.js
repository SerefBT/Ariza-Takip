const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

// Çevre değişkenlerini yükle
dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ariza_takip', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const username = process.argv[2];
    const email = process.argv[3];
    const password = process.argv[4];

    if (!username || !email || !password) {
      console.log('❌ Lütfen tüm bilgileri girin!');
      console.log('Kullanım: node createAdmin.js <kullanıcı_adı> <eposta> <şifre>');
      process.exit(1);
    }

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      console.log('❌ Bu kullanıcı adı veya e-posta zaten mevcut!');
      process.exit(1);
    }

    await User.create({
      username,
      email,
      password,
      role: 'admin',
      isApproved: true
    });

    console.log(`✅ Başarılı! "${username}" adında yeni bir Admin hesabı oluşturuldu.`);
    process.exit(0);
  } catch (error) {
    console.error('Hata:', error.message);
    process.exit(1);
  }
};

createAdmin();
