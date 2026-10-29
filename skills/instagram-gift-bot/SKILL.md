---
name: instagram-gift-bot
description: Build, set up and maintain a free Instagram comment-to-DM gift bot (Cloudflare Workers + D1, official Instagram API with Instagram Login). Use when the user wants a bot that answers Instagram comments, sends a DM with a gift link after a real follow check, or says "اعملي بوت", "بوت كومنتارات", "بوت هدايا", "comment bot", or wants to add a keyword or gift to an existing bot. Always talk to the user in Tunisian Darija.
---

# Instagram gift bot — guided setup in Tunisian Darija

You set up a bot for a person who does NOT know how to code. They do the clicks; you do everything else.

What the bot does: someone comments a keyword under a reel → the bot replies under the comment ("بعثتلك ميساج 📩") → sends a DM card "اعمل Follow" with a button "تابعتك ✅" → on click, checks the follow for real (`is_user_follow_business`) → sends the gift link, or "مازلت ما عملتش Follow 😐" with the button again. It also resends on "ما جاتنيش", learns new spellings of keywords, retries failed sends hourly, refreshes the token daily, and has /privacy and /delete-data pages. Everything is logged silently in D1.

## Rules (always)

1. **Language: Tunisian Darija in Arabic script, in every message to the user.** Not Modern Standard Arabic, not French, not English. Technical words (Cloudflare, Worker, webhook, app, token, Follow, DM) stay in Latin letters. Digits 0–9 only. Short sentences. Example tone: «باهي، توّا نحضّرو الحساب متاع Cloudflare. حل الرابط هذا واعمل login.»
   If the user writes in another language, keep answering in Darija unless they explicitly ask to switch.
2. **One step at a time.** Before each step, explain in one or two lines what it is, then give clear numbered choices (1، 2، 3). Wait for the answer.
3. **Never ask for passwords, tokens or secret keys in the chat.** The only secret (the Instagram app secret) goes from Meta straight into the Cloudflare dashboard, typed by the user. If the user pastes a secret in the chat anyway, tell them not to, and tell them to generate a new one in Meta ("Réinitialiser").
   Non-secret IDs are fine to receive: the Instagram username, the Instagram App ID (a number), the workers.dev subdomain.
4. **Never print secrets.** `wrangler deploy` prints plain-text vars: always filter its output, e.g. `npx wrangler deploy 2>&1 | grep -E "^(Uploaded|Deployed)|ERROR|https://"`. Never select the `value` of `ig_token` from D1; check its length only.
5. **100% free.** Cloudflare free plan, Meta free. If something would cost money, say so before.
6. **Official only.** No password-based bots, no fake "not following" answers, nothing against Meta's rules.
7. Give exact click paths with the button names as they appear (Meta's dashboard is often in the user's browser language, e.g. French: «Afficher», «Vérifier et enregistrer»). When unsure what the user sees, ask for a screenshot.
8. If a browser tool (Claude in Chrome) is available and the user agrees, you may click through Meta/Cloudflare pages for them, except: typing passwords, copying the app secret, accepting OAuth/permissions. Those stay with the user.

## Phase 0 — Welcome

Say in Darija, briefly: what the bot does (the flow above, 4–5 short lines), that it takes about 15 minutes, once (say «15 دقيقة»), and the 3 things only they can do (create the Meta app, put the secret key in Cloudflare, log in with Instagram). Then ask if they are ready:
1. إيه، نبداو
2. عندي سؤال قبل

## Speed: the 15-minute plan

The user was promised about 15 minutes. Everything that does not need them is already prepared in `template/` or done by you in the background. So:
- **Ask few questions, all at once.** One message with the 3 things you need (Phase 2). Use the defaults for everything else and do not ask about them unless the user wants to change something.
- **Work while they click.** As soon as you have the username: build and deploy the Worker (Phase 3) yourself while the user creates the Meta app (Phase 4). Only `wrangler login` needs them for a moment.
- **Direct links only.** Always give the exact URL of the page to open, never "go to the menu and find…".
- **Batch checks.** Run the prerequisite checks (`node -v`, folder creation, `npm install`) silently at the start; only mention what is missing.
- **No long explanations.** One or two lines per step. Explain more only if they ask.

## Phase 1 — Check what they have (one message)

In ONE message ask them to confirm (they answer «إيه» or say what is missing):
- Instagram account is **Professional** (Creator or Business). If not: Instagram app → Paramètres → Type de compte et outils → Passer à un compte professionnel.
- A personal Facebook account (needed only to log in to developers.facebook.com). No Facebook Page needed, and it does not have to be linked to the Instagram account.
- A Cloudflare account (free): https://dash.cloudflare.com/sign-up
Meanwhile run `node -v` yourself. If Node.js is missing, tell them to install the LTS from https://nodejs.org and reopen Claude in the same folder.

## Phase 2 — The gifts (one message)

Ask in ONE message, with an example answer they can copy and adapt:
1. Their Instagram username (without @).
2. For each gift: the keyword people comment + the link (Drive, PDF, YouTube, Notion…).
   Example: «sakouhiwael — GUIDE: https://drive.google.com/… — PROMO: https://…»

Defaults (do not ask, mention in one line that they can change them later):
- Gift name in the DM: you write it from the keyword and the link (short, one emoji).
- Reply under the comment: «بعثتلك ميساج 📩».
- DM language: Tunisian Darija (the template texts). If the user writes to you in another language or asks for it, translate every text in `messages.js`, keeping the emojis and the 80-character limit per line.

Check each link opens (curl status) and warn if it is private. Show a short summary table (keyword → gift name → link) and go on unless they want a change.

## Phase 3 — Build and deploy the Worker

You create the bot's folder, never the user. Create `instagram-gift-bot-<username>` inside the folder Claude was opened in (usually Documents) and copy everything from this skill's `template/` folder into it. Tell the user its full path in one line (it is where the bot lives; next time they open Claude in the same folder and say what to change). All commands below run inside that folder.

Fill the template:
- `src/messages.js` → `GIFTS`: one entry per keyword, id = short latin slug. `words` = the keyword plus common misspellings and Arabic/Latin transliterations (8–15 entries), written already cleaned the way `text.js` `words()` cleans text: lowercase, Arabic letters normalized (أإآ→ا، ة→ه، ى→ي), no repeated letters, no punctuation. Test with `node -e` importing `findGift` from `src/text.js` on 10+ variants (good ones match, words like "bravo", "merci", "top" do not).
- Replace every `YOUR_ACCOUNT` (messages.js, pages.js, wrangler.jsonc) with the username.
- `wrangler.jsonc`: `BOT_NAME` = `gift-bot-<username>` (lowercase, dashes, ≤ 40 chars). `VERIFY_WORD` = a random word like `bot-verify-<6 random letters>`.

Deploy:
1. `npm install` in the bot folder.
2. `npx wrangler login` → a browser page opens; the user logs in to Cloudflare and clicks Allow. Ask for this right after Phase 2, then tell them to start Phase 4 (the Meta app) while you finish the deploy.
3. `npx wrangler d1 create <BOT_NAME>` → put the returned id in `DATABASE_ID`.
4. `npx wrangler d1 execute <BOT_NAME> --remote --file=schema.sql`
5. Deploy (filtered output, rule 4). The first deploy may ask to register a workers.dev subdomain: let the user pick one. Read the URL from the output, set `PUBLIC_URL` to it (no trailing slash), deploy again.
6. Check `curl -s -o /dev/null -w "%{http_code}" <PUBLIC_URL>/privacy` returns 200.

Windows notes: if `npx` is blocked in PowerShell, use the Bash tool. If a TLS error appears behind antivirus, retry from Bash.

## Phase 4 — The Meta app (user clicks, you guide)

The key lesson: **the app must use "API setup with Instagram login" (connexion Instagram), never "with Facebook login".** With Facebook login, only the first DM goes out, button clicks never arrive and the second DM fails with "not thread owner".

Guide step by step:
1. https://developers.facebook.com/apps → Create app («Créer une app»). Name: anything, e.g. "<username> bot". Use case: **«Gérer les messages et le contenu sur Instagram»** (Instagram API). No business portfolio needed.
2. In the app: Cas d'utilisation → API Instagram → Personnaliser → **«Configuration de l'API avec la connexion Instagram»**.
   If only the Facebook-login setup is offered, stop and tell the user (in Darija) that Meta did not offer Instagram login on this app; suggest trying a new app, and if it still happens, to contact @sakouhiwael. Do not continue with Facebook login.
3. Permissions: `instagram_business_basic` and `instagram_business_manage_messages` (add them if missing). `instagram_business_manage_comments` is optional: skip it if Meta shows an error.
4. On that page the user copies **«ID d'app Instagram»** (a number, not secret) and sends it to you → set `IG_APP_ID`, deploy.
5. App settings → Basic («Paramètres de l'app → Général»): Privacy Policy URL = `<PUBLIC_URL>/privacy`, User data deletion URL = `<PUBLIC_URL>/delete-data`, category, icon if asked. Save.
6. Publish the app («Publier» → Live). Without Live, real comments do not arrive.

## Phase 5 — The secret key (user only)

Explain: this key is like a password for the app, only Cloudflare should know it.
1. Meta, same page as step 4.2: next to **«Clé secrète Instagram»** → «Afficher» → copy.
2. Cloudflare dashboard → Workers & Pages → `<BOT_NAME>` → Settings → **Variables and Secrets** → Add.
3. Type: **Secret** (not Text). Name: `IG_APP_SECRET`. Value: paste. Deploy.
Check with `npx wrangler secret list` (names only). If it is not listed as a secret, check with the user whether they saved it as Text and ask them to redo it as Secret.

## Phase 6 — Login and webhook

1. Meta, «Configurez la connexion professionnelle Instagram» (business login settings) → add the redirect URL `<PUBLIC_URL>/setup/callback` → save.
2. The user opens `<PUBLIC_URL>/setup`, logs in with their Instagram account, accepts. They must see «✅ البوت مربوط».
   Check: `SELECT key, length(value) FROM settings` shows `ig_token`, and `SELECT kind, detail FROM log ORDER BY id DESC LIMIT 3` shows `setup_done` with `"success":true`. If `setup_error`, read the detail (no token in it) and fix.
3. Meta, «Configurez les webhooks»: URL de rappel = `<PUBLIC_URL>/webhook`, Vérifier le token = the `VERIFY_WORD` → «Vérifier et enregistrer». Then subscribe (toggle on) **comments**, **messages**, **messaging_postbacks**.
   If the account had another bot/tool on this webhook (n8n, ManyChat…), say that it stops receiving events from now.

## Phase 7 — Real test

Meta's «Test» button is not enough. Ask the user to have a friend (another account, not theirs):
1. comment the keyword under a reel,
2. tap «تابعتك ✅» without following → must get «مازلت ما عملتش Follow 😐»,
3. follow, tap again → must get the gift.
Watch `SELECT kind, detail, datetime(at/1000,'unixepoch') FROM log ORDER BY id DESC LIMIT 10` while they test. `bad_signature` = the secret is wrong or another app also sends events. `send_failed` with "not thread owner" = the app is using Facebook login (Phase 4).

Finish with a short Darija summary: what works, the link of each gift, and how to change things later.

## Later (maintenance)

When the user opens Claude in the same folder and asks to add/change a keyword, gift, or text: find the `instagram-gift-bot-*` folder, edit its `src/messages.js`, test `findGift`, deploy (filtered). New users get the right text per gift; people who already got the same gift get «الهدية عندك من قبل».
