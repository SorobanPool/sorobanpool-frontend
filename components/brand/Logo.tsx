import { APP_NAME } from '@/lib/config';

/**
 * Brand mark: three market traders (circles) meeting in one shared basket. Pure SVG, no JS, scales crisply.
 * The product name comes from `APP_NAME` so a rename (brief 1.5) stays a one-line change.
 */
export function LogoMark({ className = 'size-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="12" fill="#064e3b" />
      <circle cx="13" cy="15" r="4.5" fill="#6ee7b7" />
      <circle cx="27" cy="15" r="4.5" fill="#6ee7b7" />
      <circle cx="20" cy="11" r="4.5" fill="#fcd34d" />
      <path d="M8 21h24l-3.2 9.6a3 3 0 0 1-2.85 2.05H14.05a3 3 0 0 1-2.85-2.05L8 21Z" fill="#ecfdf5" />
      <path d="M14 25.5h12" stroke="#064e3b" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-3 text-lg font-bold tracking-tight text-emerald-950 ${className}`}>
      <LogoMark className="size-10 drop-shadow-sm" />
      <span>{APP_NAME}</span>
    </span>
  );
}
