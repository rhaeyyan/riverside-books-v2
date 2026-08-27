// Shared reduced-motion check for imperative motion (e.g. scrollIntoView
// behavior) that CSS media queries alone can't gate. CSS-driven animation
// and transitions should still use `@media (prefers-reduced-motion: reduce)`
// directly in the stylesheet.
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
