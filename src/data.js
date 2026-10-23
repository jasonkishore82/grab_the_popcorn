// Mock catalog and users. Swap these for a real API (e.g. TMDB) later.
export const TITLES = [
  { id: 'm1', imdb: 'tt15239678', runtime: 166, title: 'Dune: Part Two', year: 2024, type: 'movie', genres: ['Sci-Fi', 'Adventure'], critics: 92, audience: 95, hue: 32, synopsis: 'Paul Atreides unites with the Fremen while on a path of revenge against those who destroyed his family.' },
  { id: 'm2', imdb: 'tt13238346', runtime: 106, title: 'Past Lives', year: 2023, type: 'movie', genres: ['Drama', 'Romance'], critics: 95, audience: 85, hue: 200, synopsis: 'Two childhood friends reunite in New York decades later and confront notions of love and destiny.' },
  { id: 'm3', imdb: 'tt15398776', runtime: 180, title: 'Oppenheimer', year: 2023, type: 'movie', genres: ['Drama', 'History'], critics: 93, audience: 91, hue: 12, synopsis: 'The story of J. Robert Oppenheimer and his role in the development of the atomic bomb.' },
  { id: 'm4', imdb: 'tt9362722', runtime: 140, title: 'Spider-Man: Across the Spider-Verse', year: 2023, type: 'movie', genres: ['Animation', 'Action'], critics: 95, audience: 94, hue: 330, synopsis: 'Miles Morales catapults across the Multiverse and meets a team of Spider-People.' },
  { id: 'm5', imdb: 'tt6710474', runtime: 139, title: 'Everything Everywhere All at Once', year: 2022, type: 'movie', genres: ['Sci-Fi', 'Comedy'], critics: 94, audience: 86, hue: 280, synopsis: 'A laundromat owner is swept into an adventure across the multiverse.' },
  { id: 'm6', imdb: 'tt6751668', runtime: 132, title: 'Parasite', year: 2019, type: 'movie', genres: ['Thriller', 'Drama'], critics: 99, audience: 90, hue: 140, synopsis: 'A poor family schemes to become employed by a wealthy household.' },
  { id: 'm7', imdb: 'tt2278388', runtime: 100, title: 'The Grand Budapest Hotel', year: 2014, type: 'movie', genres: ['Comedy'], critics: 92, audience: 86, hue: 345, synopsis: 'A legendary concierge and his lobby boy get caught up in a theft and a murder.' },
  { id: 'm8', imdb: 'tt0816692', runtime: 169, title: 'Interstellar', year: 2014, type: 'movie', genres: ['Sci-Fi', 'Drama'], critics: 73, audience: 86, hue: 220, synopsis: 'Explorers travel through a wormhole in search of a new home for humanity.' },
  { id: 'm9', imdb: 'tt0245429', runtime: 125, title: 'Spirited Away', year: 2001, type: 'movie', genres: ['Animation', 'Fantasy'], critics: 96, audience: 96, hue: 170, synopsis: 'A girl wanders into a world ruled by gods, witches and spirits.' },
  { id: 'm10', imdb: 'tt2582802', runtime: 107, title: 'Whiplash', year: 2014, type: 'movie', genres: ['Drama', 'Music'], critics: 94, audience: 94, hue: 45, synopsis: 'A young drummer is pushed to his limits by a ruthless instructor.' },
  { id: 's1', imdb: 'tt14452776', title: 'The Bear', year: 2022, type: 'show', genres: ['Drama', 'Comedy'], critics: 99, audience: 88, hue: 0, synopsis: 'A fine-dining chef returns home to run his family\'s sandwich shop.' },
  { id: 's2', imdb: 'tt11280740', title: 'Severance', year: 2022, type: 'show', genres: ['Thriller', 'Sci-Fi'], critics: 97, audience: 92, hue: 190, synopsis: 'Office workers have their work and personal memories surgically divided.' },
  { id: 's3', imdb: 'tt0903747', title: 'Breaking Bad', year: 2008, type: 'show', genres: ['Crime', 'Drama'], critics: 96, audience: 97, hue: 90, synopsis: 'A chemistry teacher turns to making meth to secure his family\'s future.' },
  { id: 's4', imdb: 'tt2788316', title: 'Shōgun', year: 2024, type: 'show', genres: ['Drama', 'History'], critics: 99, audience: 91, hue: 5, synopsis: 'An English navigator becomes entangled in a feudal Japanese power struggle.' },
  { id: 's5', imdb: 'tt5687612', title: 'Fleabag', year: 2016, type: 'show', genres: ['Comedy', 'Drama'], critics: 100, audience: 95, hue: 320, synopsis: 'A dry-witted woman navigates life and love in London.' },
  { id: 's6', imdb: 'tt11126994', title: 'Arcane', year: 2021, type: 'show', genres: ['Animation', 'Action'], critics: 100, audience: 96, hue: 260, synopsis: 'Two sisters end up on opposite sides of a war between rival cities.' },
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
  'Still on my watchlist, no spoilers please.',
  'The ending though…',
  'Rewatch party this weekend?',
  'Honestly overrated, fight me.',
  'The soundtrack alone is a 10/10.',
];

// Titles found through OMDb are registered at runtime (see store.jsx).
const extra = new Map();
export const registerTitle = (t) => extra.set(t.id, t);
export const getTitle = (id) => TITLES.find((t) => t.id === id) ?? extra.get(id);
export const allTitles = () => [...TITLES, ...extra.values()];
export const isImdbId = (id) => /^tt\d{6,10}$/.test(id);
// Stable colour for generated poster art when a title has no hue of its own.
export const hueFor = (id) => [...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
export const getUser = (id) => USERS.find((u) => u.id === id);

export const runtimeLabel = (t) => (t.runtime ? `${Math.floor(t.runtime / 60)}h ${t.runtime % 60}m` : 'Series');
export const kindLabel = (t) => (t.type === 'show' ? 'Series' : 'Film');

export function timeAgo(ts) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const units = [['y', 31536000], ['mo', 2592000], ['w', 604800], ['d', 86400], ['h', 3600], ['m', 60]];
  for (const [u, n] of units) if (s >= n) return `${Math.floor(s / n)}${u} ago`;
  return 'just now';
}
