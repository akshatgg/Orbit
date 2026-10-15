import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6">
      <Image src="/brand/orbit-mark.png" alt="ORBIT" width={120} height={120} priority />
      <h1 className="mt-6 font-display text-3xl font-semibold tracking-[0.4em]">ORBIT</h1>
      <p className="mt-2 text-xs tracking-[0.3em] text-muted">EXPLORE OPPORTUNITIES</p>
      <LoginForm />
    </main>
  );
}
