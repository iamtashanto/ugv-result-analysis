/* UGV Result Analysis — grade scale
 *
 * Standard Bangladesh 4.0 scale is the fallback. The real point value for a
 * grade is *learned* from the results page whenever a (grade, gpa) pair is
 * observed, so simulations always match what the portal itself computes.
 */
(function (root) {
  "use strict";

  // Fallback letter -> point map (standard BD 4.0 scale).
  const DEFAULT_SCALE = {
    "A+": 4.0,
    A: 3.75,
    "A-": 3.5,
    "B+": 3.25,
    B: 3.0,
    "B-": 2.75,
    "C+": 2.5,
    C: 2.25,
    D: 2.0,
    F: 0.0,
  };

  // Ordered best -> worst, used to build simulator dropdowns.
  const GRADE_ORDER = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D", "F"];

  function normalizeLetter(raw) {
    if (raw == null) return "";
    return String(raw)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      // portal sometimes uses unicode minus / different plus glyphs
      .replace(/[−–—]/g, "-");
  }

  /**
   * A GradeScale starts from the default map and overrides entries with values
   * actually seen on the page. `learn` records an observation; `pointFor`
   * returns the best-known point value for a letter.
   */
  function createScale() {
    const learned = Object.create(null);

    return {
      learn(letter, point) {
        const key = normalizeLetter(letter);
        const p = Number(point);
        if (!key || !Number.isFinite(p)) return;
        // Trust the page over the default table.
        learned[key] = p;
      },
      pointFor(letter) {
        const key = normalizeLetter(letter);
        if (key in learned) return learned[key];
        if (key in DEFAULT_SCALE) return DEFAULT_SCALE[key];
        return null; // unknown / non-graded (e.g. blank, "-", "W")
      },
      isGraded(letter) {
        return this.pointFor(letter) !== null;
      },
      // A standard, improvable letter grade (A+ … F) — NOT pass/fail markers
      // like COMPETENT, I (Incomplete), W. Those are shown but never used as
      // simulation/retake targets.
      isLetter(letter) {
        return GRADE_ORDER.includes(normalizeLetter(letter));
      },
      // Only the standard letter grades, richest first — for planners/dropdowns.
      letterGrades() {
        return GRADE_ORDER.slice();
      },
      // Grades available for what-if selection, richest first.
      grades() {
        const set = new Set(GRADE_ORDER);
        Object.keys(learned).forEach((g) => set.add(g));
        return GRADE_ORDER.filter((g) => set.has(g)).concat(
          [...set].filter((g) => !GRADE_ORDER.includes(g))
        );
      },
      normalizeLetter,
    };
  }

  root.UGVResult = root.UGVResult || {};
  root.UGVResult.GradeScale = { createScale, DEFAULT_SCALE, GRADE_ORDER, normalizeLetter };
})(window);
