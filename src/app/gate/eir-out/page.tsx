"use client";
import { EirRegister } from '../_components/EirRegister';

/** EIR-Out register — gate-outs recorded at the desk (/gate/desk). */
export default function EirOutRegisterPage() {
  return <EirRegister direction="OUT" />;
}
