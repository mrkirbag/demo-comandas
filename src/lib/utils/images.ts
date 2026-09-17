/**
 * Transforma una URL directa de UploadThing (utfs.io o *.ufs.sh) a una ruta relativa
 * proxied a través de nuestro servidor de Astro (/api/img?key=...), evitando bloqueos
 * de DNS por proveedores de internet como Cable Norte.
 */
export function getProxiedImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Si ya es una ruta relativa o ya pasa por el proxy, la dejamos intacta
  if (trimmed.startsWith('/')) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (
      host.endsWith('ufs.sh') ||
      host.endsWith('utfs.io') ||
      host.endsWith('uploadthing.com')
    ) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      const key = parts[parts.length - 1];
      if (key) {
        return `/api/img?key=${encodeURIComponent(key)}`;
      }
    }
  } catch {
    // Si no es una URL válida pero parece ser una clave directa de UploadThing
    if (!trimmed.includes('/') && !trimmed.includes(' ') && trimmed.length > 10) {
      return `/api/img?key=${encodeURIComponent(trimmed)}`;
    }
  }

  return trimmed;
}
