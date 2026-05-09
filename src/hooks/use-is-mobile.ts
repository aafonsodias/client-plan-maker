import { useEffect, useState } from "react";

/**
 * Returns true when viewport width <= breakpoint (default 1024px).
 * Used by the assessment stepper and other mobile/tablet-first surfaces.
 */
export function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}
