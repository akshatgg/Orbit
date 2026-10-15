import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`glass rounded-[22px] p-4 ${className}`} {...props} />;
}
