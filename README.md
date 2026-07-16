# Epidemic Preparedness and Response

An interactive book about epidemic preparedness and response, built with [Quarto](https://quarto.org). Each chapter pairs a short explanation with a playable, browser based visualization (for example a CUSUM "suspicion tank") that builds intuition for the statistics behind disease surveillance.

Live site: https://thinhong.github.io/epr/

## How it is built

The book is a Quarto book project (`_quarto.yml`) that renders to `_book/`. It uses R 4.5.2 for a small amount of computation, with every package pinned by [renv](https://rstudio.github.io/renv/) in `renv.lock`. Styling lives in `_brand.yml` and `epr.scss`, and the house style is documented in `DESIGN.md`. The interactive figures are plain JavaScript in `js/` (`cusum.js`, `cusum-epi.js`, `epr-viz.js`).

## Working locally

You need [Quarto](https://quarto.org/docs/get-started/) and R installed. Restore the pinned R packages once:

```r
renv::restore()
```

Preview the book with live reload while you edit:

```bash
quarto preview
```

Render the whole book:

```bash
quarto render
```

Rendering runs the R code and stores the results in `_freeze/`. The `_book/` output is not tracked (it is published to the `gh-pages` branch), but `_freeze/` is committed so the site can be rebuilt in CI without re-running R.

## Publishing

Publishing is automatic. Every push to `main` runs `.github/workflows/publish.yml`, which installs Quarto, renders the book from the frozen results in `_freeze/`, and pushes the site to the `gh-pages` branch. Because the computation is frozen, the CI job does not need R or your R packages, which keeps it fast and avoids package build problems.

If you change any R code, re-render locally with `quarto render` and commit the updated `_freeze/` folder. The interactive JavaScript figures are not R, so most edits do not need this.

### One time GitHub Pages setup

After the first successful workflow run has created the `gh-pages` branch:

1. Open the repository on GitHub and go to Settings, then Pages.
2. Under Build and deployment, set Source to "Deploy from a branch".
3. Choose the `gh-pages` branch and the `/ (root)` folder, then click Save.

The site goes live at https://thinhong.github.io/epr/ within a minute or two.

### Manual publish (optional)

If you would rather publish from your own machine instead of the Action, render locally and push to the same branch:

```bash
quarto publish gh-pages
```
