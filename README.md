## Env Setup
- Local dir (temp on my desktop)
- vscode pointing to dir
- in vscode terminal set up the Node/react env:
  - npm create vite@latest
  - npm install
  - npm install (requisites like tailwind-css firebase-db backend ...etc )
  - npm run dev (runs on localhost for test)
- then created git repo in that dir, and pushed everything to github
- used Vercel tied to the github, which knew it was a vite/react app, and could build/deploy on any updates to the github repo
- setup cname in dns to redirect to vercel app domain name

## App Generation
- Google gemini created "single file react app"
- replaced App.jsx with code, modified the firebase authentication to use api-key from google (allow anon access, but only from vercel website, and use a database)
