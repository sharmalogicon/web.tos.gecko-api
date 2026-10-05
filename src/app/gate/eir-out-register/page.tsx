"use client";
import { EirRegister } from '../_components/EirRegister';

/**
 * EIR-Out register — every gate-out recorded, newest first.
 *
 * It held /gate/eir-out until 2026-10-05, when that route became the Gate Out
 * form. The pair now mirrors Gate In: a form at the short route, the register
 * beside it.
 */
export default function EirOutRegisterPage() {
  return <EirRegister direction="OUT" />;
}
