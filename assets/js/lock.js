/* Catatan Belajar ERP YonSuite — site-wide login gate (personal use)
 *
 * This is a client-side deterrent, not real security: the repo backing this
 * GitHub Pages site is public, so anyone who knows/guesses a direct file URL
 * (e.g. .../content/purchasing.md) or browses the repo on github.com can
 * still read the raw content — this only stops casual visitors who land on
 * the site itself. ID+password are combined and SHA-256 hashed so the
 * plaintext credentials aren't sitting in the repo source.
 */
window.YSLock = (function () {
  "use strict";

  const UNLOCK_KEY = "ys-site-unlocked";
  const LOGIN_HASH = "a29124701b30333d507da062e8249988b3e8832222f0f3bb0d6d0da846921d34";

  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function isUnlocked() {
    return localStorage.getItem(UNLOCK_KEY) === "1";
  }

  function setUnlocked() {
    localStorage.setItem(UNLOCK_KEY, "1");
    document.documentElement.setAttribute("data-unlocked", "1");
    document.dispatchEvent(new CustomEvent("ys:unlocked"));
  }

  function wireForm() {
    const $form = document.getElementById("lockForm");
    const $id = document.getElementById("lockId");
    const $pw = document.getElementById("lockPw");
    const $err = document.getElementById("lockErr");
    if (!$form) return;
    $form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const combined = `${($id.value || "").trim()}:${$pw.value || ""}`;
      const hash = await sha256Hex(combined);
      if (hash !== LOGIN_HASH) {
        $err.textContent = "ID atau password salah.";
        $pw.value = "";
        $pw.focus();
        return;
      }
      $err.textContent = "";
      setUnlocked();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireForm);
  } else {
    wireForm();
  }

  return { isUnlocked };
})();
