import Image from "next/image";
import { LOGO_SRC } from "@/lib/brand";

/** The ORBIT logo. Use this everywhere the mark appears so every screen shows the same image. */
export function OrbitLogo({ size, alt = "", priority, className }: {
  size: number;
  alt?: string;
  priority?: boolean;
  className?: string;
}) {
  return <Image src={LOGO_SRC} alt={alt} width={size} height={size} priority={priority} className={className} />;
}
