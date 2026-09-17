import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  const rawUrl = url.searchParams.get('url');

  let targetUrl = '';

  if (key) {
    const cleanKey = key.trim();
    // Validar formato de la clave para evitar SSRF o inyecciones
    if (!cleanKey || /[^a-zA-Z0-9_\-\.]/.test(cleanKey)) {
      return new Response('Identificador de imagen no válido', { status: 400 });
    }
    targetUrl = `https://utfs.io/f/${cleanKey}`;
  } else if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase();
      if (
        host.endsWith('ufs.sh') ||
        host.endsWith('utfs.io') ||
        host.endsWith('uploadthing.com')
      ) {
        targetUrl = parsed.toString();
      } else {
        return new Response('Dominio de imagen no permitido', { status: 400 });
      }
    } catch {
      return new Response('URL de imagen no válida', { status: 400 });
    }
  } else {
    return new Response('Falta el identificador de la imagen', { status: 400 });
  }

  try {
    let response = await fetch(targetUrl);

    // Si falló utfs.io con la clave dada, intentar con ufs.sh como respaldo
    if (!response.ok && key) {
      const fallbackUrl = `https://ufs.sh/f/${encodeURIComponent(key.trim())}`;
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok) {
        response = fallbackRes;
      }
    }

    if (!response.ok) {
      return new Response('Error al obtener la imagen', { status: response.status });
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/webp';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Caché inmutable por 1 año en cliente y CDN para minimizar carga al servidor
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[api/img] Error al obtener imagen desde UploadThing:', error);
    return new Response('Error interno del servidor', { status: 500 });
  }
};
