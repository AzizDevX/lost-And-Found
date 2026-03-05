# 🎒 University Lost & Found — Login Page

A polished, production-ready Next.js login page with full i18n support.

## Stack
- **Next.js 14** (App Router)
- **next-intl** — i18n routing + translations
- **TypeScript**

---

## Getting Started

```bash
npm install
npm run dev
# → http://localhost:3000/en/login
```

---

## i18n Architecture

```
messages/
  en.json   ← English (default)
  fr.json   ← French
  ar.json   ← Arabic (RTL auto-detected)

i18n.ts     ← locale list, RTL config, getRequestConfig
middleware.ts ← locale-prefix routing (/en/, /fr/, /ar/)
```

**URL structure:**  `/[locale]/login`  
e.g. `localhost:3000/en/login`, `/fr/login`, `/ar/login`

### Adding a new language
1. Create `messages/[lang].json`
2. Add the locale code to `locales` in `i18n.ts`
3. Add its name to `localeNames` and direction to `localeDir`

---

## Connecting Your Real API

Open `lib/auth.ts` and follow the comments:

```ts
// lib/auth.ts  — swap Option B (mock) for Option A (real API)

// Option A: real API — uncomment this block
const res = await fetch(`${BASE_URL}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
```

Set your API URL in `.env.local`:
```
NEXT_PUBLIC_API_URL=https://your-api.university.edu/api
```

The `AuthResult` / `AuthUser` types in `lib/auth.ts` define the expected response shape — adjust them to match your API contract.

---

## Demo Credentials (mock only)
```
Email:    demo@university.edu
Password: password123
```
Remove the demo hint block in `login/page.tsx` once your API is live.

---

## File Structure

```
app/
  [locale]/
    layout.tsx        ← locale + font + dir setup
    globals.css
    login/
      page.tsx        ← main login page
lib/
  auth.ts             ← API stub (swap for real API here)
messages/
  en.json / fr.json / ar.json
i18n.ts               ← i18n config
middleware.ts         ← routing middleware
```
