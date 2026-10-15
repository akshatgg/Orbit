import Image from "next/image";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
      <Image src="/brand/orbit-mark.png" alt="" width={96} height={96} />
      <h1 className="font-display text-xl font-semibold tracking-wide">You&apos;re offline</h1>
      <p className="text-sm text-muted">Reconnect to see the latest events.</p>
    </main>
  );
}
