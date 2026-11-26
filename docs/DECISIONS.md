# Decisions

## D1. GPS accuracy is a 68% radius, not a sigma
Android reports accuracy as a radius that holds 68% of fixes. The hazard model needs a one-axis sigma, which is the radius divided by about 1.51 (`gpsSigmaFromRadius68`). Using the raw radius overstates GPS error by about 50%. Effect on risk is small (1 to 4 points in `tools/evidence/sensitivity.ts`), so this is a correctness fix, not a big lever. iOS does not state the confidence level, so it is treated the same until measured.

## D2. The club spread prior is the main lever
Moving the spread prior for a 7-iron from 8 m to 25 m changes a water hazard from 7% (low) to 16% (tight), and a bunker in the landing zone from 52% (high) to 23% (tight). The prior has to be checked against measured shots before any band is shown to a player. Until then the app should use the player's own shots as soon as there are about 5, and show the "learning" label.

## D3. Hazards need carry, advice needs total
Water and bunkers are cleared in the air, so hazard risk should use the carry distribution. Club choice and landing position use total distance. The engine takes one mean and spread per call, so the app passes carry stats for hazards and total stats for advice. Club priors that only give total distance need a carry estimate before hazard warnings go live.

## D4. Spread priors come from the within-5-yard rate
A published Shot Scope statistic says 14% of a 15 handicap's 7-iron shots finish within 5 yards of that player's own average (18.5% for scratch, about 12.5% for a 25). Fitting a normal curve gives a spread of about 28 yards (26 m) at 15. The figure includes wind, lies and elevation and a normal fit ignores heavy tails, so it is an upper-side prior. `spreadPrior` scales it with club distance and the twin replaces it with the player's own shots. A two-part mix of good strikes and misses needs real shot data to fit.

## D5. Rules check against Rule 4.3
Rule 4.3a(1) allows distance and direction information and bans elevation and interpreting that information (club or line advice). The USGA device guide also allows a chart of average club distances from prior rounds and weather or lightning alerts. So `club_chart` is allowed in Competition only when built from prior rounds, and the "devices banned" column matches a Local Rule that prohibits distance devices. Processed data from the current round stays blocked.

## D6. Hazard risk is two-dimensional
`assessHazards` now integrates the along and sideways spread over the hazard polygon, so side hazards count. `club.across` sets the sideways spread and defaults to the along spread. The depth-only value stays in `pDepth`.
