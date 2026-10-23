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
- **Accounts and shared reviews** – sign up, then rate and comment on any title; everyone sees the community rating and each member's review
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

Both keys stay on the server (`server/omdb.js`, `server/luna.js`) and are never sent to the browser. Without an OMDb key everything else still works with the 16 starter titles and whatever members have already added to the shared catalogue; Explore shows a short notice.

### How OMDb and the shared database work together
- Every title anyone searches for or opens is saved once in a shared table. The next person who searches for it gets it from the database, not from OMDb.
- Every search is saved too, so repeating a search (by anyone) makes no OMDb request. This keeps you well inside OMDb's free limit.
- Ratings and comments are saved in a shared table and are public: if Alice rates and comments on Interstellar, Bob sees her review when he opens it.
- Details of the design: [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md).

## Accounts and data
- You can browse and read everything without an account. Rating, commenting, saving to your list and asking Luna need one (create it from the sidebar or the dialog that appears).
- Everything is stored in a SQLite database file, `data/popcorn.db` (git-ignored, created automatically; override with `DATABASE_FILE`). **Back this file up**: it holds every member's account, list, rating and comment. Needs Node 22.13 or newer.
- Passwords are hashed (scrypt), sign-in uses an HttpOnly cookie, and nothing secret is sent to the browser.
- Friends and chats are still samples kept in the browser; real friends and live chat are next.

## Notes
- Friends, chats and their replies are samples for now (kept in the browser). Everything else is real and shared.

## How it works
See [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) for the architecture, the planned database (ratings, reviews, watchlist, watched) and how the recommendation system works.
