import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";

interface Asset {
  id: string;
  user_id: string;
  bucket_name: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  file_size: number;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  try {
    const { assetId } = await params;

    if (!assetId) {
      return NextResponse.json(
        { error: "Asset ID is required" },
        { status: 400 },
      );
    }

    // Use service client for admin access
    const supabaseClient = createServiceClient();

    // Fetch asset metadata from database
    const result = await supabaseClient
      .from("user_assets")
      .select("*")
      .eq("id", assetId)
      .single();

    if (result.error || !result.data) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const asset = result.data as Asset;

    if (!asset.bucket_name || !asset.storage_path) {
      return NextResponse.json(
        { error: "Invalid asset data" },
        { status: 400 },
      );
    }

    // Create a fresh signed URL and redirect the browser to download directly from Supabase
    const { data: signed, error: signError } = await supabaseClient.storage
      .from(asset.bucket_name)
      .createSignedUrl(asset.storage_path, 60 * 30, {
        // Ensure browser receives attachment with the original filename
        download: asset.original_name,
      });

    if (signError || !signed?.signedUrl) {
      console.error("Signed URL error:", signError);
      return NextResponse.json(
        { error: "Failed to create signed URL" },
        { status: 500 },
      );
    }

    const redirectResponse = NextResponse.redirect(signed.signedUrl, 302);
    redirectResponse.headers.set("Cache-Control", "no-store");
    return redirectResponse;
  } catch (error) {
    console.error("Download API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
