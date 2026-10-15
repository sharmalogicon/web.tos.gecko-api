"use client";
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useSession } from '@/lib/auth/session';
import { useFacility } from '@/lib/api/facility';
import { LANGUAGES, usePreferences, type Language, type Theme } from '@/lib/preferences';
import { ChangePasswordDialog } from '@/components/layout/ChangePasswordDialog';

/**
 * SETTINGS — what belongs to the PERSON, not to the depot.
 *
 * The tenant's settings are Configuration: gate hours, roles, system
 * parameters, EDI partners. Those are the depot's rules and need a permission.
 * These are the two or three choices a clerk makes about their own screen, and
 * nobody else should be affected by them.
 *
 * THEY LIVE IN THIS BROWSER. There is nowhere on the API to put them yet — Me
 * carries roles, branches and permissions and nothing else — so a clerk who
 * signs in at another lane starts on the defaults. The page says so plainly
 * rather than implying the choice follows them around; see
 * docs/USER_PREFERENCES_FOR_API.md for what would fix it.
 *
 * The account block below is read from the token, which is why it shows a role
 * and a depot count rather than a name and an e-mail: those are not in it.
 */
export default function SettingsPage() {
  const { user, status } = useSession();
  const { branches } = useFacility();
  const { theme, language, setTheme, setLanguage } = usePreferences();
  const [changing, setChanging] = useState(false);

  const signedIn = status === 'authenticated' && !!user;
  const mine = branches.filter(b => user?.branches.includes(b.branchId));

  return (
    <div className="gecko-stack gecko-settings-page">

      <div className="gecko-page-actions">
        <div className="gecko-page-actions-left">
          <h1 className="gecko-page-title">Settings</h1>
          <div className="gecko-page-subtitle gecko-mt-1">
            Your own preferences. The depot&apos;s rules live under Configuration.
          </div>
        </div>
      </div>

      {/* ── appearance ──────────────────────────────────────────────────── */}
      <section className="gecko-cm-section">
        <div className="gecko-cm-section-head">
          <div className="gecko-eyebrow"><Icon name="sun" size={13} /> Appearance</div>
          <span className="gecko-cell-meta">Remembered in this browser.</span>
        </div>

        <div className="gecko-settings-row">
          <div className="gecko-settings-row-label">
            <div className="gecko-settings-row-name">Theme</div>
            <div className="gecko-cell-meta">Dark is easier on a gate screen at night.</div>
          </div>
          <div className="gecko-segmented">
            {([['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']] as const).map(([value, icon, label]) => (
              <button key={value} type="button"
                className={`gecko-segmented-item${theme === value ? ' gecko-segmented-item-active' : ''}`}
                onClick={() => setTheme(value as Theme)}>
                <Icon name={icon} size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="gecko-settings-row">
          <div className="gecko-settings-row-label">
            <div className="gecko-settings-row-name">Language</div>
            <div className="gecko-cell-meta">
              The choice is stored and set on the page, but the screens are still English — the translation
              pass has not been done.
            </div>
          </div>
          <div className="gecko-segmented">
            {LANGUAGES.map(l => (
              <button key={l.value} type="button"
                className={`gecko-segmented-item${language === l.value ? ' gecko-segmented-item-active' : ''}`}
                onClick={() => setLanguage(l.value as Language)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── the account ─────────────────────────────────────────────────── */}
      <section className="gecko-cm-section">
        <div className="gecko-cm-section-head">
          <div className="gecko-eyebrow"><Icon name="user" size={13} /> Account</div>
        </div>

        {!signedIn ? (
          <div className="gecko-cell-meta">Not signed in.</div>
        ) : (
          <>
            <dl className="gecko-ui-facts">
              <div className="gecko-ui-fact">
                <dt>Role</dt>
                <dd>{user.roles.map(r => r.replace(/_/g, ' ')).join(', ') || user.userType || '—'}</dd>
              </div>
              <div className="gecko-ui-fact">
                <dt>Depots</dt>
                <dd>{mine.length > 0 ? mine.map(b => b.branchCode).join(', ') : `${user.branches.length} depot(s)`}</dd>
              </div>
              <div className="gecko-ui-fact">
                <dt>Modules</dt>
                <dd>{user.modules.join(', ') || '—'}</dd>
              </div>
            </dl>

            <div className="gecko-settings-row">
              <div className="gecko-settings-row-label">
                <div className="gecko-settings-row-name">Password</div>
                <div className="gecko-cell-meta">
                  The old one stops working at once; this session stays signed in.
                </div>
              </div>
              <button type="button" className="gecko-btn gecko-btn-outline gecko-btn-sm"
                onClick={() => setChanging(true)}>
                <Icon name="lock" size={14} /> Change password
              </button>
            </div>
          </>
        )}
      </section>

      <div className="gecko-cell-meta gecko-settings-note">
        <Icon name="info" size={12} /> These preferences are kept in this browser only. Signing in on another
        machine starts on the defaults until the API can hold them against your account.
      </div>

      {changing && <ChangePasswordDialog onClose={() => setChanging(false)} />}
    </div>
  );
}
