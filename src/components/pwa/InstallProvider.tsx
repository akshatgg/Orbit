"use client";

import type { ReactNode } from "react";
import { InstallGuideSheet } from "./InstallGuideSheet";

/** Mounts the single iOS guide sheet; every InstallButton/Banner opens it through the shared store. */
export function InstallProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <InstallGuideSheet />
    </>
  );
}
