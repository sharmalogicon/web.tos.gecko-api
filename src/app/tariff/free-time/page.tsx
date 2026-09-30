import { redirect } from 'next/navigation';

/**
 * FREE TIME — merged into Tariff Schedules.
 *
 * This was a mock editor (a rule model of extensions and multipliers that the
 * Revenue API never had, with fake saves). Free time is edited and shown per tariff version, on the schedule's own page (its Free time tab),
 * bound to the API with maker-checker approval. Old links land on the schedules.
 */
export default function FreeTimeRedirect() {
  redirect('/tariff/plans');
}
