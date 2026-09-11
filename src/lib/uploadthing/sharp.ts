import sharp from 'sharp';

export type ImageOptimizationOptions = {
  /**
   * Ancho máximo en píxeles. La imagen se redimensiona manteniendo la
   * proporción y sin ampliarla si ya es más pequeña.
   * @default 1280
   */
  maxWidth?: number;
  /**
   * Alto máximo en píxeles.
   * @default 1280
   */
  maxHeight?: number;
  /**
   * Calidad de compresión WebP (0-100). Valores más bajos producen menos peso.
   * @default 72
   */
  quality?: number;
};

export type OptimizedImage = {
  buffer: Buffer;
  mimeType: 'image/webp';
  width?: number;
  height?: number;
};

const DEFAULT_MAX_WIDTH = 1280;
const DEFAULT_MAX_HEIGHT = 1280;
const DEFAULT_QUALITY = 72;

/**
 * Optimiza una imagen en crudo (Buffer) para que pese lo menos posible.
 *
 * - Corrige la orientación EXIF (`rotate()`).
 * - Redimensiona al tamaño máximo indicado (sin ampliar imágenes pequeñas).
 * - Convierte a WebP con la calidad indicada.
 */
export async function optimizeImageBuffer(
  input: Buffer,
  options: ImageOptimizationOptions = {},
): Promise<OptimizedImage> {
  const {
    maxWidth = DEFAULT_MAX_WIDTH,
    maxHeight = DEFAULT_MAX_HEIGHT,
    quality = DEFAULT_QUALITY,
  } = options;

  let pipeline = sharp(input).rotate();

  const metadata = await pipeline.metadata();
  const shouldResize =
    metadata.width !== undefined &&
    metadata.height !== undefined &&
    (metadata.width > maxWidth || metadata.height > maxHeight);

  if (shouldResize) {
    pipeline = pipeline.resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  pipeline = pipeline.webp({ quality, effort: 4 });

  const output = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    buffer: output.data,
    mimeType: 'image/webp',
    width: output.info.width,
    height: output.info.height,
  };
}