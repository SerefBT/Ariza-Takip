const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Fault = require('./models/Fault');

dotenv.config();

const seedData = async () => {
  try {
    // Veri tabanına bağlan
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ariza-takip');
    console.log('MongoDB Bağlantısı Kuruldu (Seed için)...');

    // Mevcut verileri temizle
    await User.deleteMany();
    await Fault.deleteMany();
    console.log('Eski veriler temizlendi.');

    // 1. Kullanıcıları Oluştur
    const admin = await User.create({
      username: 'admin',
      email: 'admin@arizatakip.com',
      password: 'adminpassword',
      role: 'admin',
      isApproved: true
    });

    const technician1 = await User.create({
      username: 'teknisyen1',
      email: 'teknisyen1@arizatakip.com',
      password: 'teknisyenpassword',
      role: 'teknisyen',
      isApproved: true
    });

    const technician2 = await User.create({
      username: 'teknisyen2',
      email: 'teknisyen2@arizatakip.com',
      password: 'teknisyenpassword',
      role: 'teknisyen',
      isApproved: true
    });

    const customer1 = await User.create({
      username: 'ahmet_musteri',
      email: 'ahmet@musterimail.com',
      password: 'customerpassword',
      role: 'musteri',
      isApproved: true
    });

    const customer2 = await User.create({
      username: 'mehmet_musteri',
      email: 'mehmet@musterimail.com',
      password: 'customerpassword',
      role: 'musteri',
      isApproved: true
    });

    console.log('Kullanıcılar başarıyla yüklendi.');

    // 2. Örnek Arızaları Oluştur
    const fault1 = await Fault.create({
      title: 'Klima Soğutmuyor',
      description: 'Ofisteki klima açık olmasına rağmen sıcak hava üflüyor ve dış üniteden garip bir ses geliyor.',
      status: 'beklemede',
      priority: 'yuksek',
      customer: customer1._id,
      deviceInfo: 'Arçelik Inverter 12000 BTU'
    });

    const fault2 = await Fault.create({
      title: 'İnternet Bağlantısı Sürekli Kopuyor',
      description: 'Modem ışıkları yanıyor ama Wi-Fi üzerinden bağlanan cihazlar 5 dakikada bir kopma yaşıyor.',
      status: 'islemde',
      priority: 'orta',
      customer: customer2._id,
      technician: technician1._id,
      deviceInfo: 'TP-Link VR400 DSL Modem'
    });

    const fault3 = await Fault.create({
      title: 'Yazıcı Kırmızı Işık Yakıyor',
      description: 'Yazıcı açıldığında kırmızı uyarı ışığı yanıp sönüyor ve bilgisayar "Kartuş Hatası" veriyor.',
      status: 'tamamlandi',
      priority: 'dusuk',
      customer: customer1._id,
      technician: technician2._id,
      deviceInfo: 'HP LaserJet Pro M15w',
      comments: [
        {
          user: technician2._id,
          comment: 'Kartuş çıkarıldı, çipleri temizlendi ve tekrar takıldı. Test çıktısı başarıyla alındı.'
        },
        {
          user: technician2._id,
          comment: 'Sistem Mesajı: Arıza başarıyla tamamlandı olarak işaretlendi.'
        }
      ]
    });

    console.log('Örnek arızalar başarıyla yüklendi.');
    console.log('Veri tabanı başarıyla dolduruldu (Seeding Done)!');
    process.exit();
  } catch (error) {
    console.error('Seed hatası:', error);
    process.exit(1);
  }
};

seedData();
