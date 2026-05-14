import { redirect } from 'next/navigation';

// App entry point. Always lands on /login.
// Once Azure AD B2C ships in Phase 1 backend, this will move to middleware:
// authenticated session → /dashboard/overview, otherwise → /login.
export default function Home() {
  redirect('/login');
}
