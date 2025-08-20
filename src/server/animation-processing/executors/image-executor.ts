import type { ReactFlowNode, ReactFlowEdge } from '@/shared/types';
import type { NodeData } from '@/shared/types/nodes';
import type { ExecutionContext } from '@/server/animation-processing/execution-context';
import { setNodeOutput } from '../execution-context';
import { createServiceClient } from '@/utils/supabase/service';
import { loadImage } from 'canvas';
import { BaseExecutor } from './base-executor';

export class ImageExecutor extends BaseExecutor {
  private readonly supabase = createServiceClient();

  protected registerHandlers(): void {
    this.registerHandler('image', this.executeImage.bind(this));
  }

  private async executeImage(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    edges: ReactFlowEdge[]
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
      const { data: asset, error } = await this.supabase
        .from('user_assets')
        .select('*')
        .eq('id', data.imageAssetId)
        .single();

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
