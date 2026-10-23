# 🍿 Grab the Popcorn

A minimal React UI for saving your favourite movies & shows, finding friends and chatting about what you watch — think Rotten Tomatoes + Letterboxd + a group chat.

## Features
- **Explore** – search movies and shows, filter by type and genre, see critic 🍅 and audience 🍿 scores
- **Title page** – add to Watchlist / mark Watched, rate 1–5 stars, write a review, start a discussion with a friend
- **My List** – your Watched and Watchlist collections with ratings and reviews
- **Friends** – search people by name or @handle, add/remove friends, see their favourites
- **Chats** – one-to-one chat with friends, attach a movie/show card to any message

## Run it
```bash
npm install
npm run dev
```

## Notes
- Data is mock data in `src/data.js`; your list, friends and chats are saved in the browser (localStorage).
- Friend replies are simulated. Hook up a backend + a movie API (e.g. TMDB) to make it real.
