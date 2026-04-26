"use client";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import { Icon } from './Icon';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type BarcodeVariant = 'qr' | 'code128' | 'both';

export interface BarcodeDisplayProps {
  value: string;
  label?: string;
  variant?: BarcodeVariant;
  qrSize?: number;
  showValue?: boolean;
}

// ─── Inline QR component ────────────────────────────────────────────────────────

function QRBlock({ value, size, label, showValue }: { value: string; size: number; label?: string; showValue?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ padding: 8, background: '#fff', border: '1px solid var(--gecko-border)', borderRadius: 8 }}>
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          includeMargin={false}
          style={{ display: 'block' }}
        />
      </div>
      {label && (
        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{label}</div>
      )}
      {showValue && (
        <div style={{ fontSize: 10, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-disabled)', textAlign: 'center', wordBreak: 'break-all', maxWidth: size + 16 }}>{value}</div>
      )}
    </div>
  );
}

// ─── Inline Code128 component ───────────────────────────────────────────────────

function Code128Block({ value, label, showValue, width }: { value: string; label?: string; showValue?: boolean; width?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ padding: '8px 12px', background: '#fff', border: '1px solid var(--gecko-border)', borderRadius: 8, overflow: 'hidden', maxWidth: width ?? 220 }}>
        <Barcode
          value={value}
          format="CODE128"
          width={1.4}
          height={52}
          displayValue={false}
          background="#ffffff"
          lineColor="#000000"
          margin={0}
        />
      </div>
      {label && (
        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{label}</div>
      )}
      {showValue && (
        <div style={{ fontSize: 10, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-disabled)', textAlign: 'center' }}>{value}</div>
      )}
    </div>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────────

export function BarcodeDisplay({
  value,
  label,
  variant = 'both',
  qrSize = 80,
  showValue = true,
}: BarcodeDisplayProps) {
  if (!value) return null;

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {(variant === 'qr' || variant === 'both') && (
        <QRBlock value={value} size={qrSize} label={variant === 'both' ? 'QR Code' : label} showValue={variant !== 'both' && showValue} />
      )}
      {(variant === 'code128' || variant === 'both') && (
        <Code128Block value={value} label={variant === 'both' ? 'Code 128' : label} showValue={variant !== 'both' && showValue} />
      )}
      {variant === 'both' && showValue && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, flex: 1, minWidth: 120 }}>
          {label && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gecko-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>}
          <div style={{ fontSize: 12, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', fontWeight: 700, wordBreak: 'break-all' }}>{value}</div>
          <div style={{ fontSize: 10.5, color: 'var(--gecko-text-secondary)', marginTop: 2 }}>Scan to open in system</div>
        </div>
      )}
    </div>
  );
}

// ─── PrintDocumentModal ──────────────────────────────────────────────────────────
// Reusable full-page print overlay with document details + barcodes

export interface PrintDocumentModalProps {
  open: boolean;
  onClose: () => void;
  docType: string;
  docNo: string;
  barcodeValue: string;
  extraBarcodes?: { value: string; label: string }[];
  details?: { label: string; value: string }[];
  children?: React.ReactNode;
}

export function PrintDocumentModal({
  open, onClose, docType, docNo, barcodeValue, extraBarcodes, details, children,
}: PrintDocumentModalProps) {
  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: 'var(--gecko-bg-surface)',
        borderRadius: 12,
        width: '100%',
        maxWidth: 560,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Modal header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gecko-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-secondary)' }}>{docType}</div>
            <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--gecko-font-mono)', color: 'var(--gecko-text-primary)', marginTop: 2 }}>{docNo}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.print()} style={{
              padding: '6px 14px', borderRadius: 7, border: '1px solid var(--gecko-border)',
              background: 'var(--gecko-primary-600)', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              🖨 Print
            </button>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 7, border: '1px solid var(--gecko-border)',
              background: 'var(--gecko-bg-subtle)', color: 'var(--gecko-text-secondary)',
              fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>
        </div>

        {/* Barcodes section */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-secondary)', marginBottom: 12 }}>Document Barcodes</div>
          <div style={{ padding: 16, background: 'var(--gecko-bg-subtle)', borderRadius: 10, border: '1px solid var(--gecko-border)' }}>
            <BarcodeDisplay value={barcodeValue} label={docType} variant="both" qrSize={90} showValue />
          </div>

          {/* Extra barcodes (e.g. container no alongside booking no) */}
          {extraBarcodes && extraBarcodes.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {extraBarcodes.map(eb => (
                <div key={eb.value} style={{ padding: '12px 16px', background: 'var(--gecko-bg-subtle)', borderRadius: 10, border: '1px solid var(--gecko-border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-secondary)', marginBottom: 10 }}>{eb.label}</div>
                  <BarcodeDisplay value={eb.value} variant="both" qrSize={72} showValue />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Key details grid */}
        {details && details.length > 0 && (
          <div style={{ padding: '16px 20px 0' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-secondary)', marginBottom: 10 }}>Document Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {details.map(d => (
                <div key={d.label} style={{ padding: '8px 12px', background: 'var(--gecko-bg-subtle)', borderRadius: 8, border: '1px solid var(--gecko-border)' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gecko-text-disabled)', marginBottom: 2 }}>{d.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gecko-text-primary)', fontFamily: 'var(--gecko-font-mono)' }}>{d.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optional extra content */}
        {children && <div style={{ padding: '16px 20px 0' }}>{children}</div>}

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

// ─── BarcodeScanInput ────────────────────────────────────────────────────────────
// Accepts input from a physical handheld scanner (rapid keystrokes + Enter)
// OR manual keyboard entry. Calls onScan(value) when Enter is pressed or
// scanner completes its burst. Auto-clears after each scan.

export interface BarcodeScanInputProps {
  onScan: (value: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
  autoFocus?: boolean;
  label?: string;
}

export function BarcodeScanInput({
  onScan,
  placeholder = 'Scan or type barcode + Enter…',
  size = 'md',
  style,
  autoFocus,
  label,
}: BarcodeScanInputProps) {
  const [value, setValue]     = useState('');
  const [focused, setFocused] = useState(false);
  const [flash, setFlash]     = useState<'success' | 'error' | null>(null);
  const inputRef              = useRef<HTMLInputElement>(null);
  const lastKeyTime           = useRef<number>(0);
  const scanBuffer            = useRef<string>('');

  const inputClass = size === 'sm' ? 'gecko-input gecko-input-sm' : 'gecko-input';

  const triggerScan = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setFlash('success');
    onScan(trimmed);
    setValue('');
    scanBuffer.current = '';
    setTimeout(() => setFlash(null), 600);
  }, [onScan]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now();
    const timeSinceLast = now - lastKeyTime.current;
    lastKeyTime.current = now;

    if (e.key === 'Enter') {
      e.preventDefault();
      triggerScan(value);
      return;
    }

    // Detect scanner burst: keystrokes < 30ms apart = scanner, not human
    if (timeSinceLast < 30) {
      scanBuffer.current += e.key.length === 1 ? e.key : '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const handleClear = () => {
    setValue('');
    scanBuffer.current = '';
    setFlash(null);
    inputRef.current?.focus();
  };

  // Border colour based on state
  const borderColor = flash === 'success'
    ? '#22c55e'
    : flash === 'error'
    ? '#ef4444'
    : focused
    ? 'var(--gecko-primary-400)'
    : 'var(--gecko-border)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gecko-text-secondary)' }}>{label}</div>
      )}
      <div style={{ position: 'relative' }}>
        {/* Scanner icon */}
        <span style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          color: flash === 'success' ? '#22c55e' : focused ? 'var(--gecko-primary-500)' : 'var(--gecko-text-secondary)',
          pointerEvents: 'none', display: 'flex', alignItems: 'center',
          transition: 'color 200ms',
        }}>
          <Icon name="scan" size={size === 'sm' ? 13 : 15} />
        </span>

        <input
          ref={inputRef}
          className={inputClass}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          style={{
            paddingLeft: size === 'sm' ? 30 : 34,
            paddingRight: value ? 30 : 10,
            border: `1.5px solid ${borderColor}`,
            transition: 'border-color 200ms',
            background: flash === 'success' ? '#f0fdf4' : flash === 'error' ? '#fef2f2' : undefined,
            fontFamily: 'var(--gecko-font-mono)',
            letterSpacing: '0.02em',
          }}
        />

        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--gecko-text-disabled)', padding: 2, lineHeight: 1,
              display: 'flex', alignItems: 'center',
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Status hint */}
      {flash === 'success' && (
        <div style={{ fontSize: 10.5, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="checkCircle" size={11} /> Barcode scanned
        </div>
      )}
    </div>
  );
}
