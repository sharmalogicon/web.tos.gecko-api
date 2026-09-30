"use client";
import { useParams } from 'next/navigation';
import { EirDetailView } from '../../_components/EirDetailView';

/** One EIR: the move, seals, survey and damages, photos, holds, the PDF and the void. */
export default function EirDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <EirDetailView id={id} />;
}
