import React, { useState, useEffect } from 'react';
import { 
  Wrench, CheckCircle, Clock, AlertTriangle, LogOut, 
  Plus, X, MessageSquare, Send, User, UserCheck, 
  Settings, Shield, HardDrive, Filter, Calendar,
  Eye, EyeOff
} from 'lucide-react';

function App() {
  // --- Password Visibility State ---
  const [showPassword, setShowPassword] = useState(false);

  // --- Sunucu URL Yönetimi ---
  const defaultApiUrl = 'http://localhost:5000/api';
  const [apiUrl, setApiUrl] = useState(() => {
    return localStorage.getItem('ariza_api_url') || defaultApiUrl;
  });
  const [tempApiUrl, setTempApiUrl] = useState(apiUrl);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // --- Auth States ---
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('ariza_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => {
    return localStorage.getItem('ariza_token') || '';
  });

  // --- Screen / UI States ---
  const [view, setView] = useState(user ? 'dashboard' : 'login'); // login, register, dashboard, pendingApproval
  const [activeTab, setActiveTab] = useState('bekleyen'); // bekleyen, tamamlanan, onayBekleyen
  const [filterPriority, setFilterPriority] = useState('all'); // all, dusuk, orta, yuksek, kritik

  // --- Modal States ---
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFault, setSelectedFault] = useState(null);

  // --- Data States ---
  const [faults, setFaults] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [pendingTechnicians, setPendingTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // --- Input Forms States ---
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'musteri'
  });
  const [newFault, setNewFault] = useState({
    title: '',
    description: '',
    priority: 'orta',
    deviceInfo: ''
  });
  const [commentText, setCommentText] = useState('');

  // --- Toast Notification State ---
  const [toast, setToast] = useState({ show: false, message: '' });

  // Toast gösterme fonksiyonu
  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 3000);
  };

  // --- API İstekleri Yardımcı Fonksiyonu ---
  const apiFetch = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };

    const res = await fetch(`${apiUrl}${endpoint}`, {
      ...options,
      headers
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Bir hata oluştu');
    }
    return data;
  };

  // --- Sayfa Yüklendiğinde veya Token/API değişiminde veri çekme ---
  useEffect(() => {
    if (token && user) {
      fetchMe();
      fetchFaults();
      if (user.role === 'admin' || user.role === 'teknisyen') {
        fetchTechnicians();
      }
      if (user.role === 'admin') {
        fetchPendingTechnicians();
      }
    }
  }, [token, apiUrl]);

  // Profil ve Bildirimleri Getir
  const fetchMe = async () => {
    try {
      const res = await apiFetch('/auth/me');
      if (res.success) {
        setUser(res.user);
        localStorage.setItem('ariza_user', JSON.stringify(res.user));
        
        // Okunmamış bildirimleri kontrol et
        const unread = res.user.notifications?.filter(n => !n.isRead);
        if (unread && unread.length > 0) {
          showToast(`🔔 ${unread[unread.length - 1].message}`);
          await apiFetch('/auth/notifications/read', { method: 'PUT' });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Arızaları Listele
  const fetchFaults = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/faults');
      if (res.success) {
        setFaults(res.data);
      }
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Teknisyenleri Listele
  const fetchTechnicians = async () => {
    try {
      const res = await apiFetch('/auth/technicians');
      if (res.success) {
        setTechnicians(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Onay Bekleyen Teknisyenler
  const fetchPendingTechnicians = async () => {
    try {
      const res = await apiFetch('/auth/pending-technicians');
      if (res.success) setPendingTechnicians(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Teknisyeni Onayla
  const handleApproveTechnician = async (id) => {
    try {
      const res = await apiFetch(`/auth/approve/${id}`, { method: 'PUT' });
      if (res.success) {
        showToast(res.message);
        fetchPendingTechnicians();
        fetchTechnicians();
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  // Teknisyen Kaydını Reddet
  const handleRejectTechnician = async (id) => {
    if (!window.confirm('Bu teknisyeni reddetmek ve kaydını silmek istiyor musunuz?')) return;
    try {
      const res = await apiFetch(`/auth/reject/${id}`, { method: 'DELETE' });
      if (res.success) {
        showToast(res.message);
        fetchPendingTechnicians();
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  // Tekil Arıza Detayı Getir (ve güncelle)
  const fetchSingleFault = async (id) => {
    try {
      const res = await apiFetch(`/faults/${id}`);
      if (res.success) {
        setSelectedFault(res.data);
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  // --- Giriş & Kayıt İşlemleri ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          emailOrUsername: authForm.email,
          password: authForm.password
        })
      });
      if (res.success) {
        localStorage.setItem('ariza_token', res.token);
        localStorage.setItem('ariza_user', JSON.stringify(res.user));
        setToken(res.token);
        setUser(res.user);
        showToast(`Hoş geldiniz, ${res.user.username}!`);
        setView('dashboard');
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: authForm.username,
          email: authForm.email,
          password: authForm.password,
          role: authForm.role
        })
      });
      if (res.success) {
        // Teknisyen onay bekliyorsa özel ekran göster
        if (res.pendingApproval) {
          setView('pendingApproval');
          setShowPassword(false);
          return;
        }
        localStorage.setItem('ariza_token', res.token);
        localStorage.setItem('ariza_user', JSON.stringify(res.user));
        setToken(res.token);
        setUser(res.user);
        showToast('Kayıt işleminiz başarıyla gerçekleşti!');
        setView('dashboard');
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ariza_token');
    localStorage.removeItem('ariza_user');
    setToken('');
    setUser(null);
    setView('login');
    setFaults([]);
    showToast('Başarıyla çıkış yapıldı.');
  };

  // --- Arıza İşlemleri ---
  const handleCreateFault = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/faults', {
        method: 'POST',
        body: JSON.stringify(newFault)
      });
      if (res.success) {
        showToast('Arıza kaydı başarıyla oluşturuldu!');
        setShowCreateModal(false);
        setNewFault({ title: '', description: '', priority: 'orta', deviceInfo: '' });
        fetchFaults();
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  // Arıza Tamamla
  const handleCompleteFault = async (id) => {
    if (!window.confirm('Bu arızayı tamamlandı olarak işaretlemek istiyor musunuz?')) return;
    try {
      const res = await apiFetch(`/faults/${id}/complete`, {
        method: 'PUT'
      });
      if (res.success) {
        showToast('Arıza tamamlandı olarak işaretlendi.');
        fetchSingleFault(id);
        fetchFaults();
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  // Teknisyen Ata
  const handleAssignTechnician = async (faultId, technicianId) => {
    try {
      const res = await apiFetch(`/faults/${faultId}/assign`, {
        method: 'PUT',
        body: JSON.stringify({ technicianId })
      });
      if (res.success) {
        showToast('Teknisyen ataması güncellendi.');
        fetchSingleFault(faultId);
        fetchFaults();
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  // Öncelik Değiştir (Admin)
  const handleChangePriority = async (faultId, priority) => {
    try {
      const res = await apiFetch(`/faults/${faultId}/priority`, {
        method: 'PUT',
        body: JSON.stringify({ priority })
      });
      if (res.success) {
        showToast('Arıza önceliği güncellendi.');
        fetchSingleFault(faultId);
        fetchFaults();
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  // Yorum Ekle
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const res = await apiFetch(`/faults/${selectedFault._id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ comment: commentText })
      });
      if (res.success) {
        setCommentText('');
        fetchSingleFault(selectedFault._id);
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  // --- Sunucu Ayarlarını Kaydet ---
  const saveSettings = () => {
    localStorage.setItem('ariza_api_url', tempApiUrl);
    setApiUrl(tempApiUrl);
    setShowSettingsModal(false);
    showToast('Sunucu bağlantı adresi güncellendi.');
  };

  // --- Filtreleme İşlemleri ---
  const filteredFaults = faults.filter(fault => {
    // 1. Tab Filtresi (Bekleyen vs Tamamlanan)
    const isCompleted = fault.status === 'tamamlandi';
    if (activeTab === 'bekleyen' && isCompleted) return false;
    if (activeTab === 'tamamlanan' && !isCompleted) return false;

    // 2. Öncelik Filtresi
    if (filterPriority !== 'all' && fault.priority !== filterPriority) return false;

    return true;
  });

  // İstatistik Sayıları
  const stats = {
    bekleyen: faults.filter(f => f.status !== 'tamamlandi').length,
    tamamlanan: faults.filter(f => f.status === 'tamamlandi').length
  };

  return (
    <div className="app-container">
      {/* Toast Bildirimi */}
      <div className={`toast ${toast.show ? 'show' : ''}`}>
        <CheckCircle size={18} />
        <span>{toast.message}</span>
      </div>

      {/* --- Giriş Ekranı --- */}
      {view === 'login' && (
        <div className="auth-wrapper animate-fade-in">
          <div className="auth-header">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ padding: '16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', color: '#6366f1' }}>
                <Wrench size={40} />
              </div>
            </div>
            <h1>Arıza Takip Paneli</h1>
            <p>Devam etmek için lütfen giriş yapın</p>
          </div>

          <form onSubmit={handleLogin} className="glass-card">
            {errorMsg && (
              <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'center' }}>
                {errorMsg}
              </div>
            )}

            <div className="form-group">
              <label>E-posta veya Kullanıcı Adı</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Örn: admin veya admin@arizatakip.com"
                required
                value={authForm.email}
                onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Şifre</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="input-field" 
                  style={{ width: '100%', paddingRight: '45px' }}
                  placeholder="•••••"
                  required
                  value={authForm.password}
                  onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Giriş Yap
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Hesabınız yok mu?{' '}
            <span 
              onClick={() => {
                setErrorMsg('');
                setView('register');
                setShowPassword(false);
              }} 
              style={{ color: 'var(--accent-color)', fontWeight: '600', cursor: 'pointer' }}
            >
              Kayıt Olun
            </span>
          </p>

          {/* Ayarlar İkonu */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
            <button 
              onClick={() => {
                setTempApiUrl(apiUrl);
                setShowSettingsModal(true);
              }}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 16px' }}
            >
              <Settings size={14} /> Sunucu Ayarları
            </button>
          </div>
        </div>
      )}

      {/* --- Kayıt Ekranı --- */}
      {view === 'register' && (
        <div className="auth-wrapper animate-fade-in">
          <div className="auth-header">
            <h1>Yeni Hesap Oluştur</h1>
            <p>Arıza bildirmek veya yönetmek için kaydolun</p>
          </div>

          <form onSubmit={handleRegister} className="glass-card">
            {errorMsg && (
              <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'center' }}>
                {errorMsg}
              </div>
            )}

            <div className="form-group">
              <label>Kullanıcı Adı</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Örn: ahmet123"
                required
                value={authForm.username}
                onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>E-posta Adresi</label>
              <input 
                type="email" 
                className="input-field" 
                placeholder="Örn: ahmet@mail.com"
                required
                value={authForm.email}
                onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Şifre</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="input-field" 
                  style={{ width: '100%', paddingRight: '45px' }}
                  placeholder="Min. 6 karakter"
                  required
                  minLength={6}
                  value={authForm.password}
                  onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Hesap Türü</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div
                  onClick={() => setAuthForm({ ...authForm, role: 'musteri' })}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    border: `2px solid ${authForm.role === 'musteri' ? 'var(--status-pending)' : 'var(--border-glass)'}`,
                    background: authForm.role === 'musteri' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>👤</div>
                  <div style={{ fontWeight: '700', fontSize: '0.9rem', color: authForm.role === 'musteri' ? 'var(--status-pending)' : 'var(--text-primary)' }}>Müşteri</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Arıza Bildiren</div>
                </div>
                <div
                  onClick={() => setAuthForm({ ...authForm, role: 'teknisyen' })}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    border: `2px solid ${authForm.role === 'teknisyen' ? 'var(--status-progress)' : 'var(--border-glass)'}`,
                    background: authForm.role === 'teknisyen' ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>🔧</div>
                  <div style={{ fontWeight: '700', fontSize: '0.9rem', color: authForm.role === 'teknisyen' ? 'var(--status-progress)' : 'var(--text-primary)' }}>Teknisyen</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Arıza Onarımcı</div>
                </div>
              </div>
              {authForm.role === 'teknisyen' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--status-progress)', background: 'rgba(6,182,212,0.06)', padding: '8px 12px', borderRadius: '8px', marginTop: '4px' }}>
                  ⏳ Teknisyen hesabı yönetici onayı gerektirir
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Kaydı Tamamla
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Zaten hesabınız var mı?{' '}
            <span 
              onClick={() => {
                setErrorMsg('');
                setView('login');
                setShowPassword(false);
              }} 
              style={{ color: 'var(--accent-color)', fontWeight: '600', cursor: 'pointer' }}
            >
              Giriş Yapın
            </span>
          </p>
        </div>
      )}

      {/* --- Onay Bekleme Ekranı --- */}
      {view === 'pendingApproval' && (
        <div className="auth-wrapper animate-fade-in">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⏳</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '12px' }}>Onay Bekleniyor</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
              Teknisyen hesabınız başarıyla oluşturuldu.<br />
              Yönetici hesabınızı onayladıktan sonra giriş yapabilirsiniz.
            </p>
            <div className="glass-card" style={{ textAlign: 'left', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span style={{ fontSize: '1.2rem' }}>✅</span>
                <span>Hesabınız oluşturuldu</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'var(--status-progress)', marginTop: '10px' }}>
                <span style={{ fontSize: '1.2rem' }}>🔄</span>
                <span>Yönetici onayı bekleniyor...</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '10px' }}>
                <span style={{ fontSize: '1.2rem' }}>🔓</span>
                <span>Onay sonrası giriş yapılabilir</span>
              </div>
            </div>
            <button
              onClick={() => { setView('login'); setAuthForm({ username: '', email: '', password: '', role: 'musteri' }); }}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              Giriş Sayfasına Dön
            </button>
          </div>
        </div>
      )}

      {/* --- Dashboard Ekranı --- */}
      {view === 'dashboard' && user && (
        <div className="dashboard-wrapper animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          
          {/* Üst Menü */}
          <nav className="navbar" style={{ margin: '0 -20px 0 -20px' }}>
            <div className="nav-logo">
              <Wrench size={20} style={{ color: 'var(--accent-color)' }} />
              <span>ArızaTakip</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{user.username}</div>
                <div className={`badge ${user.role === 'admin' ? 'priority-kritik' : user.role === 'teknisyen' ? 'badge-progress' : 'badge-pending'}`} style={{ fontSize: '0.65rem', padding: '2px 8px', marginTop: '2px' }}>
                  {user.role === 'admin' ? 'Yönetici' : user.role === 'teknisyen' ? 'Teknisyen' : 'Müşteri'}
                </div>
              </div>
              <button onClick={handleLogout} className="logout-btn" title="Çıkış Yap">
                <LogOut size={20} />
              </button>
            </div>
          </nav>

          {/* Karşılama Paneli */}
          <div className="welcome-section">
            <h2>Merhaba, {user.username}</h2>
            <p>Arıza takip sisteminde güncel durumları buradan yönetebilirsiniz.</p>
          </div>

          {/* İstatistikler */}
          <div className="stats-grid">
            <div className="glass-card stat-card" onClick={() => setActiveTab('bekleyen')} style={{ cursor: 'pointer', borderBottom: activeTab === 'bekleyen' ? '2px solid var(--status-pending)' : '' }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--status-pending)' }}>
                <Clock size={20} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>Bekleyen Arıza</div>
              <div className="stat-val" style={{ color: 'var(--status-pending)' }}>{stats.bekleyen}</div>
            </div>

            <div className="glass-card stat-card" onClick={() => setActiveTab('tamamlanan')} style={{ cursor: 'pointer', borderBottom: activeTab === 'tamamlanan' ? '2px solid var(--status-completed)' : '' }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--status-completed)' }}>
                <CheckCircle size={20} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>Tamamlanan Arıza</div>
              <div className="stat-val" style={{ color: 'var(--status-completed)' }}>{stats.tamamlanan}</div>
            </div>
          </div>

          {/* Filtreler */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <Filter size={14} /> Filtrele:
            </div>
            <select 
              className="input-field select-field" 
              style={{ padding: '6px 30px 6px 12px', fontSize: '0.8rem', width: '130px', margin: 0 }}
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
            >
              <option value="all">Tüm Öncelikler</option>
              <option value="dusuk">Düşük</option>
              <option value="orta">Orta</option>
              <option value="yuksek">Yüksek</option>
              <option value="kritik">Kritik</option>
            </select>
          </div>

          {/* Sekmeler */}
          <div className="tab-container" style={{ margin: '0 0 16px 0' }}>
            <button 
              className={`tab-btn ${activeTab === 'bekleyen' ? 'active' : ''}`}
              onClick={() => setActiveTab('bekleyen')}
            >
              Bekleyen ({stats.bekleyen})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'tamamlanan' ? 'active' : ''}`}
              onClick={() => setActiveTab('tamamlanan')}
            >
              Tamamlanan ({stats.tamamlanan})
            </button>
            {user.role === 'admin' && (
              <button 
                className={`tab-btn ${activeTab === 'onayBekleyen' ? 'active' : ''}`}
                onClick={() => { setActiveTab('onayBekleyen'); fetchPendingTechnicians(); }}
                style={{ position: 'relative' }}
              >
                Onay {pendingTechnicians.length > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: '50%', fontSize: '0.65rem', padding: '1px 5px', marginLeft: '4px' }}>{pendingTechnicians.length}</span>}
              </button>
            )}
          </div>

          {/* Liste */}
          <div style={{ flex: 1 }}>
            {/* Admin: Onay Bekleyen Teknisyenler Sekmesi */}
            {activeTab === 'onayBekleyen' && user.role === 'admin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pendingTechnicians.length === 0 ? (
                  <div className="glass-card empty-state">
                    <CheckCircle size={36} style={{ color: 'var(--status-completed)' }} />
                    <p>Onay bekleyen teknisyen yok.</p>
                  </div>
                ) : pendingTechnicians.map(tech => (
                  <div key={tech._id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>🔧 {tech.username}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{tech.email}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {new Date(tech.createdAt).toLocaleDateString('tr-TR')} tarihinde kayıt oldu
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleApproveTechnician(tech._id)}
                        className="btn btn-primary"
                        style={{ padding: '8px 14px', fontSize: '0.8rem', background: 'linear-gradient(135deg, var(--status-completed), #34d399)', boxShadow: 'none' }}
                      >
                        ✓ Onayla
                      </button>
                      <button
                        onClick={() => handleRejectTechnician(tech._id)}
                        className="btn btn-danger"
                        style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                      >
                        ✕ Reddet
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Arıza Listesi */}
            {activeTab !== 'onayBekleyen' && (
            loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Yükleniyor...</div>
            ) : filteredFaults.length === 0 ? (
              <div className="glass-card empty-state">
                <AlertTriangle size={36} />
                <p>Gösterilecek arıza kaydı bulunamadı.</p>
              </div>
            ) : (
              <div className="fault-list">
                {filteredFaults.map(fault => (
                  <div 
                    key={fault._id} 
                    className="glass-card fault-item animate-fade-in"
                    onClick={() => {
                      setSelectedFault(fault);
                      setShowDetailModal(true);
                      fetchSingleFault(fault._id);
                    }}
                  >
                    <div className="fault-info">
                      <div className="fault-title">{fault.title}</div>
                      <div className="fault-desc">{fault.description}</div>
                      <div className="fault-meta">
                        <span className={`badge ${
                          fault.status === 'tamamlandi' ? 'badge-completed' : 
                          fault.status === 'islemde' ? 'badge-progress' : 'badge-pending'
                        }`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                          {fault.status === 'tamamlandi' ? 'Tamamlandı' : 
                           fault.status === 'islemde' ? 'İşlemde' : 'Beklemede'}
                        </span>
                        <span>•</span>
                        <span className={`badge priority-${fault.priority}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                          {fault.priority}
                        </span>
                        <span>•</span>
                        <span>{new Date(fault.createdAt).toLocaleDateString('tr-TR')}</span>
                      </div>
                    </div>
                    <div>
                      {fault.status === 'tamamlandi' ? (
                        <CheckCircle size={20} style={{ color: 'var(--status-completed)' }} />
                      ) : fault.status === 'islemde' ? (
                        <Clock size={20} style={{ color: 'var(--status-progress)' }} />
                      ) : (
                        <Clock size={20} style={{ color: 'var(--status-pending)' }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Floating Action Button (Müşteriler veya Adminler için arıza ekle) */}
          {(user.role === 'musteri' || user.role === 'admin') && (
            <button 
              className="fab" 
              onClick={() => setShowCreateModal(true)}
              title="Yeni Arıza Bildir"
            >
              <Plus size={24} />
            </button>
          )}
        </div>
      )}

      {/* --- MODAL: Yeni Arıza Bildir --- */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Yeni Arıza Bildirimi</h3>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateFault}>
              <div className="form-group">
                <label>Arıza Başlığı</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Arızayı özetleyen başlık"
                  required
                  value={newFault.title}
                  onChange={e => setNewFault({ ...newFault, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Cihaz / Model Bilgisi</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Marka, model veya seri numarası"
                  value={newFault.deviceInfo}
                  onChange={e => setNewFault({ ...newFault, deviceInfo: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Öncelik Seviyesi</label>
                <select 
                  className="input-field select-field"
                  value={newFault.priority}
                  onChange={e => setNewFault({ ...newFault, priority: e.target.value })}
                >
                  <option value="dusuk">Düşük</option>
                  <option value="orta">Orta</option>
                  <option value="yuksek">Yüksek</option>
                  <option value="kritik">Kritik</option>
                </select>
              </div>

              <div className="form-group">
                <label>Detaylı Açıklama</label>
                <textarea 
                  className="input-field" 
                  rows="4" 
                  placeholder="Arızanın detaylarını, ne zaman başladığını yazın..."
                  required
                  style={{ resize: 'none' }}
                  value={newFault.description}
                  onChange={e => setNewFault({ ...newFault, description: e.target.value })}
                ></textarea>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                Kayıt Oluştur
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Arıza Detayı & Yorumlar --- */}
      {showDetailModal && selectedFault && (
        <div className="modal-overlay" onClick={() => {
          setShowDetailModal(false);
          setSelectedFault(null);
        }}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{selectedFault.title}</h3>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <span className={`badge ${
                    selectedFault.status === 'tamamlandi' ? 'badge-completed' : 
                    selectedFault.status === 'islemde' ? 'badge-progress' : 'badge-pending'
                  }`}>
                    {selectedFault.status === 'tamamlandi' ? 'Tamamlandı' : 
                     selectedFault.status === 'islemde' ? 'İşlemde' : 'Beklemede'}
                  </span>
                  <span className={`badge priority-${selectedFault.priority}`}>
                    {selectedFault.priority}
                  </span>
                </div>
              </div>
              <button className="close-btn" onClick={() => {
                setShowDetailModal(false);
                setSelectedFault(null);
              }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div className="detail-section">
                <h4>Cihaz / Donanım</h4>
                <div className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HardDrive size={16} style={{ color: 'var(--text-secondary)' }} />
                  {selectedFault.deviceInfo || 'Belirtilmedi'}
                </div>
              </div>

              <div className="detail-section">
                <h4>Açıklama</h4>
                <div className="detail-value" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  {selectedFault.description}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="detail-section">
                  <h4>Bildiren Müşteri</h4>
                  <div className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                    <User size={14} style={{ color: 'var(--text-secondary)' }} />
                    {selectedFault.customer?.username || 'Bilinmiyor'}
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Sorumlu Teknisyen</h4>
                  <div className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                    <UserCheck size={14} style={{ color: 'var(--text-secondary)' }} />
                    {selectedFault.technician?.username || 'Henüz Atanmadı'}
                  </div>
                </div>
              </div>

              {/* TARİH */}
              <div className="detail-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <Calendar size={14} />
                  <span>Kayıt Tarihi: {new Date(selectedFault.createdAt).toLocaleString('tr-TR')}</span>
                </div>
              </div>

              {/* ADMIN YETKİLERİ: TEKNİSYEN ATAMA VE ÖNCELİK */}
              {user.role === 'admin' && selectedFault.status !== 'tamamlandi' && (
                <div className="detail-section" style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ color: 'var(--accent-color)' }}>Teknisyen Ataması Yap</h4>
                    <select 
                      className="input-field select-field" 
                      style={{ width: '100%', marginTop: '6px', background: 'var(--bg-secondary)' }}
                      value={selectedFault.technician?._id || ''}
                      onChange={e => handleAssignTechnician(selectedFault._id, e.target.value)}
                    >
                      <option value="">Atamayı Kaldır (Boş Bırak)</option>
                      {technicians.map(tech => (
                        <option key={tech._id} value={tech._id}>
                          {tech.username} ({tech.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <h4 style={{ color: 'var(--accent-color)' }}>Öncelik Seviyesini Değiştir</h4>
                    <select 
                      className="input-field select-field" 
                      style={{ width: '100%', marginTop: '6px', background: 'var(--bg-secondary)' }}
                      value={selectedFault.priority}
                      onChange={e => handleChangePriority(selectedFault._id, e.target.value)}
                    >
                      <option value="dusuk">Düşük</option>
                      <option value="orta">Orta</option>
                      <option value="yuksek">Yüksek</option>
                      <option value="kritik">Kritik</option>
                    </select>
                  </div>

                </div>
              )}

              {/* ARİZA TAMAMLA BUTONU (Teknisyen veya Admin görebilir) */}
              {(user.role === 'admin' || user.role === 'teknisyen') && selectedFault.status !== 'tamamlandi' && (
                <button 
                  onClick={() => handleCompleteFault(selectedFault._id)}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, var(--status-completed), #34d399)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)', marginTop: '8px' }}
                >
                  <CheckCircle size={18} /> Arıza Tamamla
                </button>
              )}

              {/* YORUMLAR / HAREKET GEÇMİŞİ */}
              <div className="detail-section" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '16px', marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <MessageSquare size={16} style={{ color: 'var(--text-secondary)' }} />
                  <h4 style={{ margin: 0 }}>İşlem Geçmişi & Yorumlar ({selectedFault.comments?.length || 0})</h4>
                </div>

                <div className="comments-list">
                  {(!selectedFault.comments || selectedFault.comments.length === 0) ? (
                    <div style={{ textStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '10px', textAlign: 'center' }}>
                      Henüz işlem kaydı veya yorum girilmemiş.
                    </div>
                  ) : (
                    selectedFault.comments.map(c => (
                      <div key={c._id} className="comment-item">
                        <div className="comment-header">
                          <span className="comment-user">
                            {c.user?.username || 'Bilinmiyor'}{' '}
                            <span style={{ fontWeight: 'normal', opacity: 0.7, fontSize: '0.7rem' }}>
                              ({c.user?.role === 'admin' ? 'Yönetici' : c.user?.role === 'teknisyen' ? 'Teknisyen' : 'Müşteri'})
                            </span>
                          </span>
                          <span>{new Date(c.createdAt).toLocaleDateString('tr-TR')} {new Date(c.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="comment-text">{c.comment}</div>
                      </div>
                    ))
                  )}
                </div>

                {/* Yorum Ekleme Formu */}
                <form onSubmit={handleAddComment} className="comment-input-container">
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Bir yorum veya işlem notu yazın..."
                    required
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '10px' }}>
                    <Send size={16} />
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: Sunucu Bağlantı Ayarları --- */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Sunucu Bağlantı Ayarları</h3>
              <button className="close-btn" onClick={() => setShowSettingsModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>
                Uygulamanın APK sürümünü telefonunuza yüklediğinizde, bilgisayarınızda çalışan backend sunucusuna bağlanabilmesi için yerel IP adresinizi (örn: <code>http://192.168.1.100:5000/api</code>) girmelisiniz.
              </p>

              <div className="form-group">
                <label>API Sunucu Adresi</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="http://localhost:5000/api"
                  value={tempApiUrl}
                  onChange={e => setTempApiUrl(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button 
                  onClick={() => setTempApiUrl(defaultApiUrl)} 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                >
                  Varsayılana Dön
                </button>
                <button 
                  onClick={saveSettings} 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
