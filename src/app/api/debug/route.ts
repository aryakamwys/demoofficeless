import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import pdfParse from "pdf-parse-new";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  // We are bypassing auth check here just to dump data for debugging
  const { data: uploads } = await supabase
    .from("uploads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!uploads || uploads.length === 0) return NextResponse.json({ error: "no uploads" });

  const upload = uploads[0];

  const { data: fileData, error: downloadError } = await supabase.storage
    .from("dataperkom")
    .download(upload.storage_path);

  if (downloadError) return NextResponse.json({ error: downloadError });

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const data = await pdfParse(buffer);

  return NextResponse.json({ text: data.text });
}
