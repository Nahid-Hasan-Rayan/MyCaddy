# Course focus

Goal: the prototype is built and demonstrated around three real Malaysian courses, not only the campus demo field.

## Which three

Published rankings disagree, so "top 3" is a choice, not a fact. Checked 2026-11-20.

| Ranking | Leaders it shows |
|---|---|
| Asia Top 100 Golf Courses 2026 | Forest City Classic (Johor) is No. 36 in Asia and No. 1 in Malaysia. Two other Malaysian courses are listed at No. 55 and No. 73. The sources I read do not name them. |
| Top100GolfCourses | KLGCC (formerly TPC KL) West was Malaysia No. 1 in its 2017 and later lists. Saujana Palm, The Mines and Kota Permai follow. |
| All Square | KLGCC West, The Mines, Els Club Desaru Ocean. |
| Golf Digest (older list) | Els Club Desaru Valley, KLGCC East, Kota Permai, Els Club Teluk Datai, KLGCC West. |

KLGCC East is under renovation, so it is out.

Working shortlist:

1. KLGCC West, Kuala Lumpur (my choice).
2. The Mines Resort & Golf Club, Seri Kembangan (KL area).
3. One Johor course, close to home: Forest City Classic or Els Club Desaru Coast (Valley). To confirm.

## What the focus changes

| Phase | Change |
|---|---|
| P2 seeded golfer data | Uses the real par and tee lengths from the facts files, so seeded rounds look like real rounds on these courses. |
| P3 pack builder | Real packs come from OpenStreetMap golf features (greens, bunkers, water, tees). The builder reads GeoJSON, so the same tool serves all three. Coverage differs per course and must be checked first. |
| P3 validator | Add a check that every hole has a green, and that missing geometry is marked `source: "missing"` instead of guessed. |
| P4 evidence | Hazard hand-calculations use real hazard distances from the packs. The GPS marked-point test stays on the campus field, because a round costs too much. |
| P6 table | Real, Simulated and Design-only table gets one row per course: facts real, geometry real or missing, hazards real or simulated. |

## Already done

`tools/courses/klgcc-west.facts.json`: 18 holes, par 72, four tee sets, 6,372 m from the first set, water and bunker flags per hole. The club page names water on 10 holes. A third-party review claims 13, which is why real geometry is needed before any hazard claim goes in the report.

## KLGCC OpenStreetMap check (export of 2026-11-20)

102 features in the view: 33 polygons and 69 lines. This view also holds the neighbouring Kelab Golf Perkhidmatan Awam (KGPA), which is a separate club.

| Feature | Count in the whole view | Note |
|---|---|---|
| Water hazards (`golf=water_hazard`) | 20 | By their coordinates, about 17 sit inside KLGCC and about 3 inside KGPA. Estimate, to be confirmed by the tool. |
| Other water (`natural=water`) | 2 plus 2 wastewater | Not tagged as hazards. Ignore the wastewater. |
| Greens | 1 | One green only, with 4 bunkers and a lake beside it. |
| Bunkers | 4 | All around that one green. |
| Tees, fairways, hole lines | 0 | None mapped. |
| Cart paths | 69 | Well mapped, but not useful for distances. |
| Clubhouse, driving range | 1 each | |

Meaning: KLGCC is mapped as one 36-hole club, East and West together, with no hole numbers. Water is usable. Greens, bunkers and hole lines are not, so front, middle and back distances and bunker warnings are not possible for the West course from OSM alone. The East course is under renovation, so even the mapped features may be out of date.

Next step for KLGCC West: trace the 18 greens, the bunkers, one tee per hole and a hole line per hole in the OSM editor over satellite imagery (about 3 to 4 hours), then re-run `tools/osm/coverage.ts`. Before that, run the same check on The Mines and the Johor course. If one of them is already well mapped, use it as the first full pack.

## Rules for using course data

- Facts (par, lengths) are stored. Club wording is not copied. Hazard flags are in my own words.
- OpenStreetMap data is open but needs credit and its share-alike licence. Credit it in the pack and the report.
- Hazard polygons from imagery are labelled with their source. Any polygon I draw myself is `virtual` and labelled simulated.
- Ask each club, or check its rules, before demoing the app on the course. Some clubs ban distance devices or require an organiser Local Rule. The app already has the switch for it.
- Report the club page's own prices and rules as of the check date only.

## Open items

- Confirm the Johor course.
- Check OpenStreetMap coverage for each of the three.
- Get ground-truth permission before any on-course test.
