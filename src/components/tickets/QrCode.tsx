import QRCode from "qrcode";

/** Server-rendered QR as inline SVG: dark modules on a white panel for reliable scanning. */
export async function QrCode({ value, label }: { value: string; label: string }) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#05040c", light: "#ffffff" },
  });
  return (
    <div
      role="img"
      aria-label={label}
      className="mx-auto aspect-square w-full max-w-[16rem] overflow-hidden rounded-[20px] bg-white p-3.5 shadow-[0_8px_30px_-8px_rgb(0_0_0/0.6)] [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
