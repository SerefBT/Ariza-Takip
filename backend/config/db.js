const mongoose = require('mongoose');

// asenkron veritabanı bağlantısı
const connectDB = async () => {
  try {
    // link yoksa locale bağlan
    const conn = await mongoose.connect(process.env.DB_LINK || 'mongodb://localhost:27017/ariza-takip');
    console.log(`MongoDB Bağlantısı Başarılı: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Bağlantı Hatası: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
