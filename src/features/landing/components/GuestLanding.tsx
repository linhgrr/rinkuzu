import LandingPage from './home/LandingPage';

interface GuestLandingProps {
  isAuthenticated?: boolean;
  locale: string;
}

export function GuestLanding({ isAuthenticated = false, locale }: GuestLandingProps) {
  return <LandingPage isAuthenticated={isAuthenticated} locale={locale} />;
}
