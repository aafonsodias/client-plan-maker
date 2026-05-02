import { User } from "lucide-react";

/**
 * Compact circular avatar for clients.
 *
 * Falls back to a `User` icon over a muted disc when the client has no
 * `photo_url`. Sized via the `size` prop (defaults to 32px) so it can sit
 * comfortably in list rows or page headers without bespoke wrappers.
 */
export function ClientAvatar({
  name,
  photoUrl,
  size = 32,
  className = "",
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        loading="lazy"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover ring-1 ring-border ${className}`}
      />
    );
  }

  return (
    <div
      aria-hidden
      style={{ width: size, height: size }}
      className={`flex items-center justify-center rounded-full bg-secondary text-muted-foreground ring-1 ring-border ${className}`}
      title={name}
    >
      {initials ? (
        <span
          className="font-medium leading-none"
          style={{ fontSize: Math.max(10, Math.round(size * 0.38)) }}
        >
          {initials}
        </span>
      ) : (
        <User style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </div>
  );
}