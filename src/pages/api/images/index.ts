import type { APIRoute } from 'astro';

import { requireAdmin } from '@/lib/auth';
import { deleteImage, optimizeAndUploadImage } from '@/lib/uploadthing/server';

const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB antes de optimizar
const MAX_QUALITY = 85;

function parseOptionalInt(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseQuality(value: FormDataEntryValue | null): number | undefined {
  const parsed = parseOptionalInt(value);
  if (parsed === undefined) return undefined;
  return Math.min(Math.max(Math.round(parsed), 1), MAX_QUALITY);
}

function isImageFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    'arrayBuffer' in value &&
    typeof (value as File).name === 'string' &&
    ((value as File).type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|bmp|tiff?)$/i.test((value as File).name))
  );
}

export const POST: APIRoute = async (context) => {
  const auth = requireAdmin(context);
  if (auth instanceof Response) return auth;

  let formData: FormData;
  try {
    formData = await context.request.formData();
  } catch {
    return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!isImageFile(file)) {
    return Response.json({ error: 'Se requiere una imagen válida' }, { status: 400 });
  }

  if (file.size > MAX_INPUT_BYTES) {
    return Response.json({ error: 'La imagen supera el límite de 10 MB' }, { status: 413 });
  }

  const maxWidth = parseOptionalInt(formData.get('maxWidth'));
  const maxHeight = parseOptionalInt(formData.get('maxHeight'));
  const quality = parseQuality(formData.get('quality'));

  try {
    const result = await optimizeAndUploadImage(file, {
      name: file.name,
      maxWidth,
      maxHeight,
      quality,
    });

    return Response.json(
      {
        key: result.key,
        url: result.ufsUrl,
        name: result.name,
        width: result.width,
        height: result.height,
        sizeBytes: result.sizeBytes,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo procesar la imagen';
    console.error('[images] upload failed:', error);
    return Response.json({ error: message }, { status: 400 });
  }
};

export const DELETE: APIRoute = async (context) => {
  const auth = requireAdmin(context);
  if (auth instanceof Response) return auth;

  const key = context.url.searchParams.get('key');
  if (!key) {
    return Response.json({ error: 'Se requiere la clave del archivo' }, { status: 400 });
  }

  try {
    await deleteImage(key);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar la imagen';
    console.error('[images] delete failed:', error);
    return Response.json({ error: message }, { status: 400 });
  }
};