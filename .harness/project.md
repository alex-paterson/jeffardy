## Jeffardy

A Jeopardy game for hosting with friends: Next.js 16 (App Router, React 19, Tailwind 4) with
SQLite through Drizzle (`db/`, file `jeopardy.db`, tables created on start in `db/index.ts`) and
OpenAI for generating clue boards (`lib/`). Three views: the host controller (`app/game`), the TV
display (`app/tv`, also served by `tv-proxy.ts` on its own port) and the players' phone buzzers
(`app/participant`), kept in sync with Server-Sent Events (`app/api`). The default branch is
`main`. There are no automated tests; `npm run lint` must pass with no errors.

### Running it for a test

Never touch `~/Projects/jeffardy` itself (the human's checkout and its `jeopardy.db`). Your
worktree has its own copies: the pickup hook clones `node_modules` and copies `.env.local` and
`jeopardy.db` in. Start it with:

    .harness/run.sh          # prints the host and TV URLs; logs to /tmp/jeffardy-<card>.log

It picks free ports from 3100 up (`PORT` for Next, `TV_PORT` for the TV proxy) and stops the
previous run for the same card. Stop yours when you are done (`kill $(cat /tmp/jeffardy-<card>.pid)`).

### Money and keys

`.env.local` holds a real `OPENAI_API_KEY`. Generating a board calls OpenAI and costs money:
only do it when the card is about generation, and at most a couple of times. For everything else
use a game that is already in the copied `jeopardy.db`, or insert rows directly.

### Evidence

One screenshot of what changed, taken with headless Chromium, for example:

    chromium --headless=new --disable-gpu --hide-scrollbars --window-size=1440,900 \
      --virtual-time-budget=8000 --screenshot=/tmp/jf.png http://localhost:<PORT>/<path>

(390,844 for the phone buzzer view; 1920,1080 for the TV view.) Look at it before you rely on
it: a blank page is a failed capture. For logic-only changes the lint output is enough.
