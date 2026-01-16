import Link from 'next/link';
import { Button } from '@/components/ui/Button';

/**
 * Guest navigation links - static component for non-authenticated users
 */
export function GuestLinks() {
  return (
    <div className="flex items-center gap-3">
      <Link href="/login">
        <Button variant="ghost" size="sm">
          Sign In
        </Button>
      </Link>
      <Link href="/register">
        <Button variant="primary" size="sm">
          Get Started
        </Button>
      </Link>
    </div>
  );
}
