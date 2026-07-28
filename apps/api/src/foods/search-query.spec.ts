import { likeContains, normalizeQuery } from './search-query';

describe('normalización de búsqueda', () => {
  it('quita acentos, colapsa espacios y baja a minúsculas', () => {
    expect(normalizeQuery('  Plátano   MADURO ')).toBe('platano maduro');
  });

  it('recorta a 100 caracteres', () => {
    expect(normalizeQuery('a'.repeat(500))).toHaveLength(100);
  });

  it('no rompe con texto no latino', () => {
    expect(normalizeQuery('  鶏むね肉 ')).toBe('鶏むね肉');
  });
});

describe('patrón LIKE', () => {
  it('envuelve el término en comodines', () => {
    expect(likeContains('pan')).toBe('%pan%');
  });

  it('neutraliza los comodines que venían en el input', () => {
    // Sin escapar, "100%" haría match con todo.
    expect(likeContains('100%')).toBe('%100\\%%');
    expect(likeContains('a_b')).toBe('%a\\_b%');
  });
});
