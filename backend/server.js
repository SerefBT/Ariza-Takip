const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// gizli ayarları okutuyoruz
dotenv.config();

// veritabanına bağlan
connectDB();

const app = express();

// veri okuma ayarları
app.use(cors());
app.use(express.json());

// sayfa yönlendirmeleri
app.use('/api/auth', require('./routes/auth'));
app.use('/api/faults', require('./routes/fault'));

// Temel ana dizin kontrolü
app.get('/', (req, res) => {
  res.send('Arıza Takip Uygulaması Backend API çalışıyor...');
});

// Hata Yakalama Middleware'i
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Sunucu tarafında bir hata oluştu',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// port numarası belirliyoruz
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda aktif edildi.`);
});
