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
              <td class="num">${c.graded && c.gpa != null ? c.gpa.toFixed(2) : "—"}</td>
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
      .summary .box span { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#64748b; }
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
        <div class="box"><b>${printedCgpa.toFixed(2)}</b><span>CGPA</span></div>
        <div class="box"><b>${overall.credits}</b><span>Credits earned</span></div>
        <div class="box"><b>${model.parsed.semesters.length}</b><span>Semesters</span></div>
      </div>
      ${semBlocks}
      <footer><span>Generated by UGV Result Analysis</span><span>${esc(now)}</span></footer>
    </body></html>`;
  }

  function openGradeSheet(model, opts) {
    const w = window.open("", "_blank");
    if (!w) {
      alert("Popup blocked — allow popups for this site to export the grade sheet.");
      return;
    }
    w.document.open();
    w.document.write(gradeSheetHtml(model, opts));
    w.document.close();
  }

  NS.Pdf = { openGradeSheet, gradeSheetHtml };
})(window);
