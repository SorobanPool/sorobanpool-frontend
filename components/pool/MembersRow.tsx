'use client';

interface Member {
  displayName?: string | null;
  optedIn?: boolean;
}

interface MembersRowProps {
  members: Member[];
  totalCount: number;
}

/**
 * Shows up to 5 member initials circles and '+N more' overflow.
 * Respects opt-in flag: shows initials only when opted in, otherwise anonymous shapes.
 * Never shows phone numbers or personal data.
 */
export function MembersRow({ members, totalCount }: MembersRowProps) {
  if (totalCount === 0) return null;

  const visible = members.slice(0, 5);
  const overflow = Math.max(0, totalCount - visible.length);
  
  return (
    <div 
      className="flex items-center gap-2" 
      role="img" 
      aria-label={`${totalCount} traders joined`}
    >
      <div className="flex -space-x-2">
        {visible.map((member, idx) => (
          <MemberAvatar 
            key={idx} 
            displayName={member.displayName} 
            optedIn={member.optedIn ?? false}
            index={idx}
          />
        ))}
      </div>
      {overflow > 0 && (
        <span className="text-sm font-medium text-neutral-700">
          +{overflow} more
        </span>
      )}
    </div>
  );
}

interface MemberAvatarProps {
  displayName?: string | null;
  optedIn: boolean;
  index: number;
}

function MemberAvatar({ displayName, optedIn, index }: MemberAvatarProps) {
  const colors = [
    'bg-emerald-600',
    'bg-blue-600', 
    'bg-purple-600',
    'bg-amber-600',
    'bg-rose-600'
  ];
  
  const bgColor = colors[index % colors.length];
  
  // If opted in and has display name, show initials
  if (optedIn && displayName) {
    const initials = getInitials(displayName);
    return (
      <div 
        className={`flex size-10 items-center justify-center rounded-full ${bgColor} text-sm font-bold text-white ring-2 ring-white`}
        aria-hidden="true"
      >
        {initials}
      </div>
    );
  }
  
  // Otherwise show anonymous shape
  return (
    <div 
      className={`size-10 rounded-full ${bgColor} ring-2 ring-white`}
      aria-hidden="true"
    />
  );
}

/**
 * Extract initials from display name.
 * Takes first letter of first two words, max 2 characters.
 * Filters out non-letter characters for privacy.
 */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  const letters = words
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .filter(char => /[A-Z]/i.test(char));
  
  return letters.slice(0, 2).join('');
}
