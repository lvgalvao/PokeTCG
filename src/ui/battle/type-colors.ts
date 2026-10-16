/** Cor de cada tipo do TCG: pinta braços, pernas e golpes do Pokémon na arena. */
const TYPE_COLORS: Readonly<Record<string, string>> = {
  Grass: '#4caf50',
  Fire: '#f4511e',
  Water: '#2f8fe6',
  Lightning: '#f6c416',
  Psychic: '#a04bd6',
  Fighting: '#c0692f',
  Darkness: '#37474f',
  Metal: '#8f9aa3',
  Dragon: '#b8962e',
  Fairy: '#ec6fb0',
  Colorless: '#cfcfd4',
};

const TYPE_LABELS: Readonly<Record<string, string>> = {
  Grass: 'Planta',
  Fire: 'Fogo',
  Water: 'Água',
  Lightning: 'Elétrico',
  Psychic: 'Psíquico',
  Fighting: 'Lutador',
  Darkness: 'Sombrio',
  Metal: 'Metal',
  Dragon: 'Dragão',
  Fairy: 'Fada',
  Colorless: 'Normal',
};

export function typeColor(type: string): string {
  return TYPE_COLORS[type] ?? TYPE_COLORS.Colorless!;
}

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}
