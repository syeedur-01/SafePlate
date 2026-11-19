/**
 * Single place the SafePlate wordmark is rendered from. The current asset is the
 * supplied brand PNG (resized to 640x213, original aspect ratio preserved); when
 * the final SVG/PNG arrives, replace `public/logo/safeplate-logo.png` only.
 */
const LOGO_SRC = '/logo/safeplate-logo.png';
const LOGO_WIDTH = 640;
const LOGO_HEIGHT = 213;

export interface LogoProps {
  /** Tailwind height class of the rendered mark, for example `h-7` or `h-16`. */
  className?: string;
}

/** Returns the SafePlate logo image with its intrinsic aspect ratio preserved. */
export function Logo({ className = 'h-7' }: LogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt="SafePlate"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      className={`w-auto ${className}`}
      decoding="async"
    />
  );
}
