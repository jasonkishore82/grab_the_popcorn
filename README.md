<p align="center"><img src="public/logo.png" width="180" alt="Grab the Popcorn logo"></p>

# Grab the Popcorn

A minimal React UI for saving your favourite movies & shows, finding friends and chatting about what you watch — think Rotten Tomatoes + Letterboxd + a group chat.

## Features
- **Explore** – search movies and shows, filter by type and genre, see critic and audience scores
- **Title page** – add to Watchlist / mark Watched, rate 1–5 stars, write a review, start a discussion with a friend
- **My List** – your Watched and Watchlist collections with ratings and reviews
- **Friends** – search people by name or @handle, add/remove friends, see their favourites
- **Messages** – one-to-one chat with friends, attach a movie/show card to any message
- **Light and dark mode** – dark by default; switch with the Light/Dark control at the bottom of the sidebar (or the button in the phone header). Your choice is remembered
- **Ask Luna** – an AI movie assistant (powered by Claude) that knows your list and your friends' taste. Ask for recommendations, spoiler-free summaries or what to watch together; titles she mentions become clickable cards

## Run it
```bash
npm install
cp .env.example .env     # then paste your keys into .env
npm run dev
```

For production: `npm run build && npm start` (serves the app and the API routes on port 3000).

## API keys (`.env`)
| Variable | What it does | Get one |
|---|---|---|
| `OMDB_API_KEY` | Fills in posters, plot, director, cast, rating, awards and real Rotten Tomatoes / IMDb / Metacritic scores, and lets you search titles beyond the built-in catalogue | https://www.omdbapi.com/apikey.aspx (free: 1,000 requests a day; activate it from the email) |
| `ANTHROPIC_API_KEY` | Powers Luna | https://console.anthropic.com/ |

`.env` is git-ignored, so keys are never committed. If the variables are already set in your environment (for example as hosting secrets), those win over the file. Restart the server after changing `.env`.

Both keys stay on the server (`server/omdb.js`, `server/luna.js`) and are never sent to the browser. Without a key everything else still works: the app falls back to its built-in sample data and shows a short notice on Explore.

### How OMDb is used
- On first load the app asks OMDb about each built-in title (a few at a time) and remembers the answers in the browser, so later visits make no requests. Answers are also cached on the server for 24 hours.
- Typing 3 or more characters in the search box also searches OMDb. Results under "More from OMDb" open like any other title and can be saved, rated and discussed.

## Notes
- Data is mock data in `src/data.js`; your list, friends and chats are saved in the browser (localStorage).
- Friend replies are simulated. Hook up a backend + a movie API (e.g. TMDB) to make it real.

## How it works
See [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) for the architecture, the planned database (ratings, reviews, watchlist, watched) and how the recommendation system works.
