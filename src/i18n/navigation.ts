import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

const navigation = createNavigation(routing);

export const { Link, usePathname, useRouter } = navigation;
