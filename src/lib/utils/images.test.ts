import { describe, it, expect } from 'vitest';
import { getProxiedImageUrl } from './images';

describe('getProxiedImageUrl', () => {
  it('debe devolver cadena vacía para entradas nulas o vacías', () => {
    expect(getProxiedImageUrl(null)).toBe('');
    expect(getProxiedImageUrl(undefined)).toBe('');
    expect(getProxiedImageUrl('')).toBe('');
    expect(getProxiedImageUrl('   ')).toBe('');
  });

  it('debe mantener URLs relativas intactas', () => {
    expect(getProxiedImageUrl('/logo.png')).toBe('/logo.png');
    expect(getProxiedImageUrl('/api/img?key=123')).toBe('/api/img?key=123');
  });

  it('debe transformar URLs de *.ufs.sh a /api/img?key=...', () => {
    const original = 'https://mqpifot0ny.ufs.sh/f/FOVosAY2DqsQE2eNyymNRidnFQVL5D4sYkKfotzWeygPpc1G';
    expect(getProxiedImageUrl(original)).toBe(
      '/api/img?key=FOVosAY2DqsQE2eNyymNRidnFQVL5D4sYkKfotzWeygPpc1G',
    );
  });

  it('debe transformar URLs de utfs.io a /api/img?key=...', () => {
    const original = 'https://utfs.io/f/FOVosAY2DqsQE2eNyymNRidnFQVL5D4sYkKfotzWeygPpc1G';
    expect(getProxiedImageUrl(original)).toBe(
      '/api/img?key=FOVosAY2DqsQE2eNyymNRidnFQVL5D4sYkKfotzWeygPpc1G',
    );
  });

  it('debe transformar claves directas a /api/img?key=...', () => {
    const key = 'FOVosAY2DqsQE2eNyymNRidnFQVL5D4sYkKfotzWeygPpc1G';
    expect(getProxiedImageUrl(key)).toBe(
      '/api/img?key=FOVosAY2DqsQE2eNyymNRidnFQVL5D4sYkKfotzWeygPpc1G',
    );
  });

  it('debe mantener intactas URLs externas que no pertenezcan a UploadThing', () => {
    const external = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';
    expect(getProxiedImageUrl(external)).toBe(external);
  });

  it('debe permitir extraer la clave correctamente a partir de la URL proxied o directa', () => {
    const directUrl = 'https://mqpifot0ny.ufs.sh/f/FOVosAY2DqsQE2eNyymNRidnFQVL5D4sYkKfotzWeygPpc1G';
    const proxiedUrl = getProxiedImageUrl(directUrl);
    
    const parsed = new URL(proxiedUrl, 'http://localhost');
    expect(parsed.searchParams.get('key')).toBe('FOVosAY2DqsQE2eNyymNRidnFQVL5D4sYkKfotzWeygPpc1G');
  });
});
