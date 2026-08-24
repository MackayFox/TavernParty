# Friday

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
      `https://tavernparty.co.uk` and add it plus `http://localhost:3000` to the
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

- [ ] **(you)** Buy `tavernparty.co.uk` if it is still free. Worth checking before
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

**The engine needs no database.** `lib/game/engine.ts` is pure, all randomness is
injected, and the whole test suite runs without Supabase configured. That is why
this repo could be built and tested in full before the plan was bought, and it is
why none of the above is a rework.
