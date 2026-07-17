import { cn } from '../ui/index.js';

/**
 * Decorative wavy vertical stripes (Studydrive-style) rendered as an inline SVG.
 * Purely presentational; sits behind the auth aside content.
 */
export function WavyBackground({ className }: { className?: string }) {
  const xs = [-30, 25, 80, 135, 190, 245, 300, 355, 410];
  return (
    <svg
      className={cn('absolute inset-0 h-full w-full', className)}
      viewBox="0 0 380 760"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {xs.map((x) => (
        <path
          key={x}
          d={`M ${x} -40
              C ${x + 46} 90, ${x - 46} 200, ${x} 320
              S ${x + 46} 520, ${x} 640
              S ${x - 46} 820, ${x} 940`}
          fill="none"
          stroke="currentColor"
          strokeWidth="22"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
