interface MinistryLogoProps {
  /** Height controls size; width auto-scales to the emblem's aspect ratio. */
  className?: string;
}

/**
 * Emblem of the Ministry of Agriculture & Farmers Welfare, Government of India.
 * Vector reproduction of the agricoop.gov.in header logo (via Wikimedia Commons),
 * pre-tinted slate-800 so it blends with the navbar's typography.
 * Served from /public — cached by the browser, never re-parsed by JS.
 */
export default function MinistryLogo({ className = "h-9 w-auto" }: MinistryLogoProps) {
  return (
    <img
      src="/ministry-emblem.svg"
      alt="Ministry of Agriculture and Farmers Welfare, Government of India"
      draggable={false}
      loading="eager"
      className={`inline-block select-none ${className}`}
    />
  );
}
