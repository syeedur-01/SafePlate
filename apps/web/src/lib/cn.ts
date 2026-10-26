import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Returns the merged class names with later Tailwind utilities winning. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
