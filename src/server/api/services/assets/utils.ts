export function parseSignedUrl(signedUrl: string): {
  bucket: string | null;
  filePath: string | null;
  mimeType: string;
  extension: string;
} {
  try {
    const url = new URL(signedUrl);
    const pathParts = url.pathname.split('/');

    const signIndex = pathParts.indexOf('sign');
    if (signIndex === -1 || signIndex + 2 >= pathParts.length) {
      return { bucket: null, filePath: null, mimeType: '', extension: '' };
    }

    const bucket = pathParts[signIndex + 1];
    const filePath = pathParts.slice(signIndex + 2).join('/');
    const extension = filePath.split('.').pop()?.toLowerCase() ?? '';

    let mimeType = '';
    if (bucket === 'images') {
      const imageTypes: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
      };
      mimeType = imageTypes[extension] ?? 'image/png';
    } else if (bucket === 'videos') {
      const videoTypes: Record<string, string> = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime',
      };
      mimeType = videoTypes[extension] ?? 'video/mp4';
    }

    return {
      bucket: bucket ?? null,
      filePath: filePath ?? null,
      mimeType,
      extension,
    };
  } catch {
    return { bucket: null, filePath: null, mimeType: '', extension: '' };
  }
}
