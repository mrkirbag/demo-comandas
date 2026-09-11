import { UTApi, UTFile } from 'uploadthing/server';

import { env } from '@/lib/config/env';

import { optimizeImageBuffer, type ImageOptimizationOptions } from './sharp';

/**
 * Cliente server-only de UploadThing. Permite subir/borrar archivos desde el
 * servidor (p. ej. después de optimizar una imagen con sharp).
 */
export const utapi = new UTApi({ token: env.uploadthingToken });

export type OptimizedUpload = {
  key: string;
  ufsUrl: string;
  name: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
};

type ImageInput = Blob | File | Uint8Array | ArrayBuffer | Buffer;

function inputNameFrom(input: ImageInput): string {
  const candidate = (input as File).name;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : 'image';
}

function toWebpName(name: string): string {
  return `${name.replace(/\.[^.]+$/, '')}.webp`;
}

function toUint8ArrayFromBuffer(buf: Buffer): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(buf.byteLength));
  out.set(buf);
  return out;
}

async function toBuffer(input: ImageInput): Promise<Uint8Array> {
  if (Buffer.isBuffer(input)) {
    return new Uint8Array(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength));
  }
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input instanceof Uint8Array) return input;
  // Blob | File
  return new Uint8Array(await input.arrayBuffer());
}

/**
 * Recibe una imagen cruda, la optimiza con sharp (redimensiona + WebP) y sube
 * únicamente la versión ligera a UploadThing. Devuelve la URL final.
 */
export async function optimizeAndUploadImage(
  input: ImageInput,
  options: ImageOptimizationOptions & { name?: string } = {},
): Promise<OptimizedUpload> {
  const buffer = await toBuffer(input);
  const optimized = await optimizeImageBuffer(Buffer.from(buffer), options);

  const webpName = toWebpName(options.name ?? inputNameFrom(input));
  // Simulamos "carpetas" en UploadThing añadiendo el prefijo del negocio al archivo
  const filePrefix = env.storeName.replace(/[^a-zA-Z0-9_-]/g, ''); 
  const prefixedName = `${filePrefix}_${webpName}`;

  const result = await utapi.uploadFiles(
    new UTFile([toUint8ArrayFromBuffer(optimized.buffer)], prefixedName, { type: 'image/webp' }),
  );

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? 'No se pudo subir la imagen optimizada');
  }

  return {
    key: result.data.key,
    ufsUrl: result.data.ufsUrl,
    name: result.data.name,
    width: optimized.width ?? null,
    height: optimized.height ?? null,
    sizeBytes: optimized.buffer.byteLength,
  };
}

/**
 * Elimina una imagen ya almacenada en UploadThing a partir de su key.
 */
export async function deleteImage(key: string): Promise<void> {
  await utapi.deleteFiles(key);
}

/**
 * Elimina una imagen ya almacenada extrayendo el key desde su URL.
 */
export async function deleteImageByUrl(url: string): Promise<void> {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/');
    const key = parts[parts.length - 1];
    if (key) {
      await deleteImage(key);
    }
  } catch {
    // URL inválida, no se puede borrar
  }
}