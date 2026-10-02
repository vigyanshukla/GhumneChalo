import type { Metadata } from 'next';
import OfflineClient from './OfflineClient';

export const metadata: Metadata = {
  title: 'Offline | GhumneChalo',
  description: 'You are currently offline. Access cached trips and emergency resources.',
};

export default function OfflinePage() {
  return <OfflineClient />;
}
