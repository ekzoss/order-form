## Env Setup
- Local dir (temp on my desktop)
- vscode pointing to dir
- install Node.js locally so `node`, `npm`, and `npx` are available
- in vscode terminal set up the Node/react env:
  - `npm install`
  - `npm run dev` (runs on localhost for test)
- then created git repo in that dir, and pushed everything to github
- used Vercel tied to the github, which knew it was a vite/react app, and could build/deploy on any updates to the github repo
- setup cname in dns to redirect to vercel app domain name

## Firebase Config via Vite / Vercel Env Vars
Firebase config is now loaded from Vite environment variables instead of being hardcoded in [`src/App.jsx`](src/App.jsx).

Create a local `.env` file based on [`.env.example`](.env.example) with:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Example local flow:
- copy [`.env.example`](.env.example) to `.env`
- fill in the Firebase values for the environment you want to use
- run `npm install`
- run `npm run dev`

## Multiple Independent Deployments from One Repo
You can now deploy the same GitHub repo to multiple Vercel projects and point each one at a different Firebase project/database.

For each Vercel project:
- open the Vercel project settings
- add the same `VITE_FIREBASE_*` variables from [`.env.example`](.env.example)
- use that deployment's Firebase project values
- redeploy

That lets you keep one shared codebase while each Vercel deployment uses its own Firebase backend.

## App Generation
- Google gemini created "single file react app"
- replaced App.jsx with code, modified the firebase authentication to use api-key from google (allow anon access, but only from vercel website, and use a database)
- Development loop was to edit local version in vscode (while npm run dev was going, automatically updating localhost copy as I saved changes), then commit and push to github to publish to prod.. a minute later vercel would pick up changes, rebuild it with vite and publish it.
