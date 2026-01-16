/**
 * Navigation Component
 *
 * Split into composable parts:
 * - NavLogo: Static logo (Server Component compatible)
 * - NavLinks: Static navigation links (Server Component compatible)
 * - GuestLinks: Static guest links (Server Component compatible)
 * - NavigationClient: Full client navigation with interactivity
 *
 * Usage:
 * - For full navigation with auth: import Navigation from '@/components/Navigation'
 * - For individual parts: import { NavLogo, NavLinks } from '@/components/Navigation'
 */

export { NavLogo } from './NavLogo';
export { NavLinks } from './NavLinks';
export { GuestLinks } from './GuestLinks';
export { default } from './NavigationClient';
