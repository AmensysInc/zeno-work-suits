import { redirect } from 'next/navigation';

// Unknown paths land on the dashboard, as before.
export default function NotFound() {
  redirect('/dashboard');
}
