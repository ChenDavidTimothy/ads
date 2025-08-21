import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';

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
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params;

    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      );
    }

    // Use service client for admin access
    const supabaseClient = createServiceClient();

    // Fetch asset metadata from database
    const result = await supabaseClient
      .from('user_assets')
      .select('*')
      .eq('id', assetId)
      .single();

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Type assertion to ensure asset has expected structure
    const asset = result.data as Asset;

    // Type guard to ensure asset has required properties
    if (!asset.bucket_name || !asset.storage_path) {
      return NextResponse.json(
        { error: 'Invalid asset data' },
        { status: 400 }
      );
    }

    // Get the file from Supabase storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from(asset.bucket_name)
      .download(asset.storage_path);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return NextResponse.json(
        { error: 'Failed to download file from storage' },
        { status: 500 }
      );
    }

    // Convert blob to readable stream
    const buffer = await fileData.arrayBuffer();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(buffer));
        controller.close();
      }
    });

    // Set proper download headers
    const headers = new Headers();
    headers.set('Content-Type', asset.mime_type ?? 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${asset.original_name}"`);
    headers.set('Content-Length', buffer.byteLength.toString());
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');

    // Return the file with proper headers
    return new Response(stream, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Download API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
