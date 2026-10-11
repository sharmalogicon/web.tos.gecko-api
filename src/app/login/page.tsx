"use client";

import React, { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../components/ui/Icon';
import { useSession } from '../../lib/auth/session';
import { ApiError } from '../../lib/api/problem';
import { changePassword } from '../../lib/api/client';
import { LANDING_PATH } from '../../lib/edition';

/**
 * DEVELOPMENT ONLY — the owner account, pre-filled so a local sign-in is one
 * click. `next build` replaces NODE_ENV with 'production' and tree-shakes both
 * of these to '', so neither the address nor the password can reach a deployed
 * bundle. That is deliberate: it needs no one to remember to take them out
 * before publishing, which is exactly how the fixture password leaked last time.
 *
 * Production starts empty and shows no hints — real accounts arrive by
 * invitation (ADR-006 D3: no self-service signup).
 */
const IS_DEV = process.env.NODE_ENV === 'development';
const DEV_EMAIL = IS_DEV ? 'admin@korakit.com' : '';
const DEV_PASSWORD = IS_DEV ? 'P@ssw0rd' : '';

export default function LoginPage() {
  const router = useRouter();
  const { status, signIn } = useSession();
  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; current?: string; password?: string; general?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  /**
   * The card flips rather than routing: a clerk who mistypes a password is in
   * the middle of signing in, and sending them to another URL and back loses
   * the address they already keyed.
   */
  const [view, setView] = useState<'signIn' | 'reset'>('signIn');
  /** The password they have now — their own, or the one-time one from an admin. */
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetDone, setResetDone] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    // Either the e-mail or the user name: the API reads an identifier without '@' as a user name.
    if (!email.trim()) e.email = 'Email or user name is required.';
    else if (email.includes('@') && !/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Password is required.';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Already signed in (the refresh cookie survived the reload): don't ask again.
  useEffect(() => {
    if (status === 'authenticated') router.replace(LANDING_PATH);
  }, [status, router]);

  /**
   * Reset the password of the account named in the form.
   *
   * No current password and no emailed link — the owner's decision
   * (2026-10-10). The API is the only thing checking anything here, so its
   * refusals are shown as it words them rather than softened.
   */
  const onReset = async (event: FormEvent) => {
    event.preventDefault();
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email or user name is required.';
    if (!currentPassword) e.current = 'Enter the password you have now.';
    if (!newPassword) e.password = 'Enter a new password.';
    else if (newPassword.length < 6) e.password = 'Password must be at least 6 characters.';
    else if (newPassword !== confirmPassword) e.password = 'The two passwords do not match.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSubmitting(true);
    try {
      await changePassword(email.trim(), currentPassword, newPassword);
      setResetDone(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      const api = error instanceof ApiError ? error : null;
      // A 400 names the field it refused — the password policy lives on the
      // server, so its sentence is better than one invented here.
      const field = api?.forField('newPassword');
      if (field) setErrors({ password: field });
      // 401 is a wrong current password, worded as login words it so nothing
      // leaks about which accounts exist.
      else if (api?.status === 401) setErrors({ current: 'That password is not right.' });
      else setErrors({ general: api?.explanation ?? api?.message ?? 'The password could not be changed.' });
    } finally {
      setSubmitting(false);
    }
  };

  /** Back to signing in, with the form cleared of anything the reset left. */
  const backToSignIn = () => {
    setView('signIn');
    setErrors({});
    setResetDone(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});

    try {
      await signIn(email.trim(), password);
      router.push(LANDING_PATH);
    } catch (error) {
      if (error instanceof ApiError) {
        // The API answers 401 without saying WHICH half was wrong — telling the
        // caller "no such email" would be a free account-enumeration oracle.
        setErrors(
          error.code === 'password_change_required'
            ? { general: 'This account must set a new password before signing in.' }
            : {
                general: error.message,
                email: error.forField('email'),
                password: error.forField('password'),
              },
        );
      } else {
        setErrors({
          general: process.env.NODE_ENV === 'development'
            ? 'Could not reach the Gecko API. Is Gecko.Api running on http://localhost:5100?'
            : 'The Gecko service is not reachable right now. Please try again in a minute.',
        });
      }
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
              <div className="gecko-page-title-lg">Gecko TOS</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4, letterSpacing: '0.02em' }}>End-to-End Terminal Operating System</div>
            </div>
          </div>
        </div>

        {/* Product line — no testimonial until a customer gives us a real one */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 540 }}>
          <p style={{
            fontSize: 22, lineHeight: 1.5, fontWeight: 500, margin: 0,
            letterSpacing: '-0.01em',
          }}>
            Gate, yard, bookings, tariffs and the cash window — one system for the whole depot.
          </p>
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
            {view === 'signIn' ? 'Welcome back' : 'Change password'}
          </h1>
          <p style={{
            color: 'var(--gecko-text-secondary)',
            marginTop: 6, marginBottom: 32, fontSize: 14,
          }}>
            {view === 'signIn'
              ? 'Sign in to your account'
              : 'Use the password you have now — or the one-time one your administrator gave you.'}
          </p>

          {view === 'reset' ? (
            <ResetCard
              email={email}
              onEmail={v => { setEmail(v); if (errors.email) setErrors({ ...errors, email: undefined }); }}
              currentPassword={currentPassword}
              onCurrentPassword={v => { setCurrentPassword(v); if (errors.current) setErrors({ ...errors, current: undefined }); }}
              newPassword={newPassword}
              onNewPassword={v => { setNewPassword(v); if (errors.password) setErrors({ ...errors, password: undefined }); }}
              confirmPassword={confirmPassword}
              onConfirmPassword={v => { setConfirmPassword(v); if (errors.password) setErrors({ ...errors, password: undefined }); }}
              errors={errors}
              submitting={submitting}
              done={resetDone}
              onSubmit={onReset}
              onBack={backToSignIn}
            />
          ) : (
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

            {/* Email or user name */}
            <div style={{ marginBottom: 18 }}>
              <label htmlFor="email" style={{
                display: 'block', fontSize: 13, fontWeight: 600,
                marginBottom: 6, color: 'var(--gecko-text-primary)',
              }}>
                Email or user name
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
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="gecko-input"
                  placeholder="email@example.com or user name"
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
                onClick={(e) => { e.preventDefault(); setErrors({}); setView('reset'); }}
                title="Ask an administrator to reset it; they will give you a one-time password to sign in with"
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
          )}
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

/**
 * THE CHANGE-PASSWORD CARD — the login card, flipped.
 *
 * Email (carried from the sign-in form), the password they have now, a new one,
 * a confirmation. The current password is the proof: it is either their own or
 * the one-time one an administrator issued, and the API checks it the same way
 * either way. There is no emailed link and no reset token — the administrator
 * is the human check, which is how a depot with no mail server does this.
 *
 * It is also what satisfies `password_change_required`: the API has been able
 * to demand a change since LoginService was written, and nothing could answer.
 *
 * The two new passwords are matched here because the server never sees the
 * confirmation; everything else it refuses is shown in its own words.
 */
function ResetCard({
  email, onEmail, currentPassword, onCurrentPassword,
  newPassword, onNewPassword, confirmPassword, onConfirmPassword,
  errors, submitting, done, onSubmit, onBack,
}: {
  email: string;
  onEmail: (v: string) => void;
  currentPassword: string;
  onCurrentPassword: (v: string) => void;
  newPassword: string;
  onNewPassword: (v: string) => void;
  confirmPassword: string;
  onConfirmPassword: (v: string) => void;
  errors: { email?: string; current?: string; password?: string; general?: string };
  submitting: boolean;
  done: boolean;
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
}) {
  // One per box rather than one for both: a clerk checking a typo usually
  // wants to read the confirmation against a hidden original.
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const label: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600,
    marginBottom: 6, color: 'var(--gecko-text-primary)',
  };
  // Room on the right for the eye, as the sign-in box has.
  const box: React.CSSProperties = { width: '100%', height: 42, paddingLeft: 36, paddingRight: 40 };
  const eye: React.CSSProperties = {
    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
    background: 'transparent', border: 'none',
    color: 'var(--gecko-text-disabled)', cursor: 'pointer',
    padding: 6, display: 'flex', alignItems: 'center',
    borderRadius: 4,
  };

  if (done) {
    return (
      <div>
        <div role="status" style={{
          padding: '11px 14px', borderRadius: 8, fontSize: 13,
          background: 'rgba(22, 163, 74, 0.08)',
          border: '1px solid rgba(22, 163, 74, 0.25)',
          color: 'var(--gecko-success-700, #15803d)',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="checkCircle" size={16} /></span>
          <span>
            The password for <strong>{email.trim()}</strong> has been changed. Any other device signed
            in as that account has been signed out.
          </span>
        </div>
        <button type="button" className="gecko-btn gecko-btn-primary" onClick={onBack}
          style={{ width: '100%', height: 44, fontSize: 14, fontWeight: 600, marginTop: 18 }}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {errors.general && (
        <div role="alert" style={{
          padding: '11px 14px', borderRadius: 8, fontSize: 13, marginBottom: 18,
          background: 'rgba(220, 38, 38, 0.07)',
          border: '1px solid rgba(220, 38, 38, 0.25)',
          color: 'var(--gecko-error-700, #b91c1c)',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="alertCircle" size={16} /></span>
          <span>{errors.general}</span>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <label htmlFor="reset-email" style={label}>Email or user name</label>
        <div style={{ position: 'relative' }}>
          <span aria-hidden style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--gecko-text-disabled)', pointerEvents: 'none', display: 'flex',
          }}>
            <Icon name="mail" size={16} />
          </span>
          <input id="reset-email" type="text" autoComplete="username" className="gecko-input"
            placeholder="email@example.com" value={email}
            onChange={e => onEmail(e.target.value)}
            aria-invalid={!!errors.email}
            style={{ ...box, borderColor: errors.email ? 'var(--gecko-error-600)' : undefined }} />
        </div>
        {errors.email && (
          <div style={{ color: 'var(--gecko-error-700, #b91c1c)', fontSize: 12, marginTop: 5 }}>{errors.email}</div>
        )}
      </div>

      {/* The proof. Their own password, or the one-time one an administrator
          gave them — the API checks it the same way either way. */}
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="reset-current" style={label}>Current or one-time password</label>
        <div style={{ position: 'relative' }}>
          <span aria-hidden style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--gecko-text-disabled)', pointerEvents: 'none', display: 'flex',
          }}>
            <Icon name="lock" size={16} />
          </span>
          <input id="reset-current" type={showCurrent ? 'text' : 'password'} autoComplete="current-password"
            className="gecko-input"
            placeholder="The password you have now" value={currentPassword}
            onChange={e => onCurrentPassword(e.target.value)}
            aria-invalid={!!errors.current}
            style={{ ...box, borderColor: errors.current ? 'var(--gecko-error-600)' : undefined }} />
          <button type="button" onClick={() => setShowCurrent(v => !v)} tabIndex={-1}
            aria-label={showCurrent ? 'Hide password' : 'Show password'} style={eye}>
            <Icon name={showCurrent ? 'eyeOff' : 'eye'} size={16} />
          </button>
        </div>
        {errors.current && (
          <div style={{ color: 'var(--gecko-error-700, #b91c1c)', fontSize: 12, marginTop: 5 }}>{errors.current}</div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label htmlFor="reset-new" style={label}>New password</label>
        <div style={{ position: 'relative' }}>
          <span aria-hidden style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--gecko-text-disabled)', pointerEvents: 'none', display: 'flex',
          }}>
            <Icon name="lock" size={16} />
          </span>
          <input id="reset-new" type={showNew ? 'text' : 'password'} autoComplete="new-password"
            className="gecko-input"
            placeholder="At least 6 characters" value={newPassword}
            onChange={e => onNewPassword(e.target.value)}
            aria-invalid={!!errors.password}
            style={{ ...box, borderColor: errors.password ? 'var(--gecko-error-600)' : undefined }} />
          <button type="button" onClick={() => setShowNew(v => !v)} tabIndex={-1}
            aria-label={showNew ? 'Hide password' : 'Show password'} style={eye}>
            <Icon name={showNew ? 'eyeOff' : 'eye'} size={16} />
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label htmlFor="reset-confirm" style={label}>Confirm password</label>
        <div style={{ position: 'relative' }}>
          <span aria-hidden style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--gecko-text-disabled)', pointerEvents: 'none', display: 'flex',
          }}>
            <Icon name="lock" size={16} />
          </span>
          <input id="reset-confirm" type={showConfirm ? 'text' : 'password'} autoComplete="new-password"
            className="gecko-input"
            placeholder="Type it again" value={confirmPassword}
            onChange={e => onConfirmPassword(e.target.value)}
            aria-invalid={!!errors.password}
            style={{ ...box, borderColor: errors.password ? 'var(--gecko-error-600)' : undefined }} />
          <button type="button" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}
            aria-label={showConfirm ? 'Hide password' : 'Show password'} style={eye}>
            <Icon name={showConfirm ? 'eyeOff' : 'eye'} size={16} />
          </button>
        </div>
        {errors.password && (
          <div style={{ color: 'var(--gecko-error-700, #b91c1c)', fontSize: 12, marginTop: 5 }}>{errors.password}</div>
        )}
      </div>

      <button type="submit" className="gecko-btn gecko-btn-primary" disabled={submitting}
        style={{ width: '100%', height: 44, fontSize: 14, fontWeight: 600 }}>
        {submitting ? 'Updating…' : 'Update password'}
      </button>

      <p style={{ marginTop: 20, fontSize: 13, textAlign: 'center' }}>
        <button type="button" onClick={onBack}
          style={{
            background: 'none', border: 0, padding: 0, cursor: 'pointer',
            color: 'var(--gecko-primary-600)', fontSize: 13, fontWeight: 500,
          }}>
          ← Back to sign in
        </button>
      </p>
    </form>
  );
}
