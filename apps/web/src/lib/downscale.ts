export interface TargetSize {
  width: number;
  height: number;
}

export interface DownscaleOptions {
  max?: number;
  quality?: number;
}

export interface DownscaledImage {
  base64: string;
  mimeType: 'image/jpeg';
}

/** Returns the scaled dimensions, keeping aspect ratio and never upscaling. */
export function computeTargetSize(w: number, h: number, max = 1024): TargetSize {
  const longSide = Math.max(w, h);
  if (longSide <= max) {
    return { width: w, height: h };
  }
  const scale = max / longSide;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read the selected image.'));
    image.src = src;
  });
}

/** Returns a JPEG base64 payload without the data URL prefix. */
export async function downscaleToJpeg(
  file: File,
  opts: DownscaleOptions = {},
): Promise<DownscaledImage> {
  const max = opts.max ?? 1024;
  const quality = opts.quality ?? 0.8;
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const target = computeTargetSize(image.naturalWidth, image.naturalHeight, max);
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;

    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('Could not prepare the image canvas.');
    }

    context.drawImage(image, 0, 0, target.width, target.height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const comma = dataUrl.indexOf(',');
    if (comma === -1) {
      throw new Error('Could not encode the selected image.');
    }

    return { base64: dataUrl.slice(comma + 1), mimeType: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
