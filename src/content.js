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
    root.__ugvResultModel = model;
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    if (init() || ++tries > 20) clearInterval(timer);
  }, 300);
})(window);
