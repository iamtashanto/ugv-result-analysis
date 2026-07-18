/* UGV Result Analysis — injected panel UI (vanilla DOM). */
(function (root) {
  "use strict";

  const NS = (root.UGVResult = root.UGVResult || {});
  const A = () => NS.Analysis;
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => (n == null || isNaN(n) ? "—" : Number(n).toFixed(2));

  // ---- SVG trend chart of semester GPAs ---------------------------------
  function trendChart(points) {
    const W = 520, H = 180, pad = 34;
    const max = 4, min = 0;
    const xs = (i) => pad + (i * (W - pad * 2)) / Math.max(1, points.length - 1);
    const ys = (v) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
    const grid = [0, 1, 2, 3, 4]
      .map((g) => `<line x1="${pad}" y1="${ys(g)}" x2="${W - pad}" y2="${ys(g)}" class="ug-grid"/><text x="${pad - 6}" y="${ys(g) + 3}" class="ug-axis">${g}</text>`)
      .join("");
    const path = points.map((p, i) => `${i ? "L" : "M"}${xs(i)},${ys(p.gpa)}`).join(" ");
    const dots = points
      .map((p, i) => `<circle cx="${xs(i)}" cy="${ys(p.gpa)}" r="4" class="ug-dot${p.withheld ? " ug-dot--warn" : ""}"><title>${esc(p.label)}: ${fmt(p.gpa)}</title></circle><text x="${xs(i)}" y="${H - pad + 16}" class="ug-axis ug-axis--x">${esc(String(p.label).replace(/semester/i, "").trim())}</text>`)
      .join("");
    return `<svg viewBox="0 0 ${W} ${H}" class="ug-chart" preserveAspectRatio="xMidYMid meet">${grid}<path d="${path}" class="ug-line"/>${dots}</svg>`;
  }

  function mount(model) {
    document.getElementById("ug-panel")?.remove();
    document.getElementById("ug-fab")?.remove();

    const overrides = {};
    let lastPlan = null; // most recent feasible target plan, for PDF export

    // Floating launcher
    const fab = el("button", "ug-fab", '<i class="bi bi-graph-up-arrow"></i> Analyze');
    fab.id = "ug-fab";
    fab.title = "UGV Result Analysis";
    document.body.appendChild(fab);

    // Panel shell
    const panel = el("aside", "ug-panel");
    panel.id = "ug-panel";
    panel.innerHTML = `
      <div class="ug-resize" data-resize title="Drag to resize · double-click to expand"></div>
      <header class="ug-head">
        <div><strong>Result Analysis</strong><span class="ug-sub">${esc(model.parsed.student.name || "")}</span></div>
        <div class="ug-head-actions">
          <button class="ug-btn ug-btn--csv" data-act="csv" title="Export CSV"><i class="bi bi-filetype-csv"></i></button>
          <button class="ug-btn ug-btn--pdf" data-act="pdf"><i class="bi bi-file-earmark-pdf"></i> PDF</button>
          <button class="ug-icon" data-act="close" aria-label="Close">&times;</button>
        </div>
      </header>
      <nav class="ug-tabs">
        <button class="ug-tab is-active" data-tab="trend">Trend</button>
        <button class="ug-tab" data-tab="whatif">What-If</button>
        <button class="ug-tab" data-tab="target">Target</button>
        <button class="ug-tab" data-tab="forecast">Forecast</button>
      </nav>
      <div class="ug-body">
        <section class="ug-view" data-view="trend"></section>
        <section class="ug-view" data-view="whatif" hidden></section>
        <section class="ug-view" data-view="target" hidden></section>
        <section class="ug-view" data-view="forecast" hidden></section>
      </div>
      <footer class="ug-credit">Developed by <a href="https://tashanto.com" target="_blank" rel="noopener">Shanto · tashanto.com</a></footer>`;
    document.body.appendChild(panel);

    // Follow the portal's own light/dark theme (body.dark), live.
    const syncTheme = () => {
      const dark = document.body.classList.contains("dark");
      panel.classList.toggle("ug-dark", dark);
      fab.classList.toggle("ug-dark", dark);
    };
    syncTheme();
    const themeObs = new MutationObserver(syncTheme);
    themeObs.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    const q = (s) => panel.querySelector(s);
    const open = () => panel.classList.add("is-open");
    const close = () => panel.classList.remove("is-open");
    fab.addEventListener("click", open);

    // --- Resizable width (drag the left edge; double-click to expand) -----
    const MINW = 340;
    const maxW = () => Math.round(window.innerWidth * 0.95);
    let savedW = parseInt(localStorage.getItem("ugv:panelW") || "0", 10);
    if (savedW >= MINW) panel.style.width = Math.min(savedW, maxW()) + "px";
    const setW = (w) => {
      const clamped = Math.max(MINW, Math.min(w, maxW()));
      panel.style.width = clamped + "px";
      localStorage.setItem("ugv:panelW", String(clamped));
    };
    const handle = q("[data-resize]");
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      panel.classList.add("ug-resizing");
      const move = (ev) => setW(window.innerWidth - ev.clientX);
      const up = () => {
        panel.classList.remove("ug-resizing");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
    handle.addEventListener("dblclick", () => {
      const cur = panel.getBoundingClientRect().width;
      setW(cur < maxW() - 40 ? maxW() : 440);
    });

    panel.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "close") return close();
      if (act === "pdf") return NS.Pdf.openGradeSheet(model);
      if (act === "csv") return downloadCsv();
      if (act === "planpdf") return lastPlan && NS.Pdf.openPlanSheet(model, lastPlan);
      const tab = e.target.closest("[data-tab]")?.dataset.tab;
      if (tab) {
        panel.querySelectorAll(".ug-tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === tab));
        panel.querySelectorAll(".ug-view").forEach((v) => (v.hidden = v.dataset.view !== tab));
      }
    });

    renderTrend();
    renderWhatIf();
    renderTarget();
    renderForecast();

    function downloadCsv() {
      const csv = A().toCsv(model);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const who = (model.parsed.student.id || model.parsed.student.name || "results").replace(/\s+/g, "_");
      a.download = `ugv_results_${who}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    // ---- Trend view -----------------------------------------------------
    function renderTrend() {
      const sems = A().semesterGpas(model, overrides).filter((s) => s.credits > 0);
      const overall = A().weighted(model.courses, model.scale, overrides);
      const recs = A().recommendations(model).slice(0, 5);
      const reported = model.parsed.reportedCgpa;
      const view = q('[data-view="trend"]');
      view.innerHTML = `
        <div class="ug-stats">
          <div class="ug-stat"><span>CGPA</span><b>${fmt(overall.gpa)}</b></div>
          <div class="ug-stat"><span>Credits</span><b>${overall.credits}</b></div>
          <div class="ug-stat"><span>Semesters</span><b>${sems.length}</b></div>
        </div>
        ${reported != null && Math.abs(reported - overall.gpa) > 0.01 ? `<p class="ug-note">Portal shows <b>${fmt(reported)}</b>; computed <b>${fmt(overall.gpa)}</b> — small gaps come from ungraded/withheld courses.</p>` : ""}
        <div class="ug-card">${trendChart(sems)}</div>
        <h4 class="ug-h4">Best subjects to improve <small>(highest CGPA lift)</small></h4>
        <ul class="ug-recs">${recs.map((r) => `<li><span class="ug-code">${esc(r.code)}</span><span class="ug-recname">${esc(r.title)}</span><span class="ug-badge ug-badge--warn">${esc(r.grade)}</span><span class="ug-lift">+${(r.roi).toFixed(3)}</span></li>`).join("") || "<li class=\"ug-empty\">No improvable graded subjects 🎉</li>"}</ul>
        ${gradeDistHtml()}`;
    }

    function gradeDistHtml() {
      const dist = A().gradeDistribution(model);
      if (!dist.length) return "";
      const max = Math.max(...dist.map((d) => d.count));
      const cls = (g) => (["A+", "A", "A-"].includes(g) ? "ok" : ["F", "D"].includes(g) ? "bad" : "mid");
      return `<h4 class="ug-h4">Grade distribution</h4>
        <div class="ug-dist">${dist.map((d) => `<div class="ug-distrow"><span class="ug-distg ug-distg--${cls(d.grade)}">${esc(d.grade)}</span><span class="ug-distbar"><i style="width:${(d.count / max) * 100}%"></i></span><span class="ug-distn">${d.count}</span></div>`).join("")}</div>`;
    }

    // ---- What-If view ---------------------------------------------------
    function renderWhatIf() {
      const view = q('[data-view="whatif"]');
      const grades = model.scale.letterGrades();

      // Grade cell: an editable dropdown for standard letter grades, or a
      // locked chip for pass/fail markers (COMPETENT, I) and blanks.
      const gradeCell = (c) => {
        if (c.letter) {
          const opts = grades
            .map((g) => `<option value="${g}"${g === model.scale.normalizeLetter(c.grade) ? " selected" : ""}>${g}</option>`)
            .join("");
          return `<select class="ug-select" data-id="${c.id}">${opts}</select>`;
        }
        return `<span class="ug-lock" title="Not a standard graded course">${esc(c.grade || "—")}</span>`;
      };

      // Rows grouped under a per-semester header.
      const rows = model.parsed.semesters
        .map((sem, si) => {
          const semCourses = model.courses.filter((c) => c.semIndex === si && c.credit > 0);
          if (!semCourses.length) return "";
          const head = `<tr class="ug-semrow" data-sem="${si}"><td colspan="4"><span>${esc(sem.label)}${sem.withheld ? ' <span class="ug-lock ug-lock--warn">Withheld</span>' : ""}</span><span class="ug-semgpa" data-semgpa="${si}"></span></td></tr>`;
          const body = semCourses
            .map(
              (c) => `<tr data-id="${c.id}" data-sem="${si}">
                <td class="ug-code">${esc(c.code)}</td>
                <td class="ug-tt" title="${esc(c.title)}">${esc(c.title)}</td>
                <td class="ug-num">${c.credit}</td>
                <td>${gradeCell(c)}</td>
              </tr>`
            )
            .join("");
          return head + body;
        })
        .join("");
      view.innerHTML = `
        <div class="ug-live">
          <div class="ug-stat ug-stat--live"><span>Simulated CGPA</span><b data-live="cgpa">—</b></div>
          <div class="ug-delta" data-live="delta"></div>
          <button class="ug-btn ug-btn--ghost" data-reset>Reset</button>
        </div>
        <div class="ug-search"><i class="bi bi-search"></i><input type="search" placeholder="Search code or subject…" data-search></div>
        <div class="ug-tablewrap"><table class="ug-table"><thead><tr><th>Code</th><th>Course</th><th>Cr</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table></div>`;

      const search = view.querySelector("[data-search]");
      search.addEventListener("input", () => {
        const term = search.value.trim().toLowerCase();
        const shown = {};
        view.querySelectorAll("tbody tr[data-id]").forEach((tr) => {
          const c = model.courses.find((x) => x.id === tr.dataset.id);
          const hit = !term || (c.code + " " + c.title).toLowerCase().includes(term);
          tr.hidden = !hit;
          if (hit) shown[tr.dataset.sem] = true;
        });
        // Hide a semester header when none of its courses match.
        view.querySelectorAll("tr.ug-semrow").forEach((tr) => {
          tr.hidden = !!term && !shown[tr.dataset.sem];
        });
      });

      const baseCgpa = A().cgpa(model);
      const baseSem = {};
      A().semesterGpas(model).forEach((s) => (baseSem[s.index] = s.gpa));
      const recompute = () => {
        const now = A().cgpa(model, overrides);
        q('[data-live="cgpa"]').textContent = fmt(now);
        const d = now - baseCgpa;
        const dEl = q('[data-live="delta"]');
        dEl.textContent = (d >= 0 ? "▲ +" : "▼ ") + d.toFixed(2);
        dEl.className = "ug-delta " + (Math.abs(d) < 0.005 ? "" : d > 0 ? "up" : "down");
        // Live per-semester GPA in each header row: "GPA 3.11" normally, and
        // "GPA 3.11 → 3.25" (coloured) when that semester has a simulated change.
        A().semesterGpas(model, overrides).forEach((s) => {
          const cell = view.querySelector(`[data-semgpa="${s.index}"]`);
          if (!cell) return;
          const base = baseSem[s.index];
          if (Math.abs(s.gpa - base) > 0.005) {
            const up = s.gpa > base;
            cell.innerHTML = `GPA ${fmt(base)} <b class="${up ? "ug-up" : "ug-down"}">→ ${fmt(s.gpa)}</b>`;
          } else {
            cell.innerHTML = `GPA <b>${fmt(s.gpa)}</b>`;
          }
        });
        renderTrend();
      };
      view.querySelectorAll(".ug-select").forEach((sel) => {
        sel.addEventListener("change", () => {
          const c = model.courses.find((x) => x.id === sel.dataset.id);
          if (sel.value === model.scale.normalizeLetter(c.grade)) delete overrides[sel.dataset.id];
          else overrides[sel.dataset.id] = sel.value;
          sel.classList.toggle("is-changed", !!overrides[sel.dataset.id]);
          recompute();
        });
      });
      view.querySelector("[data-reset]").addEventListener("click", () => {
        Object.keys(overrides).forEach((k) => delete overrides[k]);
        view.querySelectorAll(".ug-select").forEach((sel) => {
          const c = model.courses.find((x) => x.id === sel.dataset.id);
          sel.value = model.scale.normalizeLetter(c.grade);
          sel.classList.remove("is-changed");
        });
        recompute();
      });
      recompute();
    }

    // ---- Target view ----------------------------------------------------
    function renderTarget() {
      const view = q('[data-view="target"]');
      const cur = A().cgpa(model);
      const pot3 = A().improveTop(model, 3, "A+");
      const presets = [3.0, 3.25, 3.5, 3.75].filter((p) => p > cur + 0.001);
      view.innerHTML = `
        <div class="ug-targetbar">
          <label>Target CGPA</label>
          <input type="number" class="ug-input" min="0" max="4" step="0.01" value="${(Math.min(4, cur + 0.2)).toFixed(2)}" data-target>
          <button class="ug-btn" data-plan>Plan</button>
        </div>
        ${presets.length ? `<div class="ug-presets">${presets.map((p) => `<button class="ug-chip" data-preset="${p}">${p.toFixed(2)}</button>`).join("")}</div>` : ""}
        <p class="ug-note">Current CGPA <b>${fmt(cur)}</b>. The planner shows the exact grade you need in each subject (the <em>minimum</em> that reaches your goal).</p>
        ${pot3.courses.length ? `<div class="ug-pot"><i class="bi bi-stars"></i> Improving your weakest <b>${pot3.courses.length}</b> subject${pot3.courses.length > 1 ? "s" : ""} to A+ could lift CGPA to <b>${fmt(pot3.cgpa)}</b> <span class="ug-lift">(+${pot3.gain.toFixed(2)})</span>.</div>` : ""}
        <div data-planout></div>`;

      const run = () => {
        const t = parseFloat(view.querySelector("[data-target]").value);
        const out = view.querySelector("[data-planout]");
        lastPlan = null;
        if (isNaN(t)) { out.innerHTML = ""; return; }
        const plan = A().planForTarget(model, t);
        if (plan.alreadyMet) {
          out.innerHTML = `<div class="ug-ok">✅ Already at or above ${t.toFixed(2)} (current ${fmt(plan.current)}). Aim higher!</div>`;
          return;
        }
        if (!plan.feasible) {
          out.innerHTML = `<div class="ug-bad">⚠️ ${t.toFixed(2)} isn't reachable by improving existing subjects. Max reachable is <b>${fmt(plan.maxReachable)}</b> (all subjects → A+).</div>`;
          return;
        }
        lastPlan = plan;
        // Subjects NOT used in this plan but still improvable — swap-in options.
        const usedCodes = new Set(plan.steps.map((s) => s.code));
        const alts = A().recommendations(model).filter((r) => !usedCodes.has(r.code)).slice(0, 3);
        out.innerHTML = `
          <div class="ug-ok">Reach <b>${fmt(plan.resultCgpa)}</b> by improving these ${plan.steps.length} subject${plan.steps.length > 1 ? "s" : ""} — get at least the grade shown:</div>
          <ol class="ug-steps">${plan.steps.map((s) => `<li><span class="ug-code">${esc(s.code)}</span><span class="ug-recname">${esc(s.title)} <em>${esc(s.semLabel)}</em></span><span class="ug-move"><b class="ug-badge ug-badge--warn">${esc(s.fromGrade)}</b> <i class="bi bi-arrow-right"></i> <b class="ug-badge ug-badge--ok">Get ${esc(s.toGrade)}</b></span><span class="ug-lift">${fmt(s.cgpaAfter)}</span></li>`).join("")}</ol>
          ${alts.length ? `<div class="ug-alts"><span class="ug-alts__title">Or swap in one of these instead:</span>${alts.map((r) => `<span class="ug-alt"><b class="ug-code">${esc(r.code)}</b> ${esc(r.title)} <b class="ug-badge ug-badge--warn">${esc(r.grade)}</b></span>`).join("")}</div>` : ""}
          <button class="ug-btn ug-btn--pdf ug-w100" data-act="planpdf"><i class="bi bi-file-earmark-pdf"></i> Export this plan as PDF</button>`;
      };
      view.querySelector("[data-plan]").addEventListener("click", run);
      view.querySelector("[data-target]").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
      view.querySelectorAll("[data-preset]").forEach((b) =>
        b.addEventListener("click", () => {
          view.querySelector("[data-target]").value = b.dataset.preset;
          run();
        }));
      run();
    }

    // ---- Forecast view: safe/target/reach + next-semester GPA needed -----
    function renderForecast() {
      const view = q('[data-view="forecast"]');
      const ungraded = A().ungradedCourses(model);
      const cur = A().cgpa(model);

      // Three named scenarios for the in-progress subjects.
      const SCEN = [
        { key: "safe", label: "Safe", grade: "C", hint: "just passing" },
        { key: "target", label: "Target", grade: "B+", hint: "solid" },
        { key: "reach", label: "Reach", grade: "A+", hint: "all-out" },
      ];
      const scenHtml = ungraded.length
        ? `<h4 class="ug-h4">If you finish the ${ungraded.length} in-progress subject${ungraded.length > 1 ? "s" : ""} with…</h4>
           <div class="ug-scen">${SCEN.map((s) => {
             const r = A().scenario(model, s.grade);
             return `<div class="ug-scencard ug-scencard--${s.key}"><span class="ug-scenlabel">${s.label}</span><span class="ug-scengrade">all ${esc(s.grade)}</span><b class="ug-scencgpa">${fmt(r.cgpa)}</b><span class="ug-scenhint">${s.hint}</span></div>`;
           }).join("")}</div>
           <p class="ug-note">${ungraded.map((c) => esc(c.code)).join(", ")} — ${ungraded.reduce((s, c) => s + c.credit, 0)} credits pending.</p>`
        : `<div class="ug-ok">✅ No in-progress subjects — every graded course is final.</div>`;

      // Next-semester projector.
      view.innerHTML = `
        ${scenHtml}
        <h4 class="ug-h4">GPA needed next semester</h4>
        <div class="ug-targetbar">
          <label>Goal CGPA</label>
          <input type="number" class="ug-input" min="0" max="4" step="0.01" value="${(Math.min(4, cur + 0.15)).toFixed(2)}" data-fgoal>
          <label>Credits</label>
          <input type="number" class="ug-input ug-input--sm" min="1" max="30" step="1" value="15" data-fcred>
          <button class="ug-btn" data-fcalc>Calc</button>
        </div>
        <div data-fout></div>`;

      const calc = () => {
        const goal = parseFloat(view.querySelector("[data-fgoal]").value);
        const cred = parseFloat(view.querySelector("[data-fcred]").value);
        const out = view.querySelector("[data-fout]");
        if (isNaN(goal) || isNaN(cred)) { out.innerHTML = ""; return; }
        const r = A().requiredNextGpa(model, goal, cred);
        if (r.requiredGpa != null && r.requiredGpa <= 0) {
          out.innerHTML = `<div class="ug-ok">You're already past ${goal.toFixed(2)} — any passing semester keeps you there.</div>`;
        } else if (!r.feasible) {
          out.innerHTML = `<div class="ug-bad">⚠️ Needs a <b>${fmt(r.requiredGpa)}</b> GPA over ${cred} credits — above 4.00, so not possible in one semester. Spread it over more credits or lower the goal.</div>`;
        } else {
          out.innerHTML = `<div class="ug-ok">Score at least <b>${fmt(r.requiredGpa)}</b> GPA across ${cred} credits next semester to reach a <b>${goal.toFixed(2)}</b> CGPA.</div>`;
        }
      };
      view.querySelector("[data-fcalc]").addEventListener("click", calc);
      view.querySelectorAll("[data-fgoal],[data-fcred]").forEach((i) =>
        i.addEventListener("keydown", (e) => { if (e.key === "Enter") calc(); }));
      calc();
    }
  }

  NS.UI = { mount };
})(window);
