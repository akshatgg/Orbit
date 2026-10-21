import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconCheck = (p: IconProps) => <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>;
export const IconX = (p: IconProps) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
export const IconStar = (p: IconProps) => (
  <Svg {...p}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></Svg>
);
export const IconBan = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m5.7 5.7 12.6 12.6" /></Svg>;
export const IconTrash = (p: IconProps) => (
  <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>
);
export const IconEyeOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.7 2.7M6.6 6.6A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m2 2 20 20" />
  </Svg>
);
export const IconUndo = (p: IconProps) => <Svg {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></Svg>;
export const IconEye = (p: IconProps) => (
  <Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>
);
export const IconPencil = (p: IconProps) => <Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" /></Svg>;
export const IconDots = (p: IconProps) => (
  <Svg {...p}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></Svg>
);
export const IconPlus = (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconChevronDown = (p: IconProps) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const IconPlay = (p: IconProps) => <Svg {...p}><path d="M7 5v14l11-7z" /></Svg>;
export const IconMenu = (p: IconProps) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>;
export const IconArrowLeft = (p: IconProps) => <Svg {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></Svg>;
export const IconGrid = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.6" /><rect x="14" y="3" width="7" height="7" rx="1.6" /><rect x="3" y="14" width="7" height="7" rx="1.6" /><rect x="14" y="14" width="7" height="7" rx="1.6" /></Svg>
);
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3 10h18" /></Svg>
);
export const IconUsers = (p: IconProps) => (
  <Svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M17.5 14.2A5.5 5.5 0 0 1 21 20" /></Svg>
);
export const IconTag = (p: IconProps) => (
  <Svg {...p}><path d="M3.5 12.2V5a1.5 1.5 0 0 1 1.5-1.5h7.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.4z" /><circle cx="8" cy="8" r="1.2" /></Svg>
);
export const IconRss = (p: IconProps) => (
  <Svg {...p}><circle cx="6" cy="18" r="1.6" /><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" /></Svg>
);
export const IconUpload = (p: IconProps) => <Svg {...p}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></Svg>;
export const IconDownload = (p: IconProps) => <Svg {...p}><path d="M12 4v12M7 11l5 5 5-5M4 20h16" /></Svg>;
export const IconShield = (p: IconProps) => <Svg {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /></Svg>;
export const IconSearch = (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const IconExternal = (p: IconProps) => (
  <Svg {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" /></Svg>
);
export const IconFlag = (p: IconProps) => <Svg {...p}><path d="M5 21V4h11l-2 4 2 4H5" /></Svg>;
export const IconBadge = (p: IconProps) => (
  <Svg {...p}><path d="m12 2 2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1.2 3 1.2 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1-2.8-1.6 1.2-3-1.2-3 2.8-1.6.9-3.1 3.2.3z" /><path d="m9 12 2 2 4-4" /></Svg>
);
export const IconInfo = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>;
