import { useEffect, useState } from "react";

/**
 * Tiny zero-dependency confetti burst. Renders 24 pieces fixed to the
 * viewport that fall + rotate for ~1.6s then unmount. Uses the
 * `confetti-fall` keyframe added to src/styles.css.
 */
export function Confetti({ onDone }: { onDone?: () => void }) {
  const [alive, setAlive] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      setAlive(false);
      onDone?.();
    }, 1700);
    return () => clearTimeout(t);
  }, [onDone]);
  if (!alive) return null;
  const colors = ["#FFB347", "#7AB8E8", "#C28FE8", "#86E8AA", "#F4806A"];
  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden" aria-hidden>
      {Array.from({ length: 24 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.25;
        const duration = 1.2 + Math.random() * 0.6;
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${left}vw`,
              backgroundColor: color,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}