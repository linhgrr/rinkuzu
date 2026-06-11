import LandingPage from './home/LandingPage';

interface GuestLandingProps {
  isAuthenticated?: boolean;
}

export function GuestLanding({ isAuthenticated = false }: GuestLandingProps) {
  return <LandingPage isAuthenticated={isAuthenticated} />;
}
