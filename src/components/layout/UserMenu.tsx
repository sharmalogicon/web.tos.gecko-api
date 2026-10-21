"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { displayName, initialsOf, roleLabel, useSession } from '@/lib/auth/session';
import { LANGUAGES, usePreferences, type Language, type Theme } from '@/lib/preferences';
import { ChangePasswordDialog } from './ChangePasswordDialog';

/**
 * THE ACCOUNT MENU — one row in place of five header buttons.
 *
 * The header carried a language button, a bell, a help button and a theme
 * toggle, all in a row, none of which a clerk touches during a shift. They are
 * all in here now (owner 2026-10-15).
 *
 * IT LIVES AT THE FOOT OF THE SIDEBAR, and opens UPWARDS, because that is where
 * the account already was — the row that showed who was signed in and carried
 * the sign-out. Putting the menu anywhere else would have meant two places to
 * look for the same thing.
 *
 * THE UNREAD COUNT STAYS OUTSIDE. A badge that only appears once you open the
 * menu is not a badge, so the dot sits on the row itself — the one thing that
 * genuinely has to be seen without a click.
 *
 * Notifications and Help have no screen behind them yet. They are shown
 * disabled with the reason rather than left out, because a clerk who used to
 * see those icons in the header will come looking for them.
 */

export function UserMenu({ collapsed = false }: {
  /** A collapsed rail has room for the avatar and nothing else. */
  collapsed?: boolean;
}) {
  const router = useRouter();
  const { user, status, signOut } = useSession();
  const { theme, language, setTheme, setLanguage } = usePreferences();
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, []);

  const signedIn = status === 'authenticated' && !!user;
  // THE PERSON LEADS, the role sits underneath. /auth/me carries the name since
  // 2026-10-21; displayName() still falls back to the e-mail and then the role,
  // because an account may have no name set.
  const who = displayName(user ?? null);
  const role = user?.roles[0] ? roleLabel(user.roles[0]) : (user?.userType ?? '');
  const initials = initialsOf(user ?? null);
  const depots = user ? `${user.branches.length} depot${user.branches.length === 1 ? '' : 's'}` : '';
  // Role and depots read as one line; either may be empty, so neither leaves a
  // stray separator behind.
  const standing = [role, depots].filter(Boolean).join(' · ');
  // What the clerk types at the lane, then the address it reaches. `userName` is
  // null on e-mail-only accounts, so neither leaves a stray separator behind.
  const account = [user?.userName, user?.email].filter(Boolean).join(' · ');

  const doSignOut = async () => {
    setOpen(false);
    try { await signOut(); } finally { router.push('/login'); }
  };

  const go = (path: string) => { setOpen(false); router.push(path); };

  return (
    <div ref={wrap} className="gecko-usermenu">
      <button type="button"
        className={`gecko-usermenu-trigger${collapsed ? ' gecko-usermenu-trigger-rail' : ''}`}
        aria-haspopup="menu" aria-expanded={open}
        title={signedIn ? `${who} · ${standing}` : 'Account'}
        onClick={() => setOpen(o => !o)}>
        <span className="gecko-avatar gecko-avatar-accent">{initials}</span>
        {!collapsed && (
          <span className="gecko-usermenu-trigger-who">
            <span className="gecko-sidebar-user-name">{signedIn ? who : 'Not signed in'}</span>
            <span className="gecko-sidebar-user-role">{signedIn ? standing : 'Demo screens only'}</span>
          </span>
        )}
        {/* The unread dot lives out here: inside the menu it would only be seen
            by someone who already decided to look. */}
        <span className="gecko-notification-dot" />
        {!collapsed && <Icon name="chevronUp" size={12} />}
      </button>

      {open && (
        <>
          <div className="gecko-menu-scrim" onClick={() => setOpen(false)} />
          <div className="gecko-usermenu-panel" role="menu">

            <div className="gecko-usermenu-head">
              <span className="gecko-avatar gecko-avatar-accent">{initials}</span>
              <div className="gecko-usermenu-who">
                <div className="gecko-usermenu-name">{signedIn ? who : 'Not signed in'}</div>
                <div className="gecko-cell-meta">{signedIn ? standing : 'Sign in to use Gecko'}</div>
                {signedIn && account && <div className="gecko-cell-meta">{account}</div>}
              </div>
            </div>

            <div className="gecko-usermenu-sep" />

            <button type="button" className="gecko-usermenu-item" role="menuitem" disabled
              title="There is no notifications screen yet.">
              <Icon name="bell" size={15} />
              <span>Notifications</span>
              <span className="gecko-cell-meta">none yet</span>
            </button>

            <button type="button" className="gecko-usermenu-item" role="menuitem" disabled
              title="There is no help screen yet.">
              <Icon name="help" size={15} />
              <span>Help</span>
            </button>

            <div className="gecko-usermenu-sep" />

            {/* Two segmented choices rather than two more rows that open things:
                both are one tap and the current value is the control. */}
            <div className="gecko-usermenu-choice">
              <span className="gecko-usermenu-choice-label"><Icon name="globe" size={15} /> Language</span>
              <div className="gecko-segmented gecko-segmented-sm">
                {LANGUAGES.map(l => (
                  <button key={l.value} type="button"
                    className={`gecko-segmented-item${language === l.value ? ' gecko-segmented-item-active' : ''}`}
                    onClick={() => setLanguage(l.value as Language)}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="gecko-usermenu-choice">
              <span className="gecko-usermenu-choice-label"><Icon name="moon" size={15} /> Theme</span>
              <div className="gecko-segmented gecko-segmented-sm">
                {([['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']] as const).map(([value, icon, label]) => (
                  <button key={value} type="button" title={label}
                    className={`gecko-segmented-item${theme === value ? ' gecko-segmented-item-active' : ''}`}
                    onClick={() => setTheme(value as Theme)}>
                    <Icon name={icon} size={14} />
                  </button>
                ))}
              </div>
            </div>

            <div className="gecko-usermenu-sep" />

            <button type="button" className="gecko-usermenu-item" role="menuitem"
              disabled={!signedIn}
              title={signedIn ? undefined : 'Sign in first.'}
              onClick={() => { setOpen(false); setChanging(true); }}>
              <Icon name="lock" size={15} />
              <span>Change password</span>
            </button>

            <button type="button" className="gecko-usermenu-item" role="menuitem" onClick={() => go('/settings')}>
              <Icon name="settings" size={15} />
              <span>Settings</span>
            </button>

            <div className="gecko-usermenu-sep" />

            <button type="button" className="gecko-usermenu-item gecko-usermenu-item-danger" role="menuitem"
              disabled={!signedIn} onClick={() => void doSignOut()}>
              <Icon name="logOut" size={15} />
              <span>Sign out</span>
            </button>
          </div>
        </>
      )}

      {changing && <ChangePasswordDialog onClose={() => setChanging(false)} />}
    </div>
  );
}
