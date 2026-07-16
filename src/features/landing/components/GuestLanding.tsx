import LandingPage from './home/LandingPage';

interface GuestLandingProps {
  locale: string;
  isAuthenticated?: boolean;
}

export function GuestLanding({ locale, isAuthenticated = false }: GuestLandingProps) {
  return <LandingPage locale={locale} isAuthenticated={isAuthenticated} />;
}
