import type { ReactFlowNode, ReactFlowEdge } from '../types/graph';
import type { NodeData } from '@/shared/types/nodes';
import type { ExecutionContext } from '@/server/animation-processing/execution-context';
import { setNodeOutput } from '../execution-context';
import { createServiceClient } from '@/utils/supabase/service';
import { loadImage } from 'canvas';
import { BaseExecutor } from './base-executor';

// Type for the asset data we expect from the database
interface AssetData {
  bucket_name: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
}

export class ImageExecutor extends BaseExecutor {
  private readonly supabase = createServiceClient();

  protected registerHandlers(): void {
    this.registerHandler('image', this.executeImage.bind(this));
  }

  private async executeImage(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    _edges: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as {
      imageAssetId: string;
      position: { x: number; y: number };
      scale: { x: number; y: number };
      rotation: number;
      opacity: number;
    };

    if (!data.imageAssetId) {
      // No image selected, output empty object stream
      setNodeOutput(
        context,
        node.data.identifier.id,
        'output',
        'object_stream',
        [],
        { perObjectTimeCursor: {}, perObjectAssignments: {} }
      );
      return;
    }

    try {
      // Fetch asset details from database
      const result = await this.supabase
        .from('user_assets')
        .select('*')
        .eq('id', data.imageAssetId)
        .single();

      const { data: asset, error } = result as { data: AssetData | null; error: unknown };

      if (error || !asset) {
        console.warn(`Image asset not found: ${data.imageAssetId}`);
        setNodeOutput(
          context,
          node.data.identifier.id,
          'output',
          'object_stream',
          [],
          { perObjectTimeCursor: {}, perObjectAssignments: {} }
        );
        return;
      }

      // Type guard to ensure asset has required properties
      if (typeof asset.bucket_name !== 'string' || 
          typeof asset.storage_path !== 'string' ||
          typeof asset.original_name !== 'string' ||
          typeof asset.mime_type !== 'string') {
        console.warn(`Invalid asset data format: ${data.imageAssetId}`);
        setNodeOutput(
          context,
          node.data.identifier.id,
          'output',
          'object_stream',
          [],
          { perObjectTimeCursor: {}, perObjectAssignments: {} }
        );
        return;
      }

      // Get public URL for the image
      const { data: signedUrl, error: urlError } = await this.supabase.storage
        .from(asset.bucket_name)
        .createSignedUrl(asset.storage_path, 60 * 60); // 1 hour

      if (urlError || !signedUrl) {
        console.warn(`Failed to get signed URL for asset: ${data.imageAssetId}`);
        setNodeOutput(
          context,
          node.data.identifier.id,
          'output',
          'object_stream',
          [],
          { perObjectTimeCursor: {}, perObjectAssignments: {} }
        );
        return;
      }

      // Load the image to get dimensions
      let imageWidth = 0;
      let imageHeight = 0;
      
      try {
        const image = await loadImage(signedUrl.signedUrl);
        imageWidth = image.width;
        imageHeight = image.height;
      } catch (imageError) {
        console.warn(`Failed to load image: ${data.imageAssetId}`, imageError);
        // Continue with default dimensions
        imageWidth = 100;
        imageHeight = 100;
      }

      // Create image object with proper scaling and positioning
      const imageObject = {
        type: 'image' as const,
        id: `image_${node.data.identifier.id}`,
        position: {
          x: data.position.x,
          y: data.position.y,
        },
        scale: {
          x: data.scale.x,
          y: data.scale.y,
        },
        rotation: data.rotation,
        opacity: data.opacity,
        // Image-specific properties
        imageUrl: signedUrl.signedUrl,
        originalWidth: imageWidth,
        originalHeight: imageHeight,
        // Asset metadata for debugging
        assetId: data.imageAssetId,
        assetName: asset.original_name,
        mimeType: asset.mime_type,
      };

      setNodeOutput(
        context,
        node.data.identifier.id,
        'output',
        'object_stream',
        [imageObject],
        { 
          perObjectTimeCursor: {
            [imageObject.id]: 0
          }, 
          perObjectAssignments: {} 
        }
      );

    } catch (error) {
      console.error('Error in image executor:', error);
      setNodeOutput(
        context,
        node.data.identifier.id,
        'output',
        'object_stream',
        [],
        { perObjectTimeCursor: {}, perObjectAssignments: {} }
      );
    }
  }
}

export const imageExecutor = new ImageExecutor();
