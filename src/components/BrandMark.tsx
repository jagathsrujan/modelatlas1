/**
 * The ModelAtlas mark: two inward-pointing triangles forming an "M"
 * silhouette with an "A" negative space, plus the small solid counter
 * triangle. Traced from the official brand poster asset.
 */
export function BrandMarkPaths({ fill = "currentColor" }: { fill?: string }) {
  return (
    <g fill={fill}>
      <path d="M0 0 L0 143 L72.5 48.5 Z" />
      <path d="M145 0 L145 143 L72.5 48.5 Z" />
      <path d="M72.5 82.5 L55 115 L90 115 Z" />
    </g>
  );
}

export function BrandMark({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 145 143"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <BrandMarkPaths />
    </svg>
  );
}

/** Small rounded brand tile used in nav bars and the sidebar. */
export function BrandTile({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = size === "sm" ? "h-6 w-6 rounded-[7px]" : size === "lg" ? "h-9 w-9 rounded-[10px]" : "h-8 w-8 rounded-lg";
  const pad = size === "sm" ? "p-[4px]" : size === "lg" ? "p-[7px]" : "p-[5.5px]";
  return (
    <span className={`grid shrink-0 place-items-center bg-[#10151c] text-white dark:bg-white dark:text-[#10151c] ${dims} ${pad} ${className}`}>
      <BrandMark className="h-full w-full" />
    </span>
  );
}

/** Horizontal lockup: mark + wordmark. */
export function BrandLockup({ className = "", markClass = "h-7 w-auto", textClass = "text-[15px] font-semibold tracking-tight" }: { className?: string; markClass?: string; textClass?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandMark className={`${markClass} text-[#10151c] dark:text-white`} />
      <span className={`${textClass} text-[#10151c] dark:text-white`}>ModelAtlas</span>
    </span>
  );
}
