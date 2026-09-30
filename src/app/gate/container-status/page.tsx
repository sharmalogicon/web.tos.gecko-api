import { redirect } from 'next/navigation';

/**
 * CONTAINER STATUS — merged into the unit inquiry.
 *
 * This was a second mock of one box's facts (with a fake "status update" save).
 * The box's story now lives, read from the API, at /units/unit-inquiry; the yard
 * list is /gate/stock. Old links and bookmarks land there, keeping the number.
 */
export default async function ContainerStatusRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.no ?? params.containerNo;
  const no = Array.isArray(raw) ? raw[0] : raw;
  redirect(no ? `/units/unit-inquiry?no=${encodeURIComponent(no)}` : '/units/unit-inquiry');
}
