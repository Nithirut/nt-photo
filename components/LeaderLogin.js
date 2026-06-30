import { useState, useRef } from 'react';
import { LEADER_CT_CODES, normalizeName, normalizeCtCode, normalizeUnit, validateLeaderForm } from '../lib/leaderAccess';

// Agency Leader login form. UI + client-side SHAPE validation only; the real
// eligibility decision and session are server-side. On success the API sets an
// HttpOnly cookie and returns { ok:true } and we navigate to /leader. Failures
// are generic and never reveal which field was wrong or whether a name exists.
// The per-field messages below are FORMAT/required hints shown before submit —
// they say nothing about eligibility.
const FIELD_MSG = {
  name: 'กรุณากรอกชื่อจริง',
  unit: 'กรุณากรอกหน่วย 866 หรือ 1149',
  ctCode: 'กรุณาเลือกรหัสทัพ',
};
const ERR_ELIGIBILITY = 'ข้อมูลไม่ตรงกับรายชื่อผู้มีสิทธิ์';
const ERR_CONFIG = 'ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล';
const ERR_RATE = 'มีการพยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
const ERR_NETWORK = 'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';

export default function LeaderLogin() {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [ctCode, setCtCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | submitting | error
  const [message, setMessage] = useState('');
  const nameRef = useRef(null);
  const unitRef = useRef(null);
  const ctRef = useRef(null);
  const summaryRef = useRef(null);

  const invalid = (k) => fieldErrors.includes(k);
  const submitting = status === 'submitting';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const payload = { name: normalizeName(name), unit: normalizeUnit(unit), ctCode: normalizeCtCode(ctCode) };
    const errors = validateLeaderForm(payload);
    setFieldErrors(errors);
    if (errors.length > 0) {
      setStatus('error');
      setMessage('');
      requestAnimationFrame(() => { if (summaryRef.current) summaryRef.current.focus(); });
      return;
    }
    setStatus('submitting');
    setMessage('');
    try {
      const res = await fetch('/api/leader/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        let data = {};
        try { data = await res.json(); } catch (e2) { data = {}; }
        if (data && data.ok) {
          window.location.href = '/leader';
          return;
        }
      }
      // Map status → generic message (never reveal which field).
      if (res.status === 503) setMessage(ERR_CONFIG);
      else if (res.status === 429) setMessage(ERR_RATE);
      else setMessage(ERR_ELIGIBILITY);
      setStatus('error');
    } catch (e3) {
      setStatus('error');
      setMessage(ERR_NETWORK);
    }
  };

  const hasFieldErrors = fieldErrors.length > 0;

  return (
    <main className="leader-wrap">
      <style>{`
        /* Global viewport reset (margins, dark full-bleed background, box-sizing)
           lives in styles/globals.css so every route is covered. Only
           page-specific styles remain here. */
        .leader-wrap {
          width:100%; min-height:100vh; min-height:100dvh; overflow-x:hidden;
          background:radial-gradient(circle at 50% 0%, #15140f 0%, #0a0a0a 62%);
          color:#f0ece4; font-family:'Sarabun',sans-serif;
          display:flex; align-items:center; justify-content:center;
          padding:24px 16px calc(24px + env(safe-area-inset-bottom));
        }
        .leader-card {
          width:100%; max-width:460px;
          background:linear-gradient(135deg,#1a1813,#141414);
          border:1px solid rgba(201,168,76,0.35); border-radius:20px;
          padding:28px 22px; box-shadow:0 18px 50px rgba(0,0,0,0.55);
        }
        .leader-badge {
          display:inline-block; font-size:11px; letter-spacing:3px; color:#c9a84c;
          border:1px solid rgba(201,168,76,0.5); border-radius:20px; padding:5px 12px; text-transform:uppercase;
        }
        .leader-wordmark { font-family:'Playfair Display',serif; font-size:22px; font-weight:700; letter-spacing:2px; margin-top:16px; }
        .leader-wordmark span { color:#c9a84c; }
        .leader-title { font-family:'Playfair Display',serif; font-size:21px; font-weight:700; line-height:1.3; margin:10px 0 2px; }
        .leader-sub { font-size:13px; letter-spacing:4px; color:#c9a84c; text-transform:uppercase; }
        .leader-desc { font-size:13px; color:#bcb4a4; line-height:1.65; margin:12px 0 2px; }
        .leader-error-summary { margin:16px 0 0; padding:11px 14px; border-radius:12px; background:rgba(201,168,76,0.12); border:1px solid rgba(201,168,76,0.5); color:#f3e9cf; font-size:13px; line-height:1.6; }
        .leader-error-summary:focus-visible { outline:2px solid #c9a84c; outline-offset:2px; }
        .leader-message { margin:16px 0 0; padding:11px 14px; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.14); color:#e7dfce; font-size:13px; line-height:1.6; }
        .leader-form { display:flex; flex-direction:column; gap:16px; margin-top:18px; }
        .leader-field { display:flex; flex-direction:column; gap:6px; }
        .leader-field label { font-size:13px; font-weight:600; color:#e7dfce; }
        .leader-field input, .leader-field select {
          width:100%; min-height:48px; padding:12px 14px; border-radius:12px;
          background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.16);
          color:#f0ece4; font-family:'Sarabun',sans-serif; font-size:15px;
        }
        .leader-field select {
          appearance:none; -webkit-appearance:none; padding-right:40px;
          /* Solid dark fill + dark color-scheme so the native popup and its
             options are legible (no white-on-white) on Windows/Chrome + mobile. */
          background-color:#15140f; color:#f0ece4; -webkit-text-fill-color:#f0ece4;
          color-scheme:dark; border-color:rgba(201,168,76,0.45);
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='9' viewBox='0 0 14 9'%3E%3Cpath d='M1 1l6 6 6-6' fill='none' stroke='%23c9a84c' stroke-width='2'/%3E%3C/svg%3E");
          background-repeat:no-repeat; background-position:right 14px center;
        }
        .leader-field select option {
          background-color:#15140f; color:#f0ece4; -webkit-text-fill-color:#f0ece4;
        }
        .leader-field select:disabled { color:#cfc8ba; -webkit-text-fill-color:#cfc8ba; opacity:1; }
        .leader-field input::placeholder { color:#7d7565; }
        .leader-field input:focus-visible, .leader-field select:focus-visible { outline:2px solid #c9a84c; outline-offset:2px; border-color:#c9a84c; }
        .leader-field input[aria-invalid="true"], .leader-field select[aria-invalid="true"] { border-color:#d98b8b; }
        .leader-help { font-size:11px; color:#968d7b; line-height:1.5; }
        .leader-submit {
          min-height:48px; margin-top:4px; border:none; border-radius:24px;
          background:#c9a84c; color:#1a1304; font-family:'Sarabun',sans-serif;
          font-size:15px; font-weight:700; cursor:pointer; transition:background-color .18s ease;
        }
        .leader-submit:hover:not(:disabled) { background:#d8b95e; }
        .leader-submit:disabled { opacity:.6; cursor:not-allowed; }
        .leader-submit:focus-visible { outline:2px solid #ffffff; outline-offset:2px; }
        .leader-privacy { margin-top:16px; font-size:11px; color:#8a8273; text-align:center; line-height:1.6; }
        @media (prefers-reduced-motion: reduce) { .leader-submit { transition:none; } }
      `}</style>

      <section className="leader-card" aria-labelledby="leader-title">
        <div className="leader-badge">PRIVATE ACCESS</div>
        <div className="leader-wordmark">NT <span>Photo</span></div>
        <h1 id="leader-title" className="leader-title">Login for Agency Leader Numthong</h1>
        <div className="leader-sub">NT ACADEMY</div>
        <p className="leader-desc">กรอกข้อมูลเพื่อเข้าสู่พื้นที่กิจกรรมสำหรับผู้บริหารเครือนำทอง</p>

        {hasFieldErrors && (
          <div className="leader-error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
            {fieldErrors.map((k) => FIELD_MSG[k]).join(' · ')}
          </div>
        )}
        {status === 'error' && message && (
          <div className="leader-message" role="alert">{message}</div>
        )}

        <form className="leader-form" onSubmit={handleSubmit} noValidate>
          <div className="leader-field">
            <label htmlFor="leader-name">ชื่อจริง</label>
            <input
              id="leader-name" ref={nameRef} type="text" autoComplete="off"
              placeholder="กรอกชื่อจริง" value={name}
              onChange={(e) => setName(e.target.value)}
              required aria-required="true" aria-invalid={invalid('name')}
              aria-describedby="leader-name-help" disabled={submitting}
            />
            <div id="leader-name-help" className="leader-help">กรอกเฉพาะชื่อจริง ไม่ต้องใส่นามสกุล</div>
          </div>

          <div className="leader-field">
            <label htmlFor="leader-unit">หน่วย</label>
            <input
              id="leader-unit" ref={unitRef} type="text"
              inputMode="numeric" pattern="[0-9]*" autoComplete="off"
              placeholder="866 หรือ 1149" value={unit}
              onChange={(e) => setUnit(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              required aria-required="true" aria-invalid={invalid('unit')}
              aria-describedby="leader-unit-help" disabled={submitting}
            />
            <div id="leader-unit-help" className="leader-help">กรอกหน่วยเป็นตัวเลข: 866 หรือ 1149</div>
          </div>

          <div className="leader-field">
            <label htmlFor="leader-ct">รหัสทัพ</label>
            <select
              id="leader-ct" ref={ctRef} value={ctCode}
              onChange={(e) => setCtCode(e.target.value)}
              required aria-required="true" aria-invalid={invalid('ctCode')}
              aria-describedby="leader-ct-help" disabled={submitting}
            >
              <option value="" disabled>เลือกรหัสทัพ</option>
              {LEADER_CT_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div id="leader-ct-help" className="leader-help">เลือกรหัสทัพของคุณ (CT1–CT15)</div>
          </div>

          <button type="submit" className="leader-submit" disabled={submitting}>
            {submitting ? 'กำลังตรวจสอบ…' : 'AL PHOTO'}
          </button>
        </form>

        <p className="leader-privacy">พื้นที่ส่วนตัวสำหรับผู้บริหารเครือนำทองที่ได้รับสิทธิ์เท่านั้น</p>
      </section>
    </main>
  );
}
