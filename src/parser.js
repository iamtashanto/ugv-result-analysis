/* UGV Result Analysis — DOM parser
 *
 * Reads the published results page. The page renders every course row with
 * stable class hooks (.results-course-code, .results-credit-badge,
 * .results-grade-badge, .results-gpa-value), so we parse by class rather than
 * by column position — resilient to column reordering.
 */
(function (root) {
  "use strict";

  const NS = (root.UGVResult = root.UGVResult || {});

  function num(text) {
    if (text == null) return null;
    const m = String(text).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }

  function txt(el) {
    return el ? el.textContent.trim() : "";
  }

  // Turn "8th", "1st Semester" etc. into a sortable integer.
  function semesterOrder(label) {
    const n = num(label);
    return n == null ? 999 : n;
  }

  function parseCourseRow(tr) {
    const code = txt(tr.querySelector(".results-course-code"));
    const title = txt(tr.querySelector(".results-course-title")) || code;
    const credit = num(txt(tr.querySelector(".results-credit-badge")));

    const gradeEl = tr.querySelector(".results-grade-badge");
    const unsetEl = tr.querySelector(".results-unset-label, .results-grade-badge--unset");
    let grade = gradeEl ? txt(gradeEl) : "";
    // Treat placeholder glyphs / "not published" as ungraded.
    const isUnset = !!unsetEl || /^[-–—]*$/.test(grade) || /not|pending|await/i.test(grade);
    if (isUnset) grade = "";

    const gpa = num(txt(tr.querySelector(".results-gpa-value")));

    if (!code && credit == null && !grade) return null; // spacer / header row
    return { code, title, credit: credit == null ? 0 : credit, grade, gpa, graded: !!grade };
  }

  function parseSemesterCard(card) {
    const label =
      txt(card.querySelector(".results-semester-badge")) ||
      txt(card.querySelector(".results-semester-title"));
    const withheld =
      card.classList.contains("results-semester-card--withheld") ||
      !!card.querySelector(".results-alert");
    const alertText = txt(card.querySelector(".results-alert"));

    const rows = card.querySelectorAll(".results-course-table tbody tr");
    const courses = [];
    rows.forEach((tr) => {
      const c = parseCourseRow(tr);
      if (c) courses.push(c);
    });

    return {
      label: label || "Semester",
      order: semesterOrder(label),
      withheld,
      alertText,
      courses,
    };
  }

  function parseStudent() {
    const chips = document.querySelectorAll(".results-hero-chips .student-page-hero__chip");
    let name = "";
    let department = "";
    chips.forEach((chip) => {
      const t = txt(chip);
      if (/department|faculty|dept/i.test(t)) department = t;
      else if (!name) name = t;
    });
    const meta = document.querySelector(".user-meta small");
    return {
      name: name || txt(document.querySelector(".user-meta strong")),
      id: txt(meta),
      department,
    };
  }

  function heroCgpa() {
    return num(
      txt(
        document.querySelector(
          ".results-hero-metric--cgpa .student-page-hero__metric-value"
        )
      )
    );
  }

  /**
   * Parse the whole page. Also teaches `scale` every observed (grade, gpa)
   * pair so downstream math matches the portal exactly.
   */
  function parse(scale) {
    const cards = document.querySelectorAll(".results-semester-card");
    const semesters = [];
    cards.forEach((card) => {
      const sem = parseSemesterCard(card);
      if (scale) {
        sem.courses.forEach((c) => {
          if (c.graded && c.gpa != null && c.credit > 0) scale.learn(c.grade, c.gpa);
        });
      }
      semesters.push(sem);
    });
    semesters.sort((a, b) => a.order - b.order);

    return {
      student: parseStudent(),
      reportedCgpa: heroCgpa(),
      semesters,
    };
  }

  NS.Parser = { parse, semesterOrder, num };
})(window);
