import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

function Svg({
  children,
  size = 24,
  className,
  color,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ color }}
    >
      {children}
    </svg>
  );
}

// --- Navigation ---

export function IconHome(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10.5z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function IconFamily(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="7" r="3" fill="currentColor" />
      <circle cx="17" cy="9" r="2.5" fill="currentColor" />
      <path
        d="M2 19c0-3.31 2.69-5 7-5s7 1.69 7 5"
        fill="currentColor"
        opacity="0.85"
      />
      <path d="M14 19c0-2.21 1.34-3.5 3-3.5s3 1.29 3 3.5" fill="currentColor" />
    </Svg>
  );
}

export function IconHistory(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.15" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function IconMapPin(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill="currentColor"
      />
      <circle cx="12" cy="9" r="2.5" fill="currentColor" opacity="0" stroke="currentColor" strokeWidth="0" />
      <circle cx="12" cy="9" r="2.5" fill="var(--page-bg-1, #fff)" />
    </Svg>
  );
}

// --- Categories ---

export function IconWater(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        d="M12 2.5C12 2.5 5 10.5 5 15a7 7 0 1014 0c0-4.5-7-12.5-7-12.5z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function IconFood(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        d="M12 2v8M8.5 5c0 2.76 1.57 5 3.5 5s3.5-2.24 3.5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M12 10v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function IconFuel(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        d="M12 2c-1.5 2.5-5 6.5-5 10a5 5 0 0010 0c0-3.5-3.5-7.5-5-10z"
        fill="currentColor"
      />
      <path
        d="M12 18c1.38 0 2.5-.9 2.5-2 0-1.1-1.12-2.5-2.5-4-1.38 1.5-2.5 2.9-2.5 4 0 1.1 1.12 2 2.5 2z"
        fill="var(--page-bg-1, #fff)"
        opacity="0.6"
      />
    </Svg>
  );
}

export function IconHygiene(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        d="M12 2l2.09 6.26L20 9.27l-4.91 3.82L16.18 20 12 16.27 7.82 20l1.09-6.91L4 9.27l5.91-1.01L12 2z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function IconMedical(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        d="M8 2h8v6h6v8h-6v6H8v-6H2V8h6V2z"
        fill="currentColor"
        opacity="0.9"
      />
    </Svg>
  );
}

export function IconEnergy(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" fill="currentColor" />
    </Svg>
  );
}

// --- KYC / General ---

export function IconPackage(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" opacity="0.15" />
      <path
        d="M12 2L3 7v10l9 5 9-5V7l-9-5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 12L3 7M12 12l9-5M12 12v10" stroke="currentColor" strokeWidth="2" />
    </Svg>
  );
}

export function IconIdCard(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="2" y="4" width="20" height="16" rx="3" fill="currentColor" opacity="0.15" />
      <rect
        x="2"
        y="4"
        width="20"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="9" cy="11" r="2.5" fill="currentColor" />
      <path d="M5 17c0-1.66 1.79-3 4-3s4 1.34 4 3" fill="currentColor" opacity="0.6" />
      <path d="M15 9h4M15 13h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconUser(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path
        d="M4 20c0-3.31 3.58-6 8-6s8 2.69 8 6"
        fill="currentColor"
        opacity="0.7"
      />
    </Svg>
  );
}

export function IconUserMale(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="7" r="4" fill="currentColor" />
      <path d="M4 21v-1c0-3.87 3.58-7 8-7s8 3.13 8 7v1" fill="currentColor" opacity="0.7" />
    </Svg>
  );
}

export function IconUserFemale(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="7" r="4" fill="currentColor" />
      <path d="M4 21v-1c0-3.87 3.58-7 8-7s8 3.13 8 7v1" fill="currentColor" opacity="0.7" />
      <path
        d="M15 7c0 .83-.34 1.58-.88 2.12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
    </Svg>
  );
}

export function IconHouse(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        d="M3 11l9-7 9 7v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M3 11l9-7 9 7v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="9" y="14" width="6" height="7" rx="1" fill="currentColor" opacity="0.5" />
    </Svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12l2.5 3L16 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconWarning(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function IconEmpty(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        d="M20 7H4l1.5 12A2 2 0 007.48 21h9.04a2 2 0 001.98-1.72L20 7z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M20 7H4l1.5 12A2 2 0 007.48 21h9.04a2 2 0 001.98-1.72L20 7z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M2 7h20M9 3h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function IconBuilding(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 21V5a2 2 0 012-2h14a2 2 0 012 2v16" fill="currentColor" opacity="0.15" />
      <path
        d="M3 21V5a2 2 0 012-2h14a2 2 0 012 2v16"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M1 21h22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="7" y="7" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="14" y="7" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="7" y="13" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="14" y="13" width="3" height="3" rx="0.5" fill="currentColor" />
    </Svg>
  );
}

export function IconStore(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 9l1.5-5h15L21 9" stroke="currentColor" strokeWidth="2" />
      <path d="M3 9v12h18V9" fill="currentColor" opacity="0.1" />
      <path d="M3 9v12h18V9" stroke="currentColor" strokeWidth="2" />
      <rect x="9" y="14" width="6" height="7" rx="1" fill="currentColor" opacity="0.4" />
      <path d="M3 9c0 1.66.9 3 2 3s2-1.34 2-3m0 0c0 1.66.9 3 2 3s2-1.34 2-3m0 0c0 1.66.9 3 2 3s2-1.34 2-3m0 0c0 1.66.9 3 2 3s2-1.34 2-3m0 0c0 1.66.9 3 2 3s2-1.34 2-3" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

export function IconTruck(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="1" y="6" width="14" height="10" rx="1" fill="currentColor" opacity="0.15" />
      <rect x="1" y="6" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="2" />
      <path d="M15 10h4l2 3v3h-6v-6z" fill="currentColor" opacity="0.3" />
      <path d="M15 10h4l2 3v3h-6v-6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="2" fill="currentColor" />
      <circle cx="18" cy="18" r="2" fill="currentColor" />
    </Svg>
  );
}

export function IconShield(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        d="M12 2l8 4v5c0 5.25-3.38 8.72-8 11-4.62-2.28-8-5.75-8-11V6l8-4z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M12 2l8 4v5c0 5.25-3.38 8.72-8 11-4.62-2.28-8-5.75-8-11V6l8-4z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconQrScan(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="7" y="7" width="4" height="4" rx="0.5" fill="currentColor" />
      <rect x="13" y="7" width="4" height="4" rx="0.5" fill="currentColor" />
      <rect x="7" y="13" width="4" height="4" rx="0.5" fill="currentColor" />
      <rect x="13" y="13" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.4" />
    </Svg>
  );
}

// --- Lookup map for category icons ---
export const CATEGORY_ICONS: Record<string, (p: IconProps) => React.JSX.Element> = {
  water: IconWater,
  food: IconFood,
  fuel: IconFuel,
  hygiene: IconHygiene,
  medical: IconMedical,
  energy: IconEnergy,
};

export const GENDER_ICONS: Record<string, (p: IconProps) => React.JSX.Element> = {
  male: IconUserMale,
  female: IconUserFemale,
  other: IconUser,
};

export const CENTER_TYPE_ICONS: Record<string, (p: IconProps) => React.JSX.Element> = {
  government: IconBuilding,
  private: IconStore,
  mobile: IconTruck,
};
