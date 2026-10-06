import type { ReactNode, SVGProps } from "react";

type IconName = "brand" | "panel" | "plus" | "search" | "edit" | "trash" | "globe" | "globeOff" | "message" | "chevronDown" | "sparkles" | "external" | "check" | "alert";
type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & { name: IconName; size?: number };

const paths: Record<IconName, ReactNode> = {
  brand: <><path d="M12 2.5 14 8l5.5 2-5.5 2-2 5.5-2-5.5-5.5-2L10 8z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9 4v16" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  edit: <><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z" /><path d="m14 7 3 3" /></>,
  trash: <><path d="M4.5 7h15M9 7V4.5h6V7M7 7l.8 12h8.4L17 7M10 10.5v5M14 10.5v5" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z" /></>,
  globeOff: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z" /><path d="m5 5 14 14" /></>,
  message: <><path d="M20 11.5a8 8 0 0 1-8 8 8.5 8.5 0 0 1-3.3-.7L4 20l1.2-4.7a8 8 0 1 1 14.8-3.8Z" /></>,
  chevronDown: <><path d="m6 9 6 6 6-6" /></>,
  sparkles: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="m19 16 .6 1.4L21 18l-1.4.6L19 20l-.6-1.4L17 18l1.4-.6z" /></>,
  external: <><path d="M13 5h6v6M19 5l-9 9" /><path d="M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" /></>,
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
  alert: <><path d="M12 3 21 20H3z" /><path d="M12 9v4M12 17h.01" /></>,
};

export function Icon({ name, size = 18, ...props }: IconProps) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>;
}
