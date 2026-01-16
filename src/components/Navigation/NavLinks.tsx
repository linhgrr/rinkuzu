import Link from 'next/link';

interface NavLink {
  href: string;
  label: string;
  isAdmin?: boolean;
}

const LINKS: NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/create', label: 'Create' },
  { href: '/profile?tab=quizzes', label: 'My Quizzes' },
  { href: '/categories', label: 'Categories' },
  { href: '/explore', label: 'Explore' },
];

interface NavLinksProps {
  isAdmin?: boolean;
}

/**
 * Static navigation links - can be used in Server Components
 * Admin link is conditionally rendered based on isAdmin prop
 */
export function NavLinks({ isAdmin = false }: NavLinksProps) {
  return (
    <>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="px-4 py-2 text-sm font-medium text-[#1d1d1f] hover:text-[#0071e3] rounded-full transition-colors"
        >
          {link.label}
        </Link>
      ))}
      {isAdmin && (
        <Link
          href="/admin/queue"
          className="px-4 py-2 text-sm font-medium text-[#af52de] hover:text-[#8944ab] rounded-full transition-colors"
        >
          Admin
        </Link>
      )}
    </>
  );
}
