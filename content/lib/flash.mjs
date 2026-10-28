// Ayudante para escribir flashcards nuevas en content/seed-src/.
//   card(frente, pista, ejemplo, extra?)
//   · frente: el chunk con {{la palabra que falta}} (una sola marca por tarjeta).
//   · pista: definición breve en inglés (se ve en el frente; nunca debe contener la respuesta).
//   · ejemplo: oración natural con {{el chunk}} marcado (se ve en el reverso).
//   · extra (opcional): { miss: 1, prio: 3 } para algo que fallaste, { src: 'Mock 3' } para la fuente,
//     { root: 'EDUCATE' } para word formation (la raíz se muestra en la tarjeta).
// El id se deriva del chunk (slug) y la categoría del archivo.
export function deck(categories, parts = ['GEN']) {
  const cat = Array.isArray(categories) ? categories : [categories];
  return (f, en, ex, extra = {}) => ({
    t: f.replace(/\{\{|\}\}/g, ''),
    f,
    en,
    cat,
    parts,
    ex: ex ? [ex] : [],
    ...(extra.src ? { tags: [extra.src] } : {}),
    ...(extra.miss ? { miss: extra.miss, err: 'error' } : {}),
    ...(extra.prio ? { prio: extra.prio } : {}),
    ...(extra.root ? { root: extra.root } : {}),
  });
}
