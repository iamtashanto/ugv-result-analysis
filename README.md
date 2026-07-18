# UGV Result Analysis

A Chrome/Edge (Manifest V3) extension that supercharges the **UGV Student Portal → Results** page with:

- 📈 **Trend** — semester-wise GPA line chart, CGPA/credits summary, a ranked list of the subjects that would lift your CGPA the most, and a **grade distribution** breakdown.
- 🧪 **What-If simulator** — change any subject's grade from a dropdown (grouped by semester) and watch your CGPA recompute live; changed subjects are highlighted, and you can **search** to find one fast.
- 🎯 **Target planner** — enter a goal CGPA and get the fewest, lightest grade improvements (retakes) needed to reach it — or told it's out of reach and the max you can hit. **Export the plan as a PDF**.
- 🔮 **Forecast** — **safe / target / reach** projections for your in-progress subjects, plus a *"what GPA do I need next semester?"* calculator for any goal CGPA and credit load.
- 📄 **PDF grade sheet** — one click opens a clean, print-optimized sheet; use the browser's *Save as PDF*.
- 📊 **CSV export** — download every course + grade point for your own spreadsheets.
- 🌗 **Theme-aware & resizable** — the panel follows the portal's own light/dark mode, and you can drag its left edge to resize (double-click to expand full-width). Width is remembered.

Pass/fail markers such as **COMPETENT** and **I (Incomplete)** are shown but never treated as improvable letter grades, so the planner and simulator only suggest real A+…F retakes.

## How the grades are scored

The extension **learns the grade → point scale from your own results**: every row on the page carries both a letter grade and its grade point, so simulations match exactly what the portal computes. Grades not present on the page fall back to the standard Bangladesh 4.0 scale (`A+ 4.00 … F 0.00`), configurable in [src/gradeScale.js](src/gradeScale.js).

Only **graded** courses with a positive credit count toward GPA/CGPA; in-progress and withheld entries are excluded.

## Install (developer mode)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Toggle **Developer mode** on.
3. Click **Load unpacked** and select this folder (`ugv-result-analysis`).
4. Go to <https://ugv.edu.bd/student-dashboard/results>.
5. Click the floating **Analyze** button (bottom-right).

## Project layout

| File | Role |
|------|------|
| [manifest.json](manifest.json) | MV3 manifest; content scripts scoped to the results URL |
| [src/gradeScale.js](src/gradeScale.js) | Learnable grade→point scale + fallback |
| [src/parser.js](src/parser.js) | Parses the results DOM by class hook |
| [src/analysis.js](src/analysis.js) | Pure math: CGPA, what-if, target planner, recommendations |
| [src/pdf.js](src/pdf.js) | Printable grade-sheet generator |
| [src/ui.js](src/ui.js) | Injected slide-in panel + SVG chart |
| [src/content.js](src/content.js) | Entry point / DOM-ready wiring |
| [test/logic.test.js](test/logic.test.js) | Node smoke test for the math (`node test/logic.test.js`) |

## Notes / limits

- The parser depends on the portal's current CSS class hooks (`.results-course-code`, `.results-credit-badge`, `.results-grade-badge`, `.results-gpa-value`). If UGV redesigns the page, update [src/parser.js](src/parser.js).
- Retake semantics assume the improved grade **replaces** the old one (standard UGV rule). If your program averages retakes instead, the planner numbers are optimistic.
- All computation is local; nothing is sent anywhere.
