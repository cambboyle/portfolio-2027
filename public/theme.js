// Runs before the page paints, so a theme picked on an earlier visit shows straight away with no flash.
// (Without a saved choice the CSS follows the device's light or dark setting by itself.)
try {
  var t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}
