import type { DeckCard } from './csv';

/** Sample deck in Portuguese, shipped as a starting point for new users. */
export const SEED_DECK_NAME = 'Português básico';

export const SEED_CARDS: readonly DeckCard[] = [
  { front: 'Olá', back: 'Hello', tags: ['saudações'] },
  { front: 'Bom dia', back: 'Good morning', tags: ['saudações', 'tempo'] },
  { front: 'Obrigado', back: 'Thank you', tags: ['saudações'] },
  { front: 'Por favor', back: 'Please', tags: ['cortesia'] },
  { front: 'Desculpe', back: 'Sorry, excuse me', tags: ['cortesia'] },
  { front: 'Casa', back: 'House, home', tags: ['substantivos'] },
  { front: 'Água', back: 'Water', tags: ['substantivos', 'comida'] },
  { front: 'Livro', back: 'Book', tags: ['substantivos'] },
  { front: 'Correr', back: 'To run', tags: ['verbos'] },
  { front: 'Comer', back: 'To eat', tags: ['verbos', 'comida'] },
  { front: 'Eu sou estudante', back: 'I am a student', tags: ['frases'] },
  { front: 'Onde fica o banheiro?', back: 'Where is the bathroom?', tags: ['frases', 'viagem'] },
  { front: 'Quanto custa?', back: 'How much does it cost?', tags: ['frases', 'viagem'] },
  { front: 'Feliz', back: 'Happy', tags: ['adjetivos'] },
  { front: 'Grande, enorme', back: 'Big, huge', tags: ['adjetivos'] },
];
