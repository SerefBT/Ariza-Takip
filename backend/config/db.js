const mongoose = require('mongoose');

// asenkron veritabanı bağlantısı
const connectDB = async () => {
  try {
    // link yoksa locale bağlan
    const dbLink = process.env.MONGO_URI || process.env.DB_LINK || 'mongodb://localhost:27017/ariza-takip';
    const conn = await mongoose.connect(dbLink);
    console.log(`MongoDB Bağlantısı Başarılı: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Bağlantı Hatası: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
