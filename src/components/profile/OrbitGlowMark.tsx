import Image from "next/image";

/** The ORBIT emblem with the logo's soft iridescent halo and a slowly turning orbit ring. */
export function OrbitGlowMark({ size = 148 }: { size?: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size * 1.6, height: size * 1.6 }}>
      <div aria-hidden className="bg-gradient absolute inset-[18%] rounded-full opacity-40 blur-3xl" />
      <div
        aria-hidden
        className="absolute inset-[6%] animate-spin rounded-full border border-violet/25 motion-reduce:animate-none"
        style={{ animationDuration: "28s" }}
      >
        <span className="bg-gradient absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full shadow-[0_0_14px_3px_rgb(222_159_251/0.7)]" />
      </div>
      <Image src="/brand/orbit-mark.png" alt="ORBIT" width={size} height={size} priority className="relative drop-shadow-[0_0_28px_rgb(181_124_246/0.45)]" />
    </div>
  );
}
