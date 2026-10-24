(function (root) {
  "use strict";
  function off() {
    try {
      if (root.localStorage && root.localStorage.getItem("DAWN_TOWN_OFF") === "1") return true;
    } catch (_) {}
    try {
      var q = new URLSearchParams(root.location.search);
      if (q.get("dawn_town_off") === "1" || q.get("DAWN_TOWN_OFF") === "1") return true;
    } catch (_) {}
    return false;
  }
  root.DawnTown = root.DawnTown || {};
  root.DawnTown.off = off;
  root.DawnTown.status = "PLAN_SCAFFOLD_NOT_AVAILABLE";
})(typeof window !== "undefined" ? window : globalThis);
