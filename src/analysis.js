/* UGV Result Analysis — GPA math, what-if simulation and target planning.
 * All functions are pure over a parsed model + a GradeScale.
 */
(function (root) {
  "use strict";

  const NS = (root.UGVResult = root.UGVResult || {});
  const round2 = (n) => Math.round(n * 100) / 100;
  const MAX_POINT = 4.0;

  // Flatten semesters -> courses with stable ids and back-references.
  function buildModel(parsed, scale) {
    const courses = [];
    parsed.semesters.forEach((sem, si) => {
      sem.courses.forEach((c, ci) => {
        courses.push({
          id: `${si}:${ci}`,
          semIndex: si,
          semLabel: sem.label,
          code: c.code,
          title: c.title,
          credit: c.credit,
          grade: c.grade,
          gpa: c.gpa,
          graded: c.graded,
          point: c.graded ? scale.pointFor(c.grade) : null,
          // Grade classification drives everything downstream:
          //   letter     -> counts in GPA, editable, improvable
          //   incomplete -> "I", exam not taken: non-GPA but editable/simulatable
          //   pass       -> COMPETENT etc.: non-GPA, locked
          //   blank      -> empty: non-GPA, editable
          kind: scale.gradeKind(c.grade),
          letter: scale.gradeKind(c.grade) === "letter",
          // Editable in the simulator: real grades and not-yet-taken courses.
          editable: scale.gradeKind(c.grade) === "letter" || scale.gradeKind(c.grade) === "incomplete" || scale.gradeKind(c.grade) === "blank",
        });
      });
    });
    return { parsed, courses, scale };
  }

  // Credit-weighted average. Only standard letter grades (A+…F) count toward
  // GPA — COMPETENT / I (Incomplete) / blank are excluded from both numerator
  // and denominator. `overrides` maps course id -> letter grade to substitute
  // (used for what-if and simulating not-yet-taken courses).
  function weighted(courses, scale, overrides) {
    let totCredit = 0;
    let totPoints = 0;
    courses.forEach((c) => {
      if (c.credit <= 0) return;
      const letter = overrides && overrides[c.id] != null ? overrides[c.id] : c.grade;
      if (!scale.isLetter(letter)) return; // non-GPA (pass/incomplete/blank)
      const point = scale.pointFor(letter);
      if (point == null) return;
      totCredit += c.credit;
      totPoints += c.credit * point;
    });
    return { credits: totCredit, points: totPoints, gpa: totCredit ? totPoints / totCredit : 0 };
  }

  function cgpa(model, overrides) {
    return weighted(model.courses, model.scale, overrides).gpa;
  }

  function semesterGpas(model, overrides) {
    const bySem = {};
    model.parsed.semesters.forEach((sem, si) => {
      const courses = model.courses.filter((c) => c.semIndex === si);
      const w = weighted(courses, model.scale, overrides);
      bySem[si] = { index: si, label: sem.label, order: sem.order, withheld: sem.withheld, ...w };
    });
    return Object.values(bySem).sort((a, b) => a.order - b.order);
  }

  // Weakest-first list of improvable courses, ranked by CGPA ROI.
  // gain = credit * (maxPoint - currentPoint) / totalCredits.
  function recommendations(model, opts) {
    const maxPoint = (opts && opts.maxPoint) || MAX_POINT;
    const base = weighted(model.courses, model.scale);
    const totalCredits = base.credits || 1;
    return model.courses
      .filter((c) => c.letter && c.credit > 0 && c.point != null && c.point < maxPoint)
      .map((c) => ({
        ...c,
        roi: (c.credit * (maxPoint - c.point)) / totalCredits, // max CGPA lift
      }))
      .sort((a, b) => b.roi - a.roi);
  }

  /**
   * Target planner. Greedy over highest-capacity courses: how to reach
   * `targetCgpa` with the fewest / lightest grade improvements.
   * Returns { feasible, current, target, maxReachable, steps[], resultCgpa }.
   */
  function planForTarget(model, targetCgpa, opts) {
    const maxPoint = (opts && opts.maxPoint) || MAX_POINT;
    const scale = model.scale;
    const base = weighted(model.courses, scale);
    const totalCredits = base.credits;
    const current = base.gpa;

    // Capacity of each improvable course, richest first. Only standard
    // letter-graded courses are retakeable — pass/fail markers are skipped.
    const improvable = model.courses
      .filter((c) => c.letter && c.credit > 0 && c.point != null && c.point < maxPoint)
      .map((c) => ({ course: c, capacity: c.credit * (maxPoint - c.point) }))
      .sort((a, b) => b.capacity - a.capacity);

    const maxReachable = totalCredits
      ? (base.points + improvable.reduce((s, x) => s + x.capacity, 0)) / totalCredits
      : 0;

    const targetPoints = targetCgpa * totalCredits;
    let deficit = targetPoints - base.points;

    if (deficit <= 0) {
      return { feasible: true, current: round2(current), target: targetCgpa, alreadyMet: true, steps: [], resultCgpa: round2(current), maxReachable: round2(maxReachable) };
    }
    if (targetCgpa > maxReachable + 1e-9) {
      return { feasible: false, current: round2(current), target: targetCgpa, maxReachable: round2(maxReachable), steps: [] };
    }

    const grades = scale.letterGrades(); // standard A+ … F only, best -> worst
    const steps = [];
    const overrides = {};
    for (const item of improvable) {
      if (deficit <= 1e-9) break;
      const c = item.course;
      const needPerCredit = deficit / c.credit; // extra point-per-credit still needed
      const neededPoint = Math.min(maxPoint, c.point + needPerCredit);
      // Smallest grade whose point >= neededPoint.
      let chosen = null;
      for (let i = grades.length - 1; i >= 0; i--) {
        const p = scale.pointFor(grades[i]);
        if (p != null && p >= neededPoint - 1e-9 && p > c.point) {
          chosen = { grade: grades[i], point: p };
          break;
        }
      }
      if (!chosen) chosen = { grade: grades[0], point: scale.pointFor(grades[0]) };
      const gain = c.credit * (chosen.point - c.point);
      overrides[c.id] = chosen.grade;
      deficit -= gain;
      steps.push({
        code: c.code,
        title: c.title,
        semLabel: c.semLabel,
        credit: c.credit,
        fromGrade: c.grade,
        fromPoint: c.point,
        toGrade: chosen.grade,
        toPoint: chosen.point,
        cgpaAfter: round2(cgpa(model, overrides)),
      });
    }

    return {
      feasible: deficit <= 1e-6,
      current: round2(current),
      target: targetCgpa,
      maxReachable: round2(maxReachable),
      steps,
      resultCgpa: round2(cgpa(model, overrides)),
    };
  }

  // Not-yet-final courses that can still earn a real grade: "I" (Incomplete)
  // and blank entries. Excludes COMPETENT-style pass markers (already done).
  function ungradedCourses(model) {
    return model.courses.filter(
      (c) => c.credit > 0 && (c.kind === "incomplete" || c.kind === "blank")
    );
  }

  // Project CGPA assuming every currently-ungraded course earns `letter`.
  function scenario(model, letter, extraOverrides) {
    const overrides = Object.assign({}, extraOverrides);
    ungradedCourses(model).forEach((c) => (overrides[c.id] = letter));
    const w = weighted(model.courses, model.scale, overrides);
    return { letter, cgpa: round2(w.gpa), credits: w.credits, pointPerCourse: model.scale.pointFor(letter) };
  }

  // Grade counts + credits, ordered by the scale (best -> worst).
  function gradeDistribution(model) {
    const map = {};
    model.courses.forEach((c) => {
      if (!c.letter || c.credit <= 0) return;
      const g = model.scale.normalizeLetter(c.grade);
      (map[g] = map[g] || { grade: g, count: 0, credits: 0 }).count++;
      map[g].credits += c.credit;
    });
    const order = model.scale.grades();
    return Object.values(map).sort(
      (a, b) => (order.indexOf(a.grade) + 999 * (order.indexOf(a.grade) < 0)) -
                (order.indexOf(b.grade) + 999 * (order.indexOf(b.grade) < 0))
    );
  }

  // "If you raised your weakest N subjects to `toGrade`, CGPA becomes…".
  // Returns { cgpa, gain, courses:[{code,title,fromGrade}] }.
  function improveTop(model, n, toGrade) {
    const grade = toGrade || "A+";
    const picks = recommendations(model).slice(0, n);
    const overrides = {};
    picks.forEach((c) => (overrides[c.id] = grade));
    const after = round2(cgpa(model, overrides));
    return {
      cgpa: after,
      toGrade: grade,
      gain: round2(after - cgpa(model)),
      courses: picks.map((c) => ({ code: c.code, title: c.title, fromGrade: c.grade })),
    };
  }

  /**
   * GPA required in a future semester of `plannedCredits` credits to reach
   * `targetCgpa`. Returns { requiredGpa, feasible, current, plannedCredits }.
   */
  function requiredNextGpa(model, targetCgpa, plannedCredits) {
    const base = weighted(model.courses, model.scale);
    const pc = Number(plannedCredits) || 0;
    if (pc <= 0) return { requiredGpa: null, feasible: false, current: round2(base.gpa), plannedCredits: pc };
    const needPoints = targetCgpa * (base.credits + pc) - base.points;
    const requiredGpa = needPoints / pc;
    return {
      requiredGpa: round2(requiredGpa),
      feasible: requiredGpa <= MAX_POINT + 1e-9 && requiredGpa >= 0,
      current: round2(base.gpa),
      plannedCredits: pc,
      projectedCgpa: round2((base.points + pc * Math.min(MAX_POINT, Math.max(0, requiredGpa))) / (base.credits + pc)),
    };
  }

  // Flat CSV of every course + a CGPA summary row.
  function toCsv(model) {
    const esc = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [["Semester", "Code", "Title", "Credit", "Grade", "GradePoint"].join(",")];
    model.courses.forEach((c) =>
      lines.push(
        [c.semLabel, c.code, c.title, c.credit, c.grade || "", c.point == null ? "" : c.point].map(esc).join(",")
      )
    );
    const overall = weighted(model.courses, model.scale);
    lines.push("");
    lines.push(["", "", "CGPA", overall.credits, "", round2(overall.gpa)].map(esc).join(","));
    return lines.join("\n");
  }

  NS.Analysis = {
    buildModel, weighted, cgpa, semesterGpas, recommendations, planForTarget,
    ungradedCourses, scenario, gradeDistribution, requiredNextGpa, toCsv, improveTop,
    round2, MAX_POINT,
  };
})(window);
