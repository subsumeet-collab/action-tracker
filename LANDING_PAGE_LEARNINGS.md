# Mobile Fundraiser Landing Page — Research & Redesign Rationale

Companion doc for `landing.html`. Captures where the redesign's decisions came
from, so this can be updated once real Clarity heatmap screenshots are shared
(swap the "assumed" hotspots below for actual ones and re-check the layout
against them).

**Context:** ~99% of traffic is mobile. Design target is a phone viewport
(360–430px wide), not desktop-first-then-shrink.

## Note on sourcing

Live fetches to `impactguru.com` and `donateforhealth.com` were blocked by
this environment's network policy. Section 1 and 2 below were rewritten
against the actual mobile screenshots you shared of both pages (not
guessed). The JioHotstar screenshot and your description of the target
"reel" interaction cover section 3. Real Microsoft Clarity heatmap images
haven't been shared yet — section 4's hotspot claims are still generic
mobile-UX heuristics; swap them for your actual click/attention data once
you send it, and re-check the layout against it.

## 1a. Screenshot teardown — our page (ImpactGuru)

Top to bottom, in order:
1. Logo + currency selector (₹ INR) header.
2. Bold headline ("Satyam's Sister Can Save Him From Cancer Only With Your
   Help!") — **above** the hero image, not overlaid on it.
3. Three outlined trust-badge pills directly under the headline: Verified /
   Donor Protection / Tax Benefits — before the user has seen a single photo.
4. Hero image (single photo, small pagination dots below it suggest a short
   gallery) with a bold white caption baked into the bottom of the image.
5. One large, unmissable orange "Donate Now" button with a hand/heart icon
   — the single highest-weight CTA on the page, right after the image.
6. A donor avatar stack + count ("3") + an outline heart/save icon, in a
   thin row right under the CTA — cheap, high-value social proof.
7. Pill tabs: Story (active/filled) · Documents¹ · Updates¹ — counts shown
   on the inactive tabs to signal there's more to see.
8. An embedded story **video** card (thumbnail, org logo, play button,
   "Watch on YouTube" badge) — video is used as a storytelling device, not
   just photos.
9. Story text as a plain paragraph below the video.

## 1b. Screenshot teardown — competitor (DonateForHealth / Ketto)

1. Co-branded header (DonateForHealth + Ketto) + currency selector.
2. Hero: a **two-photo collage** (not a single image) under one rounded
   card, thin progress-colored bar along the very top edge.
3. Headline **below** the image (opposite of ImpactGuru's above-image
   placement): "Liver disease stole everything from my son. Help him
   survive this battle!"
4. Simple underline tabs (Story / Documents¹) — lighter-weight than
   ImpactGuru's filled pill tabs.
5. Share counts shown directly as their own badges: Facebook (885),
   WhatsApp (797) — proof-by-numbers instead of a generic share icon.
6. Story text in **italic serif**, with key medical/financial phrases
   **bolded inline** ("decompensated Chronic Liver Disease", "5-7
   medicines every day", "liver transplant") — lets a skimming reader catch
   the stakes without reading the full paragraph.
7. A "Contact" section: hospital name as a tappable, underlined, verifiable
   link ("KIMS Hospitals, Secunderabad") in its own card, with a share icon
   — a concrete, checkable trust anchor distinct from generic badges.
8. "Medical Documents" section.
9. Sticky bottom bar shows the **exact suggested amount already on the
   button** — "Contribute ₹2500" — not a generic "Donate Now" that still
   requires picking an amount afterward. One less tap to the payment screen.

**Combined takeaway used in the redesign:** lead with an unmissable single
CTA + cheap social proof (ImpactGuru), make key facts skimmable via bolded
inline terms (DonateForHealth), and remove the "figure out the amount"
step by keeping a live suggested amount on the sticky CTA at all times
(DonateForHealth) — implemented in `landing.html` as the bottom bar's label
updating live to "Donate ₹1,000" etc.

## 2. JioHotstar reference (the interaction model you want to mirror)

From the screenshot: a full-bleed card carousel, a badge overlay top-left
("#4 in Hindi Today"), title + metadata overlaid bottom-left on the image,
two floating circular action buttons bottom-right (add / play), and a
horizontally-scrollable, pill-tabbed section below ("Continue Watching…"
with TV / Movies / Sports chips) that overlaps the content above it.

Mapped onto a fundraiser page:
- Card carousel → **story-reel hero**: ~5 swipeable slides that tell the
  case visually (patient, family, hospital/treatment, medical need,
  hope/impact) instead of one static banner.
- Badge overlay → urgency/trust badge ("Verified fundraiser", "Critical −
  7 days left").
- Bottom-left title overlay → patient name + one-line context, so the
  headline reads in under a second even mid-swipe.
- Floating circular buttons → **Save** and **Share** actions pinned to
  each slide, always reachable without leaving the hero.
- Pill-tabbed section → **Story / Documents / Updates / Donors** tab bar,
  so proof (documents) is one tap away instead of a scroll away.
- Bottom nav bar → **persistent bottom action bar** (Share · Donate Now ·
  Call/WhatsApp organizer), always visible regardless of scroll position,
  mirroring how JioHotstar keeps Search/Home/Profile permanently reachable.

## 3. Mobile heatmap heuristics used (placeholder until real Clarity data lands)

Standard mobile-heatmap findings this design leans on:
- **Thumb zone**: taps cluster in the bottom third of the screen on tall
  phones → primary CTA lives in a sticky bottom bar, not just inline.
- **First-viewport decay**: engagement drops sharply below the first
  screen's content → the hero must carry the hook, the trust badge, and a
  path to donate without any scrolling.
- **Carousel engagement**: swipeable/story-style media gets materially more
  interaction time than a single static hero image, because it invites a
  gesture instead of a passive glance.
- **Tab/segmented controls concentrate clicks**: pill-style tabs (as seen
  in the JioHotstar screenshot) draw taps because they promise more content
  without a full scroll commitment — used here for Story/Documents/Updates/
  Donors.

**When you share the actual Clarity screenshots**, check specifically: (a)
does engagement really concentrate on the hero images (validates the reel
approach) vs. scrolling straight to the amount/progress bar; (b) do users
tap the existing sticky donate button or abandon before reaching it; (c) is
there dead space being clicked (a sign of a missing affordance, e.g. users
tapping a static image expecting it to swipe).

## 4. What changed in `landing.html` vs. a conventional layout

1. Static hero → **5-slide swipeable story-reel** with auto-advance,
   segmented top progress bar (Instagram/JioHotstar-style), tap-left/right
   and drag gestures.
2. Single donate button → **persistent bottom action bar** (Share ·
   Donate Now · Call organizer) that survives all scrolling, plus a
   **quick-amount bottom sheet** on tap instead of navigating away — and the
   bottom bar's label updates live to the last-picked amount ("Donate
   ₹1,000"), copying DonateForHealth's amount-already-on-the-button pattern.
3. One long scroll → **pill tab bar** (Story / Documents / Updates /
   Donors) with counts on inactive tabs, so proof and social proof are one
   tap away, matching ImpactGuru's tab treatment.
4. Trust signals (verified badge, 80G tax receipt, secure payment) surfaced
   in the hero overlay and directly under the progress bar, not buried in
   the footer.
5. A donor avatar-stack + supporter count + save icon sits directly under
   the primary CTA (ImpactGuru's cheap social-proof row), plus a rotating
   "X donated ₹Y · Z min ago" ticker for ongoing urgency.
6. An embedded story-video card sits at the top of the Story tab (mirrors
   ImpactGuru's YouTube story card) as a second, lower-effort way to absorb
   the story besides reading.
7. Story copy uses italic tone with **bolded key medical/cost phrases**
   inline (DonateForHealth's scannability technique) instead of a flat
   paragraph.
8. A "Contact" card with a verifiable, linked hospital name (DonateForHealth's
   trust anchor) sits under the organizer block in the Story tab.

This is a self-contained static prototype (`landing.html`, no build step,
served automatically by the existing `express.static` in `server.js`) with
placeholder patient content and gradient placeholder art in place of real
photos — swap both for real case data/imagery before using in production.
