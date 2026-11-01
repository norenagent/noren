import { permanentRedirect } from 'next/navigation';

// Noren Desk lives on the Robinhood Chain page; this keeps the short link.
export default function DeskPage() {
  permanentRedirect('/robinhood#desk');
}
