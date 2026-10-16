import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { ALLOWED_FORMATS, MAX_BYTES, UPLOAD_KINDS, getCloudinaryConfig, signParams } from "@/lib/cloudinary";

const body = z.object({ kind: z.enum(UPLOAD_KINDS) });

// Signs a Cloudinary upload for the signed-in user. The API secret never leaves the server;
// the browser uploads straight to Cloudinary with the returned signature.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to upload images" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid upload request" }, { status: 400 });

  const config = getCloudinaryConfig();
  if (!config) return Response.json({ error: "Image uploads are not configured (Cloudinary env vars missing)" }, { status: 503 });

  const { kind } = parsed.data;
  const folder = `orbit/${kind}/${user.id}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signParams({ allowed_formats: ALLOWED_FORMATS, folder, timestamp }, config.apiSecret);

  return Response.json(
    { cloudName: config.cloudName, apiKey: config.apiKey, timestamp, signature, folder, allowedFormats: ALLOWED_FORMATS, maxBytes: MAX_BYTES[kind] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
