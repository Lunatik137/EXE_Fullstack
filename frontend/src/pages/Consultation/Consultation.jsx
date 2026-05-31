import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { StoreContext } from '../../context/StoreContext';
import { useSearchParams } from 'react-router-dom';
import './Consultation.css';

const getDegrees = (title) => {
  const parts = title.split('.');
  return parts.map(p => {
    if (p === 'ThS') return 'Thạc Sĩ';
    if (p === 'BS')  return 'Bác Sĩ';
    if (p === 'CKI') return 'CKI';
    if (p === 'CKII') return 'CKII';
    if (p === 'TS')  return 'Tiến Sĩ';
    if (p === 'PGS') return 'Phó Giáo Sư';
    if (p === 'GS')  return 'Giáo Sư';
    return p;
  }).filter(Boolean);
};

const Consultation = () => {
  const { url } = useContext(StoreContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [doctors, setDoctors]               = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await axios.get(`${url}/api/doctors`);
        if (res.data.success) setDoctors(res.data.doctors);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, [url]);

  // Auto-select doctor from URL param
  useEffect(() => {
    const doctorId = searchParams.get('doctor');
    if (!doctorId || !doctors.length || loading) return;
    const found = doctors.find(d => d._id === doctorId);
    if (found && (!selectedDoctor || selectedDoctor._id !== doctorId)) {
      setSelectedDoctor(found);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctors, loading]);

  const getDoctorImageUrl = (image) => `${url}/uploads/doctors/${image}`;

  const handleSelectDoctor = (doctor) => {
    setSearchParams({ doctor: doctor._id });
    setSelectedDoctor(doctor);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setSelectedDoctor(null);
    setSearchParams({});
  };

  if (loading) {
    return (
      <div className="consultation-loading">
        <div className="consultation-spinner" />
        <p>Đang tải danh sách chuyên gia...</p>
      </div>
    );
  }

  // ── Doctor detail view ──────────────────────────────────────────────────────
  if (selectedDoctor) {
    return (
      <div className="consultation-detail-page">
        <button className="consultation-back-btn" onClick={handleBack}>
          ← Quay lại danh sách
        </button>

        <div className="consultation-detail-layout">
          {/* Left: Doctor Info */}
          <div className="doctor-detail-card">
            <div className="doctor-detail-header">
              <img
                src={getDoctorImageUrl(selectedDoctor.image)}
                alt={selectedDoctor.name}
                className="doctor-detail-img"
                onError={e => { e.target.src = ''; e.target.style.display = 'none'; }}
              />
              <div>
                <h2 className="doctor-detail-name">
                  {selectedDoctor.title} {selectedDoctor.name}
                </h2>
                <div className="doctor-detail-meta">
                  {getDegrees(selectedDoctor.title).map(deg => (
                    <span key={deg} className="doctor-meta-tag">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 3H8v4h8V3z"/></svg>
                      {deg}
                    </span>
                  ))}
                  <span className="doctor-meta-tag">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                    {selectedDoctor.specialty}
                  </span>
                </div>
              </div>
            </div>

            {selectedDoctor.bio && (
              <div className="doctor-detail-section">
                <p className="doctor-bio-text">{selectedDoctor.bio}</p>
              </div>
            )}

            {selectedDoctor.positions?.length > 0 && (
              <div className="doctor-detail-section">
                <h4 className="doctor-section-title">Chức Vụ</h4>
                <ul className="doctor-list">
                  {selectedDoctor.positions.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}

            {selectedDoctor.education?.length > 0 && (
              <div className="doctor-detail-section">
                <h4 className="doctor-section-title">Học Vị & Đào Tạo</h4>
                <ul className="doctor-list">
                  {selectedDoctor.education.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {selectedDoctor.experience?.length > 0 && (
              <div className="doctor-detail-section">
                <h4 className="doctor-section-title">Kinh Nghiệm</h4>
                <ul className="doctor-list">
                  {selectedDoctor.experience.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {selectedDoctor.workplaces?.length > 0 && (
              <div className="doctor-detail-section">
                <h4 className="doctor-section-title">Nơi Công Tác</h4>
                <ul className="doctor-list">
                  {selectedDoctor.workplaces.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {selectedDoctor.expertise?.length > 0 && (
              <div className="doctor-detail-section">
                <h4 className="doctor-section-title">Chuyên Môn</h4>
                <ul className="doctor-list">
                  {selectedDoctor.expertise.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            )}

            {selectedDoctor.research?.length > 0 && (
              <div className="doctor-detail-section">
                <h4 className="doctor-section-title">Nghiên Cứu Khoa Học</h4>
                <ol className="doctor-list doctor-list-ordered">
                  {selectedDoctor.research.map((r, i) => <li key={i}>{r}</li>)}
                </ol>
              </div>
            )}
          </div>

          {/* Right: Coming Soon */}
          <div className="consultation-form-card">
            <div className="coming-soon-panel">
              <div className="coming-soon-icon">
                <svg className="cs-icon-svg" width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect className="cs-icon-body" x="6" y="16" width="60" height="50" rx="10"/>
                  <rect className="cs-icon-header" x="6" y="16" width="60" height="20" rx="10"/>
                  <rect className="cs-icon-header" x="6" y="27" width="60" height="9"/>
                  <rect className="cs-icon-pin" x="22" y="8" width="7" height="16" rx="3.5"/>
                  <rect className="cs-icon-pin" x="43" y="8" width="7" height="16" rx="3.5"/>
                  <circle className="cs-icon-dot" cx="22" cy="46" r="4"/>
                  <circle className="cs-icon-dot" cx="36" cy="46" r="4"/>
                  <circle className="cs-icon-dot-active" cx="50" cy="46" r="4"/>
                  <circle className="cs-icon-dot" cx="22" cy="58" r="4"/>
                  <circle className="cs-icon-dot" cx="36" cy="58" r="4"/>
                </svg>
              </div>
              <div className="coming-soon-badge">Sắp ra mắt</div>
              <h3 className="coming-soon-title">Đặt lịch tư vấn</h3>
              <p className="coming-soon-desc">
                Tính năng đặt lịch tư vấn 1:1 với chuyên gia đang được hoàn thiện và sẽ sớm ra mắt.
                Theo dõi GreenPath để không bỏ lỡ!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Doctor list ─────────────────────────────────────────────────────────────
  return (
    <div className="consultation-page">
      <div className="consultation-header">
        <h1>Đội ngũ chuyên gia</h1>
        <p>Tư vấn 1:1 với đội ngũ bác sĩ và chuyên gia dinh dưỡng của GreenPath — <span className="coming-soon-inline-badge">Sắp ra mắt</span></p>
      </div>

      <div className="doctors-grid">
        {doctors.map(doctor => (
          <div key={doctor._id} className="doctor-card">
            <div className="doctor-card-img-wrap">
              <img
                src={getDoctorImageUrl(doctor.image)}
                alt={doctor.name}
                className="doctor-card-img"
                onError={e => {
                  e.target.onerror = null;
                  e.target.src = '';
                  e.target.parentElement.innerHTML =
                    '<div class="doctor-card-img-placeholder">👨‍⚕️</div>';
                }}
              />
            </div>
            <div className="doctor-card-body">
              <h3 className="doctor-card-name">{doctor.title} {doctor.name}</h3>
              <div className="doctor-card-tags">
                {getDegrees(doctor.title).map(deg => (
                  <span key={deg} className="doctor-card-tag">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 3H8v4h8V3z"/></svg>
                    {deg}
                  </span>
                ))}
                <span className="doctor-card-tag">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                  {doctor.specialty}
                </span>
              </div>
              {doctor.bio && <p className="doctor-card-bio">{doctor.bio}</p>}
            </div>
            <div className="doctor-card-footer">
              <button
                className="doctor-card-btn"
                onClick={() => handleSelectDoctor(doctor)}
              >
                Xem thông tin
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Consultation;
