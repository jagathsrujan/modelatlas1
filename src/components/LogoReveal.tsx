import { BrandMark } from "@/components/BrandMark";

/**
 * The ModelAtlas brand moment — a calm, cinematic reveal rendered entirely
 * in SVG + CSS so it is resolution-independent, costs no video decode, keeps
 * working without JavaScript, and collapses to a static final state under
 * prefers-reduced-motion (handled in globals.css).
 *
 * Choreography (see .cinema-* keyframes):
 *   0.0s  electric-blue glow blooms deep in the stage
 *   0.6s  the MA mark materializes out of a soft blur (focus pull)
 *   1.6s  the wordmark wipes in left -> right while sharpening
 *   3.1s  the advisor tagline settles
 *   4.4s  glow shifts blue -> cyan/green and rests calm
 */
export function LogoReveal({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={`relative mx-auto w-full ${className}`}>
      <div
        className={`cinema w-full ${compact ? "aspect-[16/9]" : "aspect-[4/3] sm:aspect-[16/10]"}`}
        role="img"
        aria-label="ModelAtlas — AI Infrastructure Advisor"
      >
        <div className="cinema-glow" aria-hidden />
        <div className="cinema-rest-glow" aria-hidden />
        <div className="cinema-sheen" aria-hidden />
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 px-6 sm:gap-4">
          <BrandMark
            className={`cinema-mark w-auto text-[#e8eef6] ${compact ? "h-12 sm:h-14" : "h-16 sm:h-20 lg:h-24"}`}
          />
          <div
            className={`cinema-word font-display tracking-[-0.02em] text-[#eef3f9] ${
              compact ? "text-2xl sm:text-3xl" : "text-[34px] leading-none sm:text-5xl lg:text-[54px]"
            }`}
          >
            ModelAtlas
          </div>
          <div
            className={`cinema-tag font-medium uppercase text-[#fb923c] ${compact ? "text-[9px] tracking-[0.24em]" : "text-[10px] tracking-[0.3em] sm:text-[11px]"}`}
          >
            AI Infrastructure Advisor
          </div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[18%] bottom-[16%] h-px bg-gradient-to-r from-transparent via-[#3b82f6]/25 to-transparent"
        />
      </div>
    </div>
  );
}
