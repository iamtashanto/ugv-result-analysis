/* UGV Result Analysis — content entry point.
 * Waits for the results DOM, learns the grade scale, builds the model and
 * mounts the analysis panel.
 */
(function (root) {
  "use strict";

  const NS = root.UGVResult;

  function init() {
    if (!document.querySelector(".results-semester-card")) return false;
    const scale = NS.GradeScale.createScale();
    const parsed = NS.Parser.parse(scale);
    if (!parsed.semesters.length) return false;
    const model = NS.Analysis.buildModel(parsed, scale);
    NS.UI.mount(model);
    root.__ugvResultModel = model; // handy for debugging / popup
    return true;
  }

  // The page may hydrate slightly after document_idle; retry briefly.
  let tries = 0;
  const timer = setInterval(() => {
    if (init() || ++tries > 20) clearInterval(timer);
  }, 300);
})(window);
