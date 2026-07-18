(function (root) {
  "use strict";

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

  const GRADE_ORDER = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D", "F"];

  const PASS_SET = new Set(["COMPETENT", "PASS", "P", "S", "W", "EXEMPT", "EXEMPTED", "CT"]);
  const INCOMPLETE_SET = new Set(["I", "INC", "INCOMPLETE"]);

  function normalizeLetter(raw) {
    if (raw == null) return "";
    return String(raw)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[−–—]/g, "-");
  }

  function createScale() {
    const learned = Object.create(null);

    return {
      countPass: false,
      learn(letter, point) {
        const key = normalizeLetter(letter);
        const p = Number(point);
        if (!key || !Number.isFinite(p)) return;
        learned[key] = p;
      },
      pointFor(letter) {
        const key = normalizeLetter(letter);
        if (key in learned) return learned[key];
        if (key in DEFAULT_SCALE) return DEFAULT_SCALE[key];
        return null;
      },
      isGraded(letter) {
        return this.pointFor(letter) !== null;
      },
      isLetter(letter) {
        return GRADE_ORDER.includes(normalizeLetter(letter));
      },
      letterGrades() {
        return GRADE_ORDER.slice();
      },
      gradeKind(letter) {
        const k = normalizeLetter(letter);
        if (!k || k === "-") return "blank";
        if (GRADE_ORDER.includes(k)) return "letter";
        if (INCOMPLETE_SET.has(k)) return "incomplete";
        if (PASS_SET.has(k)) return "pass";
        return "pass";
      },
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
  root.UGVResult.GradeScale = { createScale, DEFAULT_SCALE, GRADE_ORDER, PASS_SET, INCOMPLETE_SET, normalizeLetter };
})(window);
