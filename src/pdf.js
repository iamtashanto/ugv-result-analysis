/* UGV Result Analysis — printable grade sheet.
 * Opens a clean, print-optimized window; the browser's "Save as PDF" produces
 * the downloadable sheet (no bundled PDF library, no CSP headaches).
 */
(function (root) {
  "use strict";

  const NS = (root.UGVResult = root.UGVResult || {});
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function gradeSheetHtml(model, opts) {
    const A = NS.Analysis;
    const student = model.parsed.student || {};
    const overall = A.weighted(model.courses, model.scale);
    const sems = A.semesterGpas(model);
    const printedCgpa = A.round2(overall.gpa);
    const now = new Date().toLocaleString();

    const semBlocks = model.parsed.semesters
      .map((sem, si) => {
        const g = sems.find((x) => x.label === sem.label && x.order === sem.order) || {};
        const rows = model.courses
          .filter((c) => c.semIndex === si)
          .map(
            (c) => `
            <tr>
              <td class="code">${esc(c.code)}</td>
              <td>${esc(c.title)}</td>
              <td class="num">${c.credit || "—"}</td>
              <td class="ctr">${esc(c.grade || "—")}</td>
              <td class="num">${c.letter && c.point != null ? c.point.toFixed(2) : "—"}</td>
            </tr>`
          )
          .join("");
        return `
          <section class="sem${sem.withheld ? " withheld" : ""}">
            <h3>${esc(sem.label)}${sem.withheld ? ' <span class="tag">Withheld</span>' : ""}
              <span class="gpa">GPA ${g.gpa != null ? g.gpa.toFixed(2) : "—"} · ${g.credits || 0} cr</span>
            </h3>
            <table>
              <thead><tr><th>Code</th><th>Course</th><th>Cr</th><th>Grade</th><th>GP</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </section>`;
      })
      .join("");

    return `<!doctype html><html><head><meta charset="utf-8"><title>UGV Grade Sheet — ${esc(student.name || "")}</title>
    <style>
      * { box-sizing: border-box; }
      body { font: 12px/1.5 "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 32px; }
      header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #144d9b; padding-bottom:12px; margin-bottom:16px; }
      .brand { color:#144d9b; font-size:20px; font-weight:800; letter-spacing:.5px; }
      .sub { color:#64748b; font-size:11px; }
      .who { text-align:right; }
      .who div { margin:1px 0; }
      .who .name { font-size:15px; font-weight:700; }
      .summary { display:flex; gap:24px; margin-bottom:18px; }
      .summary .box { border:1px solid #e2e8f0; border-radius:8px; padding:10px 16px; }
      .summary .box b { display:block; font-size:22px; color:#144d9b; }
      .summary .box.good b { color:#16a34a; }
      .summary .box span { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#64748b; }
      .legend { margin-top:14px; padding:8px 10px; background:#f8fafc; border:1px solid #eef2f7; border-radius:8px; font-size:9.5px; color:#475569; }
      section.sem { margin-bottom:14px; page-break-inside:avoid; }
      h3 { font-size:13px; margin:0 0 6px; display:flex; justify-content:space-between; align-items:baseline; border-left:3px solid #144d9b; padding-left:8px; }
      h3 .gpa { font-size:11px; color:#334155; font-weight:600; }
      .withheld h3 { border-left-color:#dc2626; }
      .tag { background:#fee2e2; color:#b91c1c; font-size:9px; padding:1px 6px; border-radius:6px; font-weight:700; }
      table { width:100%; border-collapse:collapse; }
      th { text-align:left; font-size:9px; text-transform:uppercase; color:#64748b; border-bottom:1px solid #cbd5e1; padding:4px 6px; }
      td { padding:4px 6px; border-bottom:1px solid #eef2f7; }
      td.code { font-weight:700; color:#1d4ed8; white-space:nowrap; }
      td.num, th:nth-child(3), th:nth-child(5) { text-align:right; }
      td.ctr, th:nth-child(4) { text-align:center; }
      footer { margin-top:20px; border-top:1px solid #e2e8f0; padding-top:8px; font-size:9px; color:#94a3b8; display:flex; justify-content:space-between; }
      @media print { body { margin:14mm; } .noprint { display:none; } }
      .noprint { text-align:center; margin-bottom:16px; }
      .noprint button { background:#144d9b; color:#fff; border:0; padding:8px 20px; border-radius:8px; font-size:13px; cursor:pointer; }
    </style></head><body>
      <div class="noprint"><button onclick="window.print()">🖨️ Save as PDF / Print</button></div>
      <header>
        <div>
          <div class="brand">UGV</div>
          <div class="sub">University of Global Village — Academic Grade Sheet</div>
        </div>
        <div class="who">
          <div class="name">${esc(student.name || "—")}</div>
          <div>${esc(student.id || "")}</div>
          <div class="sub">${esc(student.department || "")}</div>
        </div>
      </header>
      <div class="summary">
        <div class="box good"><b>${printedCgpa.toFixed(2)}</b><span>CGPA</span></div>
        <div class="box"><b>${overall.credits}</b><span>Credits earned</span></div>
        <div class="box"><b>${model.parsed.semesters.length}</b><span>Semesters</span></div>
      </div>
      ${semBlocks}
      <div class="legend"><b>Grading scale:</b> A+ 4.00 · A 3.75 · A- 3.50 · B+ 3.25 · B 3.00 · B- 2.75 · C+ 2.50 · C 2.25 · D 2.00 · F 0.00 &nbsp;|&nbsp; COMPETENT / I are non-GPA markers.</div>
      <footer><span>UGV Result Analysis · developed by <a href="https://tashanto.com" style="color:#144d9b;text-decoration:none">tashanto.com</a> — personal reference, not an official transcript.</span><span>${esc(now)}</span></footer>
    </body></html>`;
  }

  // Shared print shell used by both sheets.
  function shell(title, inner) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font: 12px/1.5 "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 32px; }
      header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #144d9b; padding-bottom:12px; margin-bottom:16px; }
      .brand { color:#144d9b; font-size:20px; font-weight:800; letter-spacing:.5px; }
      .sub { color:#64748b; font-size:11px; }
      .who { text-align:right; }
      .who .name { font-size:15px; font-weight:700; }
      .summary { display:flex; gap:16px; margin-bottom:18px; flex-wrap:wrap; }
      .summary .box { border:1px solid #e2e8f0; border-radius:8px; padding:10px 16px; min-width:96px; }
      .summary .box b { display:block; font-size:22px; color:#144d9b; }
      .summary .box.good b { color:#16a34a; }
      .summary .box span { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#64748b; }
      table { width:100%; border-collapse:collapse; margin-top:6px; }
      th { text-align:left; font-size:9px; text-transform:uppercase; color:#64748b; border-bottom:1px solid #cbd5e1; padding:6px; }
      td { padding:6px; border-bottom:1px solid #eef2f7; }
      td.code { font-weight:700; color:#1d4ed8; white-space:nowrap; }
      td.num { text-align:right; }
      td.ctr { text-align:center; }
      .badge { display:inline-block; font-weight:700; font-size:10px; padding:2px 7px; border-radius:6px; }
      .badge.warn { background:#fef3c7; color:#b45309; }
      .badge.ok { background:#dcfce7; color:#15803d; }
      .lead { background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:13px; }
      footer { margin-top:20px; border-top:1px solid #e2e8f0; padding-top:8px; font-size:9px; color:#94a3b8; display:flex; justify-content:space-between; }
      @media print { body { margin:14mm; } .noprint { display:none; } }
      .noprint { text-align:center; margin-bottom:16px; }
      .noprint button { background:#144d9b; color:#fff; border:0; padding:8px 20px; border-radius:8px; font-size:13px; cursor:pointer; }
    </style></head><body>
      <div class="noprint"><button onclick="window.print()">🖨️ Save as PDF / Print</button></div>
      ${inner}
    </body></html>`;
  }

  function planSheetHtml(model, plan) {
    const student = model.parsed.student || {};
    const now = new Date().toLocaleString();
    const rows = plan.steps
      .map(
        (s, i) => `<tr>
          <td class="ctr">${i + 1}</td>
          <td class="code">${esc(s.code)}</td>
          <td>${esc(s.title)}</td>
          <td class="ctr">${esc(s.semLabel)}</td>
          <td class="num">${s.credit}</td>
          <td class="ctr"><span class="badge warn">${esc(s.fromGrade)}</span></td>
          <td class="ctr"><span class="badge ok">${esc(s.toGrade)}</span></td>
          <td class="num">${s.cgpaAfter.toFixed(2)}</td>
        </tr>`
      )
      .join("");
    const inner = `
      <header>
        <div><div class="brand">UGV</div><div class="sub">CGPA Improvement Plan</div></div>
        <div class="who"><div class="name">${esc(student.name || "—")}</div><div>${esc(student.id || "")}</div><div class="sub">${esc(student.department || "")}</div></div>
      </header>
      <div class="summary">
        <div class="box"><b>${plan.current.toFixed(2)}</b><span>Current CGPA</span></div>
        <div class="box"><b>${Number(plan.target).toFixed(2)}</b><span>Target CGPA</span></div>
        <div class="box good"><b>${plan.resultCgpa.toFixed(2)}</b><span>After plan</span></div>
        <div class="box"><b>${plan.steps.length}</b><span>Subjects to retake</span></div>
      </div>
      <div class="lead">Improve the ${plan.steps.length} subject${plan.steps.length > 1 ? "s" : ""} below (grade retakes) to move your CGPA from <b>${plan.current.toFixed(2)}</b> to <b>${plan.resultCgpa.toFixed(2)}</b>. Subjects are ordered by impact — the running CGPA column shows your standing after each retake.</div>
      <table>
        <thead><tr><th>#</th><th>Code</th><th>Course</th><th>Semester</th><th>Cr</th><th>Now</th><th>Target</th><th>Running CGPA</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${plan.alts && plan.alts.length ? `
      <h3 style="font-size:13px;margin:18px 0 4px;border-left:3px solid #16a34a;padding-left:8px;">Other subjects worth improving</h3>
      <div class="sub" style="margin-bottom:6px;">Each row shows that single subject retaken to ${esc(plan.capGrade || "A+")} and the CGPA it would give on its own.</div>
      <table>
        <thead><tr><th>Code</th><th>Course</th><th>Now</th><th>Target</th><th>Resulting CGPA</th></tr></thead>
        <tbody>${plan.alts.map((r) => `<tr><td class="code">${esc(r.code)}</td><td>${esc(r.title)}</td><td class="ctr"><span class="badge warn">${esc(r.grade)}</span></td><td class="ctr"><span class="badge ok">${esc(r.toGrade || plan.capGrade || "A+")}</span></td><td class="num">${r.after.toFixed(2)} (+${r.gain.toFixed(2)})</td></tr>`).join("")}</tbody>
      </table>` : ""}
      <footer><span>UGV Result Analysis · developed by <a href="https://tashanto.com" style="color:#144d9b;text-decoration:none">tashanto.com</a> — planning aid only; retake rules follow your department.</span><span>${esc(now)}</span></footer>`;
    return shell(`UGV CGPA Plan — ${student.name || ""}`, inner);
  }

  function openWith(html) {
    const w = window.open("", "_blank");
    if (!w) {
      alert("Popup blocked — allow popups for this site to export.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function openGradeSheet(model, opts) {
    openWith(gradeSheetHtml(model, opts));
  }
  function openPlanSheet(model, plan) {
    if (!plan || !plan.steps || !plan.steps.length) return;
    openWith(planSheetHtml(model, plan));
  }

  NS.Pdf = { openGradeSheet, openPlanSheet, gradeSheetHtml, planSheetHtml };
})(window);
