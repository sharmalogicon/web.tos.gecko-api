"use client";

import React, { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../components/ui/Icon';

// Demo credentials for the mock login. Real authentication arrives with
// Azure AD B2C in the Phase 1 backend; this is a UI-only gate.
const DEMO_EMAIL = 'somchai@lcb-icd.com';
const DEMO_PASSWORD = 'GeckoTOS2026';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Password is required.';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});
    await new Promise(r => setTimeout(r, 600));

    if (email.trim().toLowerCase() === DEMO_EMAIL.toLowerCase() && password === DEMO_PASSWORD) {
      router.push('/dashboard/overview');
    } else {
      setErrors({ general: 'Invalid email or password. Use the demo credentials shown below.' });
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--gecko-bg-surface)',
      fontFamily: 'inherit',
    }}>
      {/* LEFT — brand + testimonial */}
      <div style={{
        flex: '1 1 50%',
        background: 'linear-gradient(135deg, var(--gecko-primary-600) 0%, var(--gecko-primary-800) 100%)',
        color: '#fff',
        padding: '48px 56px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
      className="gecko-login-hero">
        {/* Decorative orb */}
        <div aria-hidden style={{
          position: 'absolute',
          bottom: -140,
          left: -120,
          width: 440,
          height: 440,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.10)',
          pointerEvents: 'none',
        }} />
        <div aria-hidden style={{
          position: 'absolute',
          top: -160,
          right: -160,
          width: 360,
          height: 360,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          pointerEvents: 'none',
        }} />

        {/* Brand */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 50, height: 50, borderRadius: 11,
              background: 'rgba(255,255,255,0.16)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.22)',
              flexShrink: 0,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h4l3-9 4 18 3-9h4" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Gecko TOS</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4, letterSpacing: '0.02em' }}>End-to-End Terminal Operating System</div>
            </div>
          </div>
        </div>

        {/* Testimonial */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 540 }}>
          <div aria-hidden style={{
            fontSize: 64, fontWeight: 700, lineHeight: 0.6,
            opacity: 0.22, marginBottom: 8, fontFamily: 'Georgia, serif',
          }}>&ldquo;</div>
          <blockquote style={{
            fontSize: 22, lineHeight: 1.5, fontWeight: 500, margin: 0,
            letterSpacing: '-0.01em',
          }}>
            Gecko replaced our 15-year-old TOS in three weeks. Yard productivity is up 22%, billing disputes are down to almost zero, and our customers can finally self-serve without calling the ops desk.
          </blockquote>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 28 }}>
            <div style={{
              width: 46, height: 46, borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, fontSize: 14, letterSpacing: '0.04em',
              border: '1px solid rgba(255,255,255,0.22)',
            }}>
              PC
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Pim Chaiyaporn</div>
              <div style={{ opacity: 0.82, fontSize: 13, marginTop: 2 }}>Operations Director · Laem Chabang ICD</div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — form */}
      <div style={{
        flex: '1 1 50%',
        padding: '48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'var(--gecko-bg-surface)',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h1 style={{
            fontSize: 32, fontWeight: 700,
            color: 'var(--gecko-text-primary)',
            margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2,
          }}>
            Welcome back
          </h1>
          <p style={{
            color: 'var(--gecko-text-secondary)',
            marginTop: 6, marginBottom: 32, fontSize: 14,
          }}>
            Sign in to your account
          </p>

          <form onSubmit={onSubmit} noValidate>
            {errors.general && (
              <div role="alert" style={{
                padding: '11px 14px',
                borderRadius: 8,
                background: 'rgba(220, 38, 38, 0.07)',
                border: '1px solid rgba(220, 38, 38, 0.25)',
                color: 'var(--gecko-error-700, #b91c1c)',
                fontSize: 13,
                marginBottom: 18,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>
                  <Icon name="alertCircle" size={16} />
                </span>
                <span>{errors.general}</span>
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: 18 }}>
              <label htmlFor="email" style={{
                display: 'block', fontSize: 13, fontWeight: 600,
                marginBottom: 6, color: 'var(--gecko-text-primary)',
              }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <span aria-hidden style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--gecko-text-disabled)', pointerEvents: 'none',
                  display: 'flex',
                }}>
                  <Icon name="mail" size={16} />
                </span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="gecko-input"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: undefined }); }}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  style={{
                    width: '100%', height: 42,
                    paddingLeft: 36, paddingRight: 12,
                    borderColor: errors.email ? 'var(--gecko-error-600)' : undefined,
                  }}
                  autoFocus
                />
              </div>
              {errors.email && (
                <div id="email-error" style={{ color: 'var(--gecko-error-700, #b91c1c)', fontSize: 12, marginTop: 5 }}>
                  {errors.email}
                </div>
              )}
            </div>

            {/* Password */}
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="password" style={{
                display: 'block', fontSize: 13, fontWeight: 600,
                marginBottom: 6, color: 'var(--gecko-text-primary)',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <span aria-hidden style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--gecko-text-disabled)', pointerEvents: 'none',
                  display: 'flex',
                }}>
                  <Icon name="lock" size={16} />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="gecko-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: undefined }); }}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  style={{
                    width: '100%', height: 42,
                    paddingLeft: 36, paddingRight: 40,
                    borderColor: errors.password ? 'var(--gecko-error-600)' : undefined,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none',
                    color: 'var(--gecko-text-disabled)', cursor: 'pointer',
                    padding: 6, display: 'flex', alignItems: 'center',
                    borderRadius: 4,
                  }}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>
              {errors.password && (
                <div id="password-error" style={{ color: 'var(--gecko-error-700, #b91c1c)', fontSize: 12, marginTop: 5 }}>
                  {errors.password}
                </div>
              )}
            </div>

            {/* Remember + Forgot */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 24, marginTop: 14,
            }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: 'var(--gecko-text-secondary)', cursor: 'pointer',
                userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--gecko-primary-600)' }}
                />
                Remember me
              </label>
              <a
                href="#forgot"
                onClick={(e) => { e.preventDefault(); alert('Password reset arrives with Azure AD B2C in the Phase 1 backend.'); }}
                style={{
                  fontSize: 13, color: 'var(--gecko-primary-600)',
                  textDecoration: 'none', fontWeight: 500,
                }}
              >
                Forgot password?
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="gecko-btn gecko-btn-primary"
              disabled={submitting}
              style={{
                width: '100%', height: 44, fontSize: 14, fontWeight: 600,
              }}
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>

            <p style={{
              marginTop: 20, fontSize: 13, color: 'var(--gecko-text-secondary)',
              textAlign: 'center',
            }}>
              Don&rsquo;t have an account?{' '}
              <a
                href="#contact"
                onClick={(e) => { e.preventDefault(); alert('Multi-tenant SaaS — accounts are provisioned by your tenant administrator.'); }}
                style={{ color: 'var(--gecko-primary-600)', textDecoration: 'none', fontWeight: 500 }}
              >
                Contact your administrator
              </a>
            </p>

            {/* Language */}
            <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                className="gecko-btn gecko-btn-ghost gecko-btn-sm"
                onClick={() => alert('Localization arrives in Phase 4 — Thai, Bahasa Malaysia, Bahasa Indonesia, Vietnamese, Tagalog.')}
                style={{ fontSize: 12, color: 'var(--gecko-text-secondary)', gap: 6 }}
              >
                <Icon name="globe" size={14} />
                <span>EN</span>
                <Icon name="chevronDown" size={12} />
              </button>
            </div>
          </form>

          {/* Demo credentials hint */}
          <div style={{
            marginTop: 28,
            padding: '12px 14px',
            background: 'var(--gecko-bg-subtle)',
            border: '1px dashed var(--gecko-border)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--gecko-text-secondary)',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--gecko-text-primary)', fontSize: 12 }}>
              Demo credentials
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>
                Email: <code style={{
                  background: 'var(--gecko-bg-surface)', padding: '1px 6px',
                  borderRadius: 4, fontSize: 11, border: '1px solid var(--gecko-border)',
                }}>{DEMO_EMAIL}</code>
              </div>
              <div>
                Password: <code style={{
                  background: 'var(--gecko-bg-surface)', padding: '1px 6px',
                  borderRadius: 4, fontSize: 11, border: '1px solid var(--gecko-border)',
                }}>{DEMO_PASSWORD}</code>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.78 }}>
              UI mock only. Real authentication arrives with Azure AD B2C in the Phase 1 backend.
            </div>
          </div>
        </div>
      </div>

      {/* Stack the panels on narrow screens (tablet portrait, mobile) */}
      <style jsx>{`
        @media (max-width: 900px) {
          div :global(.gecko-login-hero) {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
