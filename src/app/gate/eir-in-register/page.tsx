"use client";
import { EirRegister } from '../_components/EirRegister';

/**
 * EIR-In register — every gate-in recorded, newest first.
 *
 * It used to sit underneath the Gate In form. It was taken off that screen on
 * 2026-10-04 (owner): Gate In is where a clerk keys ONE truck, and a register
 * of 2,823 past receipts below the form is a different job on the same page.
 * It gets its own route here, as the EIR-Out register already had.
 */
export default function EirInRegisterPage() {
  return <EirRegister direction="IN" />;
}
