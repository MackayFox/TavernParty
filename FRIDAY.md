# Friday

## WHEN YOU WAKE UP: one thing is broken, and it is one checkbox

**Multiplayer is dead in production and has been all night.** The four dailies
are fine and always were; tables, quick match, the Hall and the dungeon builder
all answer 500.

It is not a code fault and there is nothing to deploy. The Supabase project
stopped exposing the `tavern` schema to PostgREST, so every database call comes
back `PGRST106 Invalid schema: tavern`. All five migrations are applied and the
data is all there; `npm run db:status` confirms it.

**Either of these fixes it, and both take under a minute.**

1. **The checkbox.** Supabase dashboard, Settings, API, Exposed schemas: add
   `tavern` next to `public`. Nothing to redeploy; it takes effect immediately.

2. **Or run the command I wrote for it:**
   ```bash
   npm run db:expose
   ```
   It reads the current exposed list off the `authenticator` role, adds `tavern`
   if it is missing, and asks PostgREST to reload. It is deliberately ADDITIVE:
   this project is shared with Shareholder Party and writing the list wholesale
   would take that site off the air. **It is untested** — I could not run it,
   because changing a role on a live shared database is exactly the sort of thing
   my own safety rails stop me doing unattended, and I decided not to argue with
   that at four in the morning. If it misbehaves, use the checkbox.

Verify either way with:
```bash
curl -s -o /dev/null -w "%{http_code}
" https://www.tavernparty.com/api/tables
```
200 means it is back. 500 means it is not.

### The better version of the same fix, if you would rather

`SUPABASE.txt` has the keys for a new dedicated Pro project
(`npcfbcuywaoreutbbcuf`), which is what this site should be on: its own auth
pool, its own service key, its own ceiling, and `public` is exposed by default
so this entire class of failure disappears. **The one thing missing is the
database password**, which cannot be derived from the API keys and is not in the
file. Add it as `SUPABASE_DB_PASSWORD` and the move is:

```bash
# in .env.local: point at the new project, and DELETE the SUPABASE_DB_SCHEMA line
npm run db:migrate && npm run db:status
```

then the same values into Vercel for production and preview. Nothing in the code
needs unpicking; that is what the schema variable was for.

---

## What changed while you were asleep

The domain, the ads and the deploy pipeline are all done and verified live.

- **`tavernparty.com` was serving nothing at all.** Vercel redirected the apex to
  www and `next.config.ts` redirected www back to the apex, so every path on the
  domain was an infinite loop while the `vercel.app` URL looked perfect. Host
  canonicalisation now belongs to Vercel alone, www answers, and `lib/site.ts` is
  the one place the hostname is written down. **If you would rather the apex was
  canonical**, make it primary in Vercel, Domains, and change `CANONICAL_ORIGIN`
  in `lib/site.ts` to match. Change one and you must change the other.
- **The whole repo said `.co.uk`.** Every canonical tag, sitemap entry, share
  link and og:url pointed at a hostname nobody owns.
- **AdSense is on**, all three ways: `ads.txt`, the loader script, and the
  `google-adsense-account` meta tag, so verification does not depend on the
  crawler running JavaScript. `NEXT_PUBLIC_ADSENSE_CLIENT` is set in production
  only, deliberately: serving ads from preview URLs is unapproved inventory.
- **CI/CD is confirmed working end to end.** A push to `main` auto-deployed to
  production in 56 seconds, four times tonight.
- **A tip jar**, off by default. Set `NEXT_PUBLIC_SUPPORT_URL` to a Ko-fi or
  Buy Me a Coffee page and a line appears in the footer; leave it unset and there
  is nothing there.

### Still yours to do

- [ ] **DNS is already pointing at Vercel** and both hosts resolve, so nothing to
      do there. Worth knowing: GoDaddy holds the nameservers.
- [ ] Add the site in **AdSense** and in **Search Console** (verify as a Domain
      property so it covers both hosts), then submit `sitemap.xml`.
- [ ] **A consent banner.** `/privacy` now says honestly that consent is not
      being collected. Google's own Funding Choices / Privacy and Messaging CMP
      is free, certified and a console setting rather than code. Needed before
      serving personalised ads to UK and EEA visitors.
- [ ] The **Supabase auth settings** in section 1 below are still unticked.
- [ ] Decide on PostHog. `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is baked in at build
      time, so it needs a redeploy after being set.

---

Everything that needs a Supabase Pro plan, a paid account, or a dashboard I cannot
reach. Nothing in here is a code change: the repo is built to be switched on, not
reworked. Work top to bottom.

Anything I *can* do from this machine is marked **(me)** and I will do it once the
thing it depends on exists. Anything marked **(you)** genuinely needs your login.

---

## 0. Before anything else: two minutes of checking

- [ ] **(you)** Confirm the Pro plan is on the **organisation** that will own this
      project. Supabase billing is per organisation, one subscription each, and the
      free-project count is pooled across every Owner/Admin in the org. Buying Pro
      on the wrong org is the classic way to lose an afternoon.
- [ ] **(you)** Decide whether Tavern Party gets its **own project**. It should.
      With Pro there is no reason to share, and a project per game keeps the
      service-role key, the auth user pool, the egress and the 500 MB ceiling
      separate. Everything in this repo assumes `public` in its own project, so
      there is no schema juggling to do.

---

## 1a. The free-tier path, if the plan is not bought yet

Everything below this section assumes Tavern Party gets its own Supabase project,
which is what it should have. If the plan cannot be bought yet and you want
multiplayer working with real people tonight, it can lodge inside a project that
already exists.

Four of its tables collide by name with the sites already deployed (`profiles`,
`daily_results`, `rate_limits`, `contact_messages`) and so do two functions, so
sharing `public` is not an option: it would put two games' daily scores in one
table and two sites' usernames in one pool. So it gets its own **schema** instead.

- [ ] **(you)** In the existing project: Settings, API, **Exposed schemas**, add
      `tavern` next to `public`. This is the one step that cannot be done from
      here, and without it every query returns "schema must be one of the
      following", which is at least a clear error.
- [ ] **(me)** Put `SUPABASE_DB_SCHEMA=tavern` in `.env.local` alongside that
      project's URL and keys, then `npm run db:migrate`. The runner creates the
      schema, grants usage to the PostgREST roles, and keeps its own ledger of
      applied migrations inside it, so the two sites cannot mistake each other's
      migrations for their own.
- [ ] **(you)** Note that the two sites then share one pool of **auth users**. An
      account made on the other site can log in here, and its username here is a
      separate row in a separate table. For a network of sites that is arguably
      the behaviour you want; it is worth knowing either way.

**Undoing it is one value.** When the plan has room, make the dedicated project,
drop `SUPABASE_DB_SCHEMA`, and run the migrations again. Nothing in the code needs
unpicking, which is exactly why this is an environment variable rather than a
rename of four tables.

---

## 1. Supabase project

- [ ] **(you)** Create the project. Region **London (eu-west-2)** to sit next to the
      Vercel `lhr1` deployment; the further apart they are, the more every poll costs.
- [ ] **(you)** Put these into `SETUP.txt` in the repo root (gitignored, never
      committed): project URL, project ref, anon/publishable key, service role key,
      database password.
- [ ] **(me)** Write `.env.local` from those values and run `npm run db:migrate`.
      The runner falls back to the IPv4 session pooler, which is what actually works
      from here: the direct Postgres host is IPv6-only. Use `aws-1-eu-west-2`.
- [ ] **(me)** `npm run db:status` to confirm every migration applied.

### Auth settings — the one thing that cannot be automated

- [ ] **(you)** Authentication → URL Configuration. Set **Site URL** to
      `https://tavernparty.com` and add it plus `http://localhost:3000` to the
      redirect allowlist.
- [ ] **(you)** Decide whether "Confirm email" stays on. Either setting works:
      `/signup` tries to log you straight in and only shows the "check your email"
      screen if that fails, so you do not have to tell the app which way you went.
- [ ] **(you)** Authentication → Emails. Check the confirmation template says
      Tavern Party and not the name of whichever project the organisation created
      first. The templates are per project, but the **Site URL** is the thing that
      decides which domain the link points at, so getting it wrong sends this
      site's confirmation emails to another site's domain. `/api/auth/signup`
      passes an explicit `emailRedirectTo` for exactly that reason, but the
      template's own footer links still come from the dashboard.

This needs a Supabase **personal access token** (`sbp_...`) for the Management API,
which is not in `SETUP.txt` and cannot be derived from the project keys. Drop a PAT
into `SETUP.txt` and I can do it next time. Until it is set, account signup is the
only thing that is broken: guest play and all four dailies are unaffected, which is
every game on the site.

---

## 2. GitHub

- [ ] **(you)** Create the repo (`MackayFox/TavernParty`) and tell me the URL.
- [ ] **(me)** Push `main`. CI (`.github/workflows/ci.yml`) runs typecheck, tests
      and build on every push and pull request, and needs no secrets, because
      nothing in the build touches the database.

---

## 3. Vercel

- [ ] **(me)** Create the project, connect it to the repo so every push to `main`
      deploys, and set the region to `lhr1` (already in `vercel.json`).
- [ ] **(me)** Set the environment variables across production, preview and
      development. Note for future reference: `NEXT_PUBLIC_*` vars need
      `--visibility config --no-sensitive` or the CLI rejects them with
      `invalid_visibility`, and the CLI prints "Overrode" rather than "added" when
      updating, which is success and not failure.
- [ ] **(me)** Generate a **fresh** `GUEST_COOKIE_SECRET` for production rather than
      reusing the local one.
- [ ] **(me)** Check Deployment Protection is off. It defaults to on and 302s
      everybody except you to an SSO login, which looks exactly like a broken site.
- [ ] **(me)** Deploy, then verify against the real domain rather than the
      `vercel.app` URL.

---

## 4. Domain

- [ ] **(you)** Buy `tavernparty.com` if it is still free. Worth checking before
      any of the copy gets written around the name.
- [ ] **(me)** Attach the apex and `www` to the project.
- [ ] **(you)** Point DNS at Vercel. If the apex ends up `SERVFAIL`ing with correct
      delegation, that is the Vercel-never-created-a-DNS-zone problem from last
      time: the fix is one click in Project → Settings → Domains, or switch to the
      registrar's own nameservers with the A and CNAME records Vercel lists.
- [ ] **(me)** Confirm the `www` to apex redirect fires (it is already in
      `next.config.ts`) and that canonical tags resolve to the apex.

---

## 5. Ads and analytics

- [ ] **(me)** Add `public/ads.txt` with your existing publisher line, and the test
      that guards it. It is the same line as the other two sites, and it is worth
      doing on day one: without it every ad request is unauthorised, and it fails
      silently.
- [ ] **(me)** Set `NEXT_PUBLIC_ADSENSE_CLIENT`. The layout renders nothing at all
      unless it is set, so this is a switch rather than a change.
- [ ] **(you)** Add the site in AdSense and in Search Console. Verify as a **Domain
      property** so it covers every hostname.
- [ ] **(you)** Submit `sitemap.xml` in Search Console, then use URL Inspection to
      request indexing on the home page. Google retired the sitemap ping endpoint,
      so `robots.txt` declaring it is the only automatic route and it is slow.
- [ ] **(you)** Decide on PostHog. `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is baked in
      at build time, so it needs a redeploy after being set.

---

## 6. The network

- [ ] **(me)** Add the Tavern Party row to `lib/content/network.ts` in Shareholder
      Party and `lib/config/network.ts` in Aux Wars, so the links go both ways.

Left undone deliberately. Both of those sites are live and you asked me not to
touch them while this was being built. It is a one-row change in each, plus a
deploy, and the tests in both repos already enforce that each site leaves itself
out of its own list.

---

## 7. Verify, in this order

- [ ] **(me)** `npm run typecheck && npm test && npm run build`.
- [ ] **(me)** `npm run smoke` against the deployed site: a full multiplayer game
      through the public API.
- [ ] **(me)** `npm run smoke:daily` against the deployed site: all four dailies
      played to completion.
- [ ] **(me)** Confirm production is genuinely talking to Postgres and has not
      silently fallen back to the in-memory store. This is the one failure mode
      worth checking by hand, because the fallback looks perfect to one person in
      one tab and breaks the moment there are two players.
- [ ] **(you)** Make an account, play one run to the Ballad, then load
      `/history`. That is the only path the tests cannot reach, because it needs a
      real Supabase session and a run written to `runs`/`run_players`. If the
      standings show but `/history` is empty, the run finished and the write
      failed: `persistRun` is deliberately best effort, so it warns to the Vercel
      log rather than stopping the table seeing its own ending.

---

## Notes for whoever reads this next

**Do not run `npm run build` while `npm run dev` is running.** They share `.next`,
the build deletes the route manifests, and the dev server then 500s on every route.
It looks exactly like a real bug and it has cost hours twice.

**Do not edit files while a smoke script is running against `npm run dev`
either.** Same class of problem, quieter symptom: a save triggers a hot reload,
the reload lands mid-Act, and the next poll comes back 404 as though the table
had vanished. The game is fine. It cost a wrong diagnosis here already.

**A production build with no `GUEST_COOKIE_SECRET` refuses to start.** It did
not always: it used to come up, serve the front page and all four dailies, and
then throw a generic 500 the first time somebody sat at a table, because the
secret is only read when an identity is minted. `instrumentation.ts` now checks it
at boot, with the fix in the message. The same file warns, without failing, when
there is no Supabase: the in-memory store is a legitimate way to run this, but on
a serverless host it is per instance, so two players can land on two machines and
see two different tables. That is the one thing to check by hand after the first
deploy.

**The engine needs no database.** `lib/game/engine.ts` is pure, all randomness is
injected, and the whole test suite runs without Supabase configured. That is why
this repo could be built and tested in full before the plan was bought, and it is
why none of the above is a rework.
