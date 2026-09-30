import { redirect } from 'next/navigation';

/**
 * RATE CARDS — merged into Tariff Schedules.
 *
 * This was a mock editor (a rule model of extensions and multipliers that the
 * Revenue API never had, with fake saves). Rates are edited and shown per tariff version, on the schedule's own page (its Charges and Storage tabs, and Excel import),
 * bound to the API with maker-checker approval. Old links land on the schedules.
 */
export default function RateCardsRedirect() {
  redirect('/tariff/plans');
}
