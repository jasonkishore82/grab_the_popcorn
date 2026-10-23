# 🍿 Grab the Popcorn

A minimal React UI for saving your favourite movies & shows, finding friends and chatting about what you watch — think Rotten Tomatoes + Letterboxd + a group chat.

## Features
- **Explore** – search movies and shows, filter by type and genre, see critic 🍅 and audience 🍿 scores
- **Title page** – add to Watchlist / mark Watched, rate 1–5 stars, write a review, start a discussion with a friend
- **My List** – your Watched and Watchlist collections with ratings and reviews
- **Friends** – search people by name or @handle, add/remove friends, see their favourites
- **Chats** – one-to-one chat with friends, attach a movie/show card to any message
- **✨ Ask Luna** – an AI movie assistant (powered by Claude) that knows your list and your friends' taste. Ask for recommendations, spoiler-free summaries or what to watch together; titles she mentions become clickable cards

## Run it
```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # needed for Luna only
npm run dev
```

For production: `npm run build && npm start` (serves the app and Luna's API on port 3000).

Luna's API lives in `server/luna.js`. The API key stays on the server and is never sent to the browser. Without a key, everything else works and Luna shows a setup message.

## Notes
- Data is mock data in `src/data.js`; your list, friends and chats are saved in the browser (localStorage).
- Friend replies are simulated. Hook up a backend + a movie API (e.g. TMDB) to make it real.

## How it works
See [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) for the architecture, the planned database (ratings, reviews, watchlist, watched) and how the recommendation system works.
