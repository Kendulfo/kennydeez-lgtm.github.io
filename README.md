# Kenneth Dulfo — Portfolio

A static HTML/CSS/JS rebuild of `mynameiskennethdulfo.com`, recovered from the live
Figma Make site after access to the source was lost.

No build step, no framework, no dependencies. Open `index.html` and it runs.

## Run it locally

```bash
py -m http.server 8124
```

Then open <http://localhost:8124>. (A plain double-click on `index.html` also works,
but a server is closer to production.)

## Files

```
index.html        Everything: sidebar, home sections, both case studies
css/styles.css    Design tokens + all styling
js/main.js        Theme toggle, view routing, scrollspy, scroll reveal
assets/           Images pulled from the original site
```

## How it's organised

**`index.html`** holds three "views":

| View | Element | Shown when |
|---|---|---|
| Home | `#view-home` | default, or hash `#hero` |
| AIA case study | `#view-aia` | hash `#case/aia` |
| Mobile Banking case study | `#view-banking` | hash `#case/banking` |

`js/main.js` shows one and hides the others. Anything with `data-case="x"` opens
`#view-x` when clicked — that's how the project cards and the "Next Project" cards work.

**`css/styles.css`** starts with the design tokens, lifted from the original build.
Change a token at the top and it cascades everywhere. Dark mode redefines the same
tokens under `.dark`; nothing else needs touching.

## Common edits

**Change any copy** — edit the text directly in `index.html`. It's all plain markup.

**Add a job to the resume** — copy an `<article class="job">` block inside `.timeline`.

**Add a project card** — copy a `<button class="card project" data-case="…">` block
in the `#work` grid. For a card with no case study yet, use
`<div class="card project" data-soon>` and a `<span class="badge-soon">` instead.

**Add a new case study** —
1. Copy the whole `<article class="view" id="view-banking">` block.
2. Give it a new id, e.g. `id="view-ecommerce"`.
3. Point a project card at it with `data-case="ecommerce"`.

**Retheme** — edit the tokens in `:root` and `.dark` at the top of `styles.css`.
The accent tiles in the hero use `--accent-1` / `--accent-2`.

**Icons** — defined once as `<g>` blocks in the `<defs>` at the top of `index.html`,
used via `<svg class="ic" viewBox="0 0 24 24"><use href="#i-name"/></svg>`.
Every icon svg needs that `viewBox` or it renders cropped.

## Deployment

Hosted on GitHub Pages from the repo `kennydeez-lgtm.github.io`, served at
<https://mynameiskennethdulfo.com>.

The `CNAME` file at the repo root tells Pages which domain to serve — don't delete it.
DNS lives at GoDaddy: the apex has four `A` records pointing at GitHub's Pages IPs
(`185.199.108–111.153`), and `www` is a `CNAME` to `kennydeez-lgtm.github.io`.

Pushing to `main` publishes. There is no build step, so what's in the repo is what ships.

## What was fixed vs. the original

The live site had a few broken things, corrected here:

- **"Designs" section was empty** — `#showcase` rendered at 0px height, so the nav
  item scrolled to nothing. The section and its nav item have since been removed
  outright; add them back if there's ever real visual work to show.
- **Mobile Banking case study had the wrong `<h1>`** — it read "AIA Digital Design
  System". Now titled correctly.
- **"Next Project" on Mobile Banking** linked to E-commerce Platform but actually
  navigated back to AIA. Now the two case studies point at each other correctly.
- **Typo** — "different regiosn" → "different regions".
- **"fast-growing fintech startup"** in the AIA case study contradicted the card
  copy, which describes an insurance company. Changed to "insurance business".
- Case studies now have real URLs (`#case/aia`), so back/forward and refresh work.

## Still to do

- **Resume PDF** — the Download / View Full Resume buttons point at
  `assets/kenneth-dulfo-resume.pdf`, which does not exist yet. Drop the file in.
- **E-commerce Platform** and **Component Library** have no case studies. Their
  images are Unsplash placeholders from the original site, not real project shots.
- The contact button opens `mailto:kendulfo@gmail.com` — swap in a form if preferred.
