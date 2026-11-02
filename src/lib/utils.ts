import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export { generateSlug } from './slug';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
