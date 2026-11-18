# The Shop

A mobile-friendly web app for the weekly West Bend grocery deals. Anyone can browse; with an account, people can save deals into shopping lists, check items off in the store and star their favorite stores.

- **Front end:** React + Vite (TypeScript), a static site
- **Accounts and lists:** Firebase Authentication (email/password and Google) and Cloud Firestore
- **Hosting:** Firebase Hosting, deployed by GitHub Actions on every push to `main`
- **Deal data:** a static JSON file per week in `public/data/`, written by the weekly roundup task (format: [docs/DATA_FORMAT.md](docs/DATA_FORMAT.md))

## Run it locally

```bash
npm install
npm run dev
```

With no Firebase config the app runs in **demo mode**: sign-up and lists work but are saved only in that browser. A banner says so.

## One-time Firebase setup

1. Create a project at https://console.firebase.google.com (the free Spark plan is enough to start).
2. **Authentication → Sign-in method:** enable *Email/Password* and *Google*. Under *Settings → Authorized domains*, add your custom domain if you use one.
3. **Firestore Database → Create database** (production mode, a US region).
4. **Project settings → Your apps → Add app → Web.** Copy the config values into `.env.local` (see `.env.example`). These values are not secrets; access is controlled by `firestore.rules`.
5. Put the project id in `.firebaserc`.
6. Deploy the security rules once, and again whenever `firestore.rules` changes:
   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules
   ```

## Automatic deploys (GitHub Actions)

`.github/workflows/deploy.yml` builds and deploys on every push to `main`. In the GitHub repo, under **Settings → Secrets and variables → Actions**, add:

- Secret `FIREBASE_SERVICE_ACCOUNT`: a JSON key for a service account with the *Firebase Hosting Admin* role. The easiest way to create it is `npx firebase-tools init hosting:github`, which also adds the secret; afterwards, delete any workflow files it generates, since `deploy.yml` already exists.
- Secret `FIREBASE_WEB_CONFIG`: the four `VITE_FIREBASE_*=` lines from your `.env.local`.
- Variable `FIREBASE_PROJECT_ID`: your project id.

To deploy by hand instead: `npm run build && npx firebase-tools deploy --only hosting`.

## Weekly data and review

Each Wednesday the roundup task:

1. writes `public/data/<date>.json` and `public/data/current.json` on a branch named `weekly-deals/<date>`
2. opens a pull request titled "Weekly deals: <dates>" with a summary of what changed and anything unverified
3. `.github/workflows/preview.yml` validates and builds it, deploys it to a temporary preview site (expires in 7 days), and posts the preview link on the PR

Review the preview on your phone. **Merge the PR to publish**; `deploy.yml` then puts it live. Close it to skip a week. Until you merge, the live site keeps last week's data.

`npm run build` runs `npm run validate` first, so a malformed file fails the preview check and can't be deployed.

Turn on branch protection for `main` (Settings → Branches) and require the "Preview" check so a failing week can't be merged by mistake.

## Data model (Firestore)

```
users/{uid}                 { favoriteStores: string[], createdAt }
users/{uid}/lists/{listId}  { name, createdAt, updatedAt, items: ListItem[] }
```

List items copy the deal's name, store, price and edition when they're saved, so lists still read correctly after that week's ad ends. Rules in `firestore.rules` restrict each user to their own documents.
