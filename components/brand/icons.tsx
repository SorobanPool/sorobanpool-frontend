/** Small stroke icons (24px grid). Decorative: callers pair each one with visible text. */
type P = { className?: string };
const base = (className = 'size-6') => ({ viewBox: '0 0 24 24', className, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, focusable: false as const });

export const ShieldIcon = ({ className }: P) => (<svg {...base(className)}><path d="M12 3 5 6v5.5c0 4.3 2.9 8.1 7 9.5 4.1-1.4 7-5.2 7-9.5V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>);
export const TruckIcon = ({ className }: P) => (<svg {...base(className)}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></svg>);
export const RefundIcon = ({ className }: P) => (<svg {...base(className)}><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 4v4.5h4.5" /><path d="M12 8v4l2.5 1.5" /></svg>);
export const SearchIcon = ({ className }: P) => (<svg {...base(className)}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>);
export const UsersIcon = ({ className }: P) => (<svg {...base(className)}><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9.5" r="2.4" /><path d="M15.5 14.2A4.5 4.5 0 0 1 21 19" /></svg>);
export const FingerprintIcon = ({ className }: P) => (<svg {...base(className)}><path d="M7 11a5 5 0 0 1 10 0v2" /><path d="M12 11v4c0 2-1 3.5-2 4.5" /><path d="M9.5 11.5v2c0 1.5-.5 3-1.5 4" /><path d="M14.5 13c0 2.5-.5 4.5-1.5 6" /><path d="M4.5 9a8 8 0 0 1 15 0" /></svg>);
export const ArrowIcon = ({ className }: P) => (<svg {...base(className ?? 'size-5')}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
