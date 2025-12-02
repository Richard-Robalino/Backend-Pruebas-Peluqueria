// Filtro simple de palabras ofensivas en español (lista corta de ejemplo)
const banned = ['tonto', 'idiota', 'estupido', 'estúpido', 'imbecil', 'imbécil', 'grosero'];

export function hasProfanity(text: string) {
  const low = text.toLowerCase();
  return banned.some(word => low.includes(word));
}
