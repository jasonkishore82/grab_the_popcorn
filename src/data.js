// Mock catalog and users. Swap these for a real API (e.g. TMDB) later.
export const TITLES = [
  { id: 'm1', title: 'Dune: Part Two', year: 2024, type: 'movie', genres: ['Sci-Fi', 'Adventure'], critics: 92, audience: 95, hue: 32, synopsis: 'Paul Atreides unites with the Fremen while on a path of revenge against those who destroyed his family.' },
  { id: 'm2', title: 'Past Lives', year: 2023, type: 'movie', genres: ['Drama', 'Romance'], critics: 95, audience: 85, hue: 200, synopsis: 'Two childhood friends reunite in New York decades later and confront notions of love and destiny.' },
  { id: 'm3', title: 'Oppenheimer', year: 2023, type: 'movie', genres: ['Drama', 'History'], critics: 93, audience: 91, hue: 12, synopsis: 'The story of J. Robert Oppenheimer and his role in the development of the atomic bomb.' },
  { id: 'm4', title: 'Spider-Man: Across the Spider-Verse', year: 2023, type: 'movie', genres: ['Animation', 'Action'], critics: 95, audience: 94, hue: 330, synopsis: 'Miles Morales catapults across the Multiverse and meets a team of Spider-People.' },
  { id: 'm5', title: 'Everything Everywhere All at Once', year: 2022, type: 'movie', genres: ['Sci-Fi', 'Comedy'], critics: 94, audience: 86, hue: 280, synopsis: 'A laundromat owner is swept into an adventure across the multiverse.' },
  { id: 'm6', title: 'Parasite', year: 2019, type: 'movie', genres: ['Thriller', 'Drama'], critics: 99, audience: 90, hue: 140, synopsis: 'A poor family schemes to become employed by a wealthy household.' },
  { id: 'm7', title: 'The Grand Budapest Hotel', year: 2014, type: 'movie', genres: ['Comedy'], critics: 92, audience: 86, hue: 345, synopsis: 'A legendary concierge and his lobby boy get caught up in a theft and a murder.' },
  { id: 'm8', title: 'Interstellar', year: 2014, type: 'movie', genres: ['Sci-Fi', 'Drama'], critics: 73, audience: 86, hue: 220, synopsis: 'Explorers travel through a wormhole in search of a new home for humanity.' },
  { id: 'm9', title: 'Spirited Away', year: 2001, type: 'movie', genres: ['Animation', 'Fantasy'], critics: 96, audience: 96, hue: 170, synopsis: 'A girl wanders into a world ruled by gods, witches and spirits.' },
  { id: 'm10', title: 'Whiplash', year: 2014, type: 'movie', genres: ['Drama', 'Music'], critics: 94, audience: 94, hue: 45, synopsis: 'A young drummer is pushed to his limits by a ruthless instructor.' },
  { id: 's1', title: 'The Bear', year: 2022, type: 'show', genres: ['Drama', 'Comedy'], critics: 99, audience: 88, hue: 0, synopsis: 'A fine-dining chef returns home to run his family\'s sandwich shop.' },
  { id: 's2', title: 'Severance', year: 2022, type: 'show', genres: ['Thriller', 'Sci-Fi'], critics: 97, audience: 92, hue: 190, synopsis: 'Office workers have their work and personal memories surgically divided.' },
  { id: 's3', title: 'Breaking Bad', year: 2008, type: 'show', genres: ['Crime', 'Drama'], critics: 96, audience: 97, hue: 90, synopsis: 'A chemistry teacher turns to making meth to secure his family\'s future.' },
  { id: 's4', title: 'Shōgun', year: 2024, type: 'show', genres: ['Drama', 'History'], critics: 99, audience: 91, hue: 5, synopsis: 'An English navigator becomes entangled in a feudal Japanese power struggle.' },
  { id: 's5', title: 'Fleabag', year: 2016, type: 'show', genres: ['Comedy', 'Drama'], critics: 100, audience: 95, hue: 320, synopsis: 'A dry-witted woman navigates life and love in London.' },
  { id: 's6', title: 'Arcane', year: 2021, type: 'show', genres: ['Animation', 'Action'], critics: 100, audience: 96, hue: 260, synopsis: 'Two sisters end up on opposite sides of a war between rival cities.' },
];

export const USERS = [
  { id: 'u1', name: 'Maya Chen', handle: 'mayawatches', bio: 'A24 apologist. Will cry at anything.', favs: ['m2', 'm5', 's5'] },
  { id: 'u2', name: 'Leo Martins', handle: 'leoreels', bio: 'Nolan, Villeneuve, repeat.', favs: ['m1', 'm3', 'm8'] },
  { id: 'u3', name: 'Priya Rao', handle: 'priyapopcorn', bio: 'Animation is cinema.', favs: ['m4', 'm9', 's6'] },
  { id: 'u4', name: 'Sam Okafor', handle: 'samseries', bio: 'Mostly TV. Mostly prestige.', favs: ['s2', 's3', 's4'] },
  { id: 'u5', name: 'Ella Novak', handle: 'ellanoir', bio: 'Thrillers and slow burns.', favs: ['m6', 'm10', 's1'] },
];

export const REPLIES = [
  'Oh I loved that one!',
  'Still on my watchlist, no spoilers 🙈',
  'The ending though…',
  'Rewatch party this weekend?',
  'Honestly overrated, fight me.',
  'The soundtrack alone is a 10/10.',
];

export const getTitle = (id) => TITLES.find((t) => t.id === id);
export const getUser = (id) => USERS.find((u) => u.id === id);
