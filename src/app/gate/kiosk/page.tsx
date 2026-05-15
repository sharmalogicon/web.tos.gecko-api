"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

/* ──────────────────────────────────────────────────────────────────────────
   Prefill handoff — kiosk → /gate/eir-in (or /gate/eir-out)

   Kiosk writes the scanned-appointment data to sessionStorage under
   GATE_PREFILL_KEY, then router.push()'s to the gate form. The form reads
   the key once on mount and pre-populates fields. Key auto-clears after
   read so a refresh doesn't re-fill.
   ────────────────────────────────────────────────────────────────────────── */

export const GATE_PREFILL_KEY = 'gecko.gate.kioskPrefill';

/* ──────────────────────────────────────────────────────────────────────────
   Gate Kiosk — driver self-service QR scan at the gatehouse.

   Hardware target: USB keyboard-wedge QR scanner (Honeywell 1900, Zebra DS2208,
   Symcode SR50). Acts like a keyboard — focuses our hidden input, types the QR
   payload, presses Enter. Zero driver-side software.

   Tablet fallback: in-browser camera via `qr-scanner` lib (Phase 2).

   Token format: GECKO:<base64-of-JSON> — JSON contains appointment + container
   + driver context. Real production tokens are HMAC-signed and time-bound.
   ────────────────────────────────────────────────────────────────────────── */

interface GateToken {
  v: number;                      // schema version
  apt: string;                    // appointment ID
  tnt: string;                    // tenant
  drv: string;                    // driver name
  hau: string;                    // haulier
  plt: string;                    // truck plate
  cnt?: string;                   // container number (blank for empty pickup)
  iso?: string;                   // ISO size/type
  dir: 'IN' | 'OUT';              // direction
  ot:  string;                    // order type code
  lane?: string;                  // suggested lane
  slot?: string;                  // yard slot (export)
  cust?: string;                  // customer / consignee
  exp:  number;                   // expiry unix ms
  sig?: string;                   // signature (mock — production uses HMAC)
}

function encodeToken(t: GateToken): string {
  // Base64-encode the JSON. Production: signed JWT or similar.
  const json = JSON.stringify(t);
  if (typeof window !== 'undefined') {
    return 'GECKO:' + btoa(json);
  }
  return 'GECKO:' + json;
}

function parseToken(raw: string): GateToken | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('GECKO:')) return { error: 'Not a Gecko gate token' };
  try {
    const b64 = trimmed.slice(6);
    const json = atob(b64);
    const t = JSON.parse(json) as GateToken;
    if (!t.apt || !t.drv || !t.plt) return { error: 'Token missing required fields' };
    if (t.exp && t.exp < Date.now()) return { error: 'Appointment slot has expired' };
    return t;
  } catch {
    return { error: 'Could not decode token' };
  }
}

/* ── Demo sample tokens — for the simulator panel ───────────────────────── */

const SAMPLE_TOKENS: { label: string; description: string; token: GateToken }[] = [
  {
    label: 'Somchai Trucks — Laden Import',
    description: 'IMP CY/CY · FCL Receive · Maersk · KCE Electronics',
    token: {
      v: 1, apt: 'APT-2026-05-18-0042', tnt: 'lcb-icd',
      drv: 'Somchai Wongsa', hau: 'Somchai Transport Co., Ltd.', plt: '70-1234',
      cnt: 'MAEU7234561', iso: '42G1', dir: 'IN', ot: 'IMP CY/CY',
      lane: 'IN-03', slot: undefined, cust: 'KCE Electronics PCL',
      exp: Date.now() + 30 * 60 * 1000,
    },
  },
  {
    label: 'Anan Logistics — Empty Return',
    description: 'IMP LOLO CR · Empty Receive · ONE · CP Foods',
    token: {
      v: 1, apt: 'APT-2026-05-18-0058', tnt: 'lcb-icd',
      drv: 'Anan Phromsri', hau: 'Anan Logistics Group', plt: '70-5678',
      cnt: 'ONEU3398472', iso: '42G1', dir: 'IN', ot: 'IMP LOLO CR (return)',
      lane: 'IN-02', cust: 'CP Foods Co., Ltd.',
      exp: Date.now() + 60 * 60 * 1000,
    },
  },
  {
    label: 'Prayuth Express — Reefer Export Pickup',
    description: 'EXP CY/CY · Empty Delivery · CMA CGM · Thai Union Group',
    token: {
      v: 1, apt: 'APT-2026-05-18-0061', tnt: 'lcb-icd',
      drv: 'Prayuth Saetang', hau: 'Prayuth Express Co.', plt: '70-9012',
      cnt: undefined, iso: '45R1', dir: 'OUT', ot: 'EXP CY/CY (empty out)',
      lane: 'OUT-01', slot: 'RF-04-B-1', cust: 'Thai Union Group PCL',
      exp: Date.now() + 90 * 60 * 1000,
    },
  },
  {
    label: 'Expired token (rejection demo)',
    description: 'Same driver but appointment slot lapsed 30 minutes ago',
    token: {
      v: 1, apt: 'APT-2026-05-18-0040', tnt: 'lcb-icd',
      drv: 'Boon Boonsri', hau: 'Boon Trucking', plt: '70-3344',
      cnt: 'COSU9981233', iso: '22G1', dir: 'IN', ot: 'IMP CY/CY',
      lane: 'IN-03',
      exp: Date.now() - 30 * 60 * 1000,
    },
  },
];

/* ── Kiosk states ───────────────────────────────────────────────────────── */

type KioskState =
  | { stage: 'idle' }
  | { stage: 'scanning' }
  | { stage: 'welcome'; token: GateToken; countdown: number }
  | { stage: 'reject'; reason: string };

const RESET_AFTER_MS = 9000;
const COUNTDOWN_START = 5;

/* ──────────────────────────────────────────────────────────────────────── */

export default function GateKioskPage() {
  const router = useRouter();
  const [state, setState] = useState<KioskState>({ stage: 'idle' });
  const [buffer, setBuffer] = useState('');
  const [now, setNow] = useState(new Date());
  const [showSimulator, setShowSimulator] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<number | null>(null);
  const countdownTimer = useRef<number | null>(null);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Always keep the hidden input focused so keyboard-wedge scans land in it
  useEffect(() => {
    const refocus = () => {
      if (state.stage === 'idle' || state.stage === 'scanning') {
        inputRef.current?.focus();
      }
    };
    refocus();
    const t = setInterval(refocus, 800);
    return () => clearInterval(t);
  }, [state.stage]);

  const clearTimers = useCallback(() => {
    if (resetTimer.current !== null) { window.clearTimeout(resetTimer.current); resetTimer.current = null; }
    if (countdownTimer.current !== null) { window.clearInterval(countdownTimer.current); countdownTimer.current = null; }
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    setState({ stage: 'idle' });
    setBuffer('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [clearTimers]);

  // Hand off to the EIR-In / EIR-Out form with prefill data
  const proceedToGateForm = useCallback((token: GateToken) => {
    clearTimers();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(GATE_PREFILL_KEY, JSON.stringify(token));
    }
    const target = token.dir === 'IN' ? '/gate/eir-in' : '/gate/eir-out';
    router.push(target);
  }, [clearTimers, router]);

  const processScan = useCallback((raw: string) => {
    if (!raw.trim()) return;
    setState({ stage: 'scanning' });
    setBuffer('');

    setTimeout(() => {
      const parsed = parseToken(raw);
      if ('error' in parsed) {
        setState({ stage: 'reject', reason: parsed.error });
        resetTimer.current = window.setTimeout(reset, RESET_AFTER_MS);
      } else {
        // Welcome screen with countdown — auto-proceed at 0
        setState({ stage: 'welcome', token: parsed, countdown: COUNTDOWN_START });
        countdownTimer.current = window.setInterval(() => {
          setState(s => {
            if (s.stage !== 'welcome') return s;
            if (s.countdown <= 1) {
              if (countdownTimer.current !== null) { window.clearInterval(countdownTimer.current); countdownTimer.current = null; }
              // schedule the handoff slightly out of the tick to avoid setState in interval cleanup
              window.setTimeout(() => proceedToGateForm(parsed), 0);
              return { ...s, countdown: 0 };
            }
            return { ...s, countdown: s.countdown - 1 };
          });
        }, 1000);
      }
    }, 600);
  }, [reset, proceedToGateForm]);

  // Keyboard-wedge input listener
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setBuffer(e.target.value);
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processScan(buffer);
    }
  };

  // ESC key returns to admin app
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') reset();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [reset]);

  const tt = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dd = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'radial-gradient(ellipse at top, #0f172a 0%, #020617 100%)',
      color: '#e2e8f0',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--gecko-font-sans), system-ui',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes kiosk-pulse-bg {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.05); }
        }
        @keyframes kiosk-pulse-ring {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes kiosk-fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes kiosk-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes kiosk-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes kiosk-barrier-rise {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-78deg); }
        }
      `}</style>

      {/* Hidden input that catches keyboard-wedge scans */}
      <input
        ref={inputRef}
        type="text"
        value={buffer}
        onChange={onInputChange}
        onKeyDown={onInputKeyDown}
        autoFocus
        style={{
          position: 'absolute', left: -9999, top: -9999, width: 1, height: 1, opacity: 0,
        }}
        aria-label="Gate scanner input (hidden)"
      />

      {/* Top bar */}
      <div style={{
        padding: '20px 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #1e293b',
        background: 'rgba(2, 6, 23, 0.6)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 18, color: '#fff',
          }}>
            G
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Laem Chabang ICD</div>
            <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
              Gate Kiosk · Lane IN-03
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', fontFamily: 'var(--gecko-font-mono)' }}>{tt}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{dd}</div>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, position: 'relative' }}>
        {state.stage === 'idle' && <IdleScreen />}
        {state.stage === 'scanning' && <ScanningScreen />}
        {state.stage === 'welcome' && (
          <WelcomeScreen
            token={state.token}
            countdown={state.countdown}
            onConfirm={() => proceedToGateForm(state.token)}
            onCancel={reset}
          />
        )}
        {state.stage === 'reject' && <RejectScreen reason={state.reason} />}
      </div>

      {/* Bottom bar */}
      <div style={{
        padding: '16px 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: '1px solid #1e293b',
        background: 'rgba(2, 6, 23, 0.6)',
        backdropFilter: 'blur(8px)',
        fontSize: 12, color: '#64748b',
      }}>
        <div>
          {state.stage === 'idle' && 'Hold the QR code in front of the scanner — keyboard-wedge or camera.'}
          {state.stage === 'scanning' && 'Decoding…'}
          {state.stage === 'welcome' && 'Confirm details below — the gate form opens automatically when ready.'}
          {state.stage === 'reject' && 'Speak to the gate clerk for assistance.'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Press <kbd style={{ padding: '2px 6px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#cbd5e1', fontFamily: 'inherit' }}>Esc</kbd> to reset · <Link href="/dashboard/overview" style={{ color: '#60a5fa', textDecoration: 'none' }}>Exit kiosk</Link>
          </span>
          <button
            onClick={() => setShowSimulator(s => !s)}
            style={{
              background: showSimulator ? '#3b82f6' : 'transparent',
              border: '1px solid #334155', color: showSimulator ? '#fff' : '#94a3b8',
              padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
              fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Icon name="play" size={11} /> {showSimulator ? 'Hide simulator' : 'Demo simulator'}
          </button>
        </div>
      </div>

      {/* Demo simulator panel */}
      {showSimulator && (
        <div style={{
          position: 'absolute', right: 20, bottom: 64, width: 380,
          background: 'rgba(15, 23, 42, 0.98)',
          border: '1px solid #334155', borderRadius: 12,
          padding: 16,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          animation: 'kiosk-fade-up 200ms ease',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Demo · simulate a driver scan
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SAMPLE_TOKENS.map(s => (
              <button
                key={s.label}
                onClick={() => processScan(encodeToken(s.token))}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  background: '#1e293b', border: '1px solid #334155',
                  borderRadius: 8, cursor: 'pointer',
                  color: '#e2e8f0', fontFamily: 'inherit',
                  transition: 'all 120ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#334155'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#1e293b'; }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{s.label}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{s.description}</div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #334155', fontSize: 10, color: '#64748b' }}>
            A USB QR scanner types the same token + Enter into our hidden input. The simulator just pipes a sample token through that same path.
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   State screens
   ────────────────────────────────────────────────────────────────────────── */

function IdleScreen() {
  return (
    <div style={{ textAlign: 'center', animation: 'kiosk-fade-in 300ms ease' }}>
      <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto 32px' }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '2px solid #3b82f6',
              animation: `kiosk-pulse-ring 2.4s ease-out infinite`,
              animationDelay: `${i * 0.6}s`,
            }}
          />
        ))}
        <div style={{
          position: 'absolute', inset: 30, borderRadius: '50%',
          background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 60px rgba(59, 130, 246, 0.4)',
          animation: 'kiosk-pulse-bg 2.4s ease-in-out infinite',
        }}>
          <Icon name="search" size={64} style={{ color: '#fff', opacity: 0.95 }} />
        </div>
      </div>
      <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 14 }}>
        Welcome to Laem Chabang ICD
      </div>
      <div style={{ fontSize: 22, color: '#94a3b8', fontWeight: 500 }}>
        Hold the QR code from your appointment in front of the scanner
      </div>
      <div style={{ fontSize: 16, color: '#64748b', marginTop: 28, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#10b981',
          boxShadow: '0 0 8px #10b981',
        }} />
        Scanner ready
      </div>
    </div>
  );
}

function ScanningScreen() {
  return (
    <div style={{ textAlign: 'center', animation: 'kiosk-fade-in 200ms ease' }}>
      <div style={{
        width: 80, height: 80, margin: '0 auto 28px',
        border: '4px solid #1e293b',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'kiosk-spin 0.8s linear infinite',
      }} />
      <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Decoding…</div>
      <div style={{ fontSize: 16, color: '#94a3b8' }}>Verifying appointment</div>
    </div>
  );
}

function WelcomeScreen({ token, countdown, onConfirm, onCancel }: {
  token: GateToken; countdown: number;
  onConfirm: () => void; onCancel: () => void;
}) {
  const total = COUNTDOWN_START;
  const pct = Math.max(0, ((total - countdown) / total) * 100);
  const isOutbound = token.dir === 'OUT';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 36, maxWidth: 1280, width: '100%',
      animation: 'kiosk-fade-up 350ms ease',
    }}>
      {/* Left: welcome + details */}
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '6px 14px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: 999, fontSize: 12, fontWeight: 700, color: '#10b981', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <Icon name="check" size={14} /> Verified · {token.apt}
        </div>

        <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.05, marginBottom: 6, letterSpacing: '-0.02em' }}>
          Welcome,<br />
          <span style={{ color: '#60a5fa' }}>{token.drv}</span>
        </div>
        <div style={{ fontSize: 19, color: '#94a3b8', marginBottom: 28 }}>
          {token.hau} · Truck <strong style={{ color: '#e2e8f0', fontFamily: 'var(--gecko-font-mono)' }}>{token.plt}</strong>
        </div>

        {/* What is the truck here for? */}
        <div style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(99, 102, 241, 0.06))',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: 14,
          marginBottom: 22,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Reason for arrival
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 10,
              background: isOutbound ? '#7c3aed' : '#0ea5e9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={isOutbound ? 'arrowUp' : 'arrowDown'} size={26} style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{token.ot}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
                {isOutbound ? 'Outbound · driver leaves with a container' : 'Inbound · driver delivers a container'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <InfoTile label="Container"   value={token.cnt ?? '— (empty pickup)'} mono iso={token.iso} />
          {token.cust && <InfoTile label="Customer"    value={token.cust}    icon="users" />}
          <InfoTile label="Gate lane"   value={token.lane ?? '—'} mono icon="map" />
          {token.slot && <InfoTile label="Yard slot"   value={token.slot}    icon="layers" mono />}
        </div>
      </div>

      {/* Right: countdown + confirm/cancel */}
      <div style={{
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid #334155', borderRadius: 16,
        padding: 28,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        minHeight: 420,
      }}>
        {/* Countdown ring */}
        <div style={{ textAlign: 'center', paddingTop: 16 }}>
          <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto 16px' }}>
            <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="44" fill="none" stroke="#1e293b" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="44" fill="none"
                stroke="#3b82f6" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${(2 * Math.PI * 44) * (pct / 100)}`}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column',
            }}>
              <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: '#fff', fontFamily: 'var(--gecko-font-mono)' }}>
                {countdown}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                second{countdown === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.5 }}>
            Opening the <strong style={{ color: '#fff' }}>{isOutbound ? 'EIR-Out' : 'EIR-In'}</strong> form…
            <br />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Details below will be auto-filled for the gate clerk.</span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
          <button
            onClick={onConfirm}
            style={{
              padding: '14px 20px',
              background: 'linear-gradient(135deg, #059669, #10b981)',
              border: 'none', borderRadius: 10,
              color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 6px 16px rgba(16, 185, 129, 0.25)',
            }}
          >
            <Icon name="check" size={16} /> Confirm and proceed now
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: '1px solid #475569', borderRadius: 10,
              color: '#cbd5e1', fontSize: 13, fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Not me — cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectScreen({ reason }: { reason: string }) {
  return (
    <div style={{ textAlign: 'center', animation: 'kiosk-fade-up 300ms ease', maxWidth: 720 }}>
      <div style={{
        width: 140, height: 140, margin: '0 auto 28px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #b91c1c, #ef4444)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 60px rgba(239, 68, 68, 0.5)',
      }}>
        <Icon name="x" size={80} style={{ color: '#fff' }} />
      </div>
      <div style={{ fontSize: 42, fontWeight: 700, marginBottom: 14, color: '#fff' }}>
        Cannot enter
      </div>
      <div style={{ fontSize: 20, color: '#fca5a5', marginBottom: 24 }}>
        {reason}
      </div>
      <div style={{ fontSize: 16, color: '#94a3b8' }}>
        Please proceed to the <strong style={{ color: '#fff' }}>Gate Office</strong> for assistance.
      </div>
    </div>
  );
}

function InfoTile({ label, value, icon, mono, iso }: {
  label: string; value: string; icon?: string; mono?: boolean; iso?: string;
}) {
  return (
    <div style={{
      padding: '14px 18px',
      background: 'rgba(15, 23, 42, 0.6)',
      border: '1px solid #1e293b',
      borderRadius: 10,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon && <Icon name={icon} size={11} />} {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: mono ? 'var(--gecko-font-mono)' : 'inherit', wordBreak: 'break-word' }}>
        {value}
        {iso && <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b', fontWeight: 500 }}>· {iso}</span>}
      </div>
    </div>
  );
}
