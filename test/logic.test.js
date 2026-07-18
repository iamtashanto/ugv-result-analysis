/* Node smoke test for the pure math (no DOM).
 * Run: node test/logic.test.js
 */
const fs = require("fs");
const path = require("path");

// The source files are browser IIFEs that attach to `window`. Expose one.
global.window = global;
["gradeScale", "parser", "analysis"].forEach((f) => {
  const code = fs.readFileSync(path.join(__dirname, "..", "src", f + ".js"), "utf8");
  eval(code); // eslint-disable-line no-eval
});

const { GradeScale, Analysis } = window.UGVResult;

let pass = 0, fail = 0;
function eq(name, got, want, tol = 0.005) {
  const ok = typeof want === "number" ? Math.abs(got - want) <= tol : got === want;
  console.log(`${ok ? "✅" : "❌"} ${name} => got ${got}${ok ? "" : `, want ${want}`}`);
  ok ? pass++ : fail++;
}

// --- Build a scale and learn from observed (grade, gpa) pairs -------------
const scale = GradeScale.createScale();
[["A+", 4.0], ["B", 3.0], ["C", 2.25], ["F", 0.0], ["D", 2.0]].forEach(([g, p]) => scale.learn(g, p));
eq("scale learns B", scale.pointFor("B"), 3.0);
eq("scale falls back A-", scale.pointFor("A-"), 3.5);
eq("scale unknown grade", scale.pointFor("W"), null);

// --- Fabricated 2-semester model -----------------------------------------
const parsed = {
  student: { name: "Test", id: "1", department: "CSE" },
  reportedCgpa: null,
  semesters: [
    {
      label: "1st", order: 1, withheld: false, courses: [
        { code: "CSE101", title: "Intro", credit: 3, grade: "B", gpa: 3.0, graded: true },
        { code: "MAT101", title: "Calc", credit: 3, grade: "C", gpa: 2.25, graded: true },
      ],
    },
    {
      label: "2nd", order: 2, withheld: false, courses: [
        { code: "CSE102", title: "OOP", credit: 3, grade: "A+", gpa: 4.0, graded: true },
        { code: "PHY101", title: "Physics", credit: 2, grade: "F", gpa: 0.0, graded: true },
        { code: "ENG101", title: "English", credit: 3, grade: "", gpa: null, graded: false }, // in progress
      ],
    },
  ],
};

const model = Analysis.buildModel(parsed, scale);

// CGPA = (3*3 + 3*2.25 + 3*4 + 2*0) / (3+3+3+2) = (9+6.75+12+0)/11 = 27.75/11
eq("weighted credits (excludes ungraded)", Analysis.weighted(model.courses, scale).credits, 11);
eq("CGPA", Analysis.cgpa(model), 27.75 / 11); // 2.5227

// Per-semester GPA
const sems = Analysis.semesterGpas(model);
eq("sem1 GPA", sems[0].gpa, (9 + 6.75) / 6); // 2.625
eq("sem2 GPA", sems[1].gpa, 12 / 5); // 2.40 (F counted, ungraded excluded)

// What-if: fix the F -> B ; new CGPA
const wi = Analysis.cgpa(model, { "1:1": "B" }); // PHY101 F->B (+2*3=6 pts)
eq("what-if F->B", wi, (27.75 + 6) / 11); // 3.0682

// Recommendations: PHY101 (F, credit 2) should top the ROI list
const recs = Analysis.recommendations(model);
eq("top rec is the F subject", recs[0].code, "PHY101");

// Target planner: reach 3.0 from ~2.52
const plan = Analysis.planForTarget(model, 3.0);
eq("plan feasible for 3.0", plan.feasible, true);
eq("plan reaches >= 3.0", plan.resultCgpa >= 3.0, true);
console.log("   plan steps:", plan.steps.map((s) => `${s.code} ${s.fromGrade}->${s.toGrade}`).join(", "));

// 4.0 is exactly reachable here (every graded course can become A+)
const perfect = Analysis.planForTarget(model, 4.0);
eq("plan feasible for 4.0", perfect.feasible, true);
eq("maxReachable is 4.0", perfect.maxReachable, 4.0);

// Above the ceiling -> infeasible
const bad = Analysis.planForTarget(model, 4.2);
eq("plan infeasible for 4.2", bad.feasible, false);
eq("maxReachable reported", bad.maxReachable, 4.0);

// --- New features --------------------------------------------------------
// Scenario: the one ungraded course (ENG101, 3cr) earns A+
// base points 27.75, credits 11 -> +3*4=12 pts, +3 cr => 39.75/14
eq("scenario reach (all A+)", Analysis.scenario(model, "A+").cgpa, Analysis.round2(39.75 / 14));
eq("scenario safe (all C)", Analysis.scenario(model, "C").cgpa, Analysis.round2((27.75 + 3 * 2.25) / 14));

// Grade distribution: 5 graded courses (B, C, A+, F) -> 4 distinct grades
const dist = Analysis.gradeDistribution(model);
eq("distribution distinct grades", dist.length, 4);
eq("distribution best first is A+", dist[0].grade, "A+");

// Next-semester GPA needed: goal 2.8 over 15 credits
// need (2.8*(11+15) - 27.75)/15 = (72.8 - 27.75)/15 = 45.05/15 = 3.003
const req = Analysis.requiredNextGpa(model, 2.8, 15);
eq("required next GPA", req.requiredGpa, Analysis.round2(45.05 / 15));
eq("required next GPA feasible", req.feasible, true);

// CSV contains header + a data row
const csv = Analysis.toCsv(model);
eq("csv has header", csv.startsWith("Semester,Code,Title,Credit,Grade,GradePoint"), true);
eq("csv mentions CGPA", /CGPA/.test(csv), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
