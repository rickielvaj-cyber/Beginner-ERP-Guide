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
  const UNLOCK_TS_KEY = "ys-site-unlocked-at";
  const LOGIN_HASH = "a29124701b30333d507da062e8249988b3e8832222f0f3bb0d6d0da846921d34";
  // Login session expires after this long — "login hari ini, besok relog
  // lagi" — so it's re-checked on every load, not a one-time unlock.
  const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function clearUnlocked() {
    localStorage.removeItem(UNLOCK_KEY);
    localStorage.removeItem(UNLOCK_TS_KEY);
    document.documentElement.removeAttribute("data-unlocked");
  }

  function isUnlocked() {
    if (localStorage.getItem(UNLOCK_KEY) !== "1") return false;
    const ts = Number(localStorage.getItem(UNLOCK_TS_KEY) || 0);
    if (!ts || Date.now() - ts > SESSION_TTL_MS) {
      clearUnlocked();
      return false;
    }
    return true;
  }

  function setUnlocked() {
    localStorage.setItem(UNLOCK_KEY, "1");
    localStorage.setItem(UNLOCK_TS_KEY, String(Date.now()));
    document.documentElement.setAttribute("data-unlocked", "1");
    document.dispatchEvent(new CustomEvent("ys:unlocked"));
  }

  function logout() {
    clearUnlocked();
    location.reload();
  }

  // Belt-and-suspenders: if the tab is just left open past the TTL (no
  // reload/navigation), still boot it back to the lock screen instead of
  // waiting for the next visit.
  setInterval(() => {
    if (localStorage.getItem(UNLOCK_KEY) === "1" && !isUnlocked()) {
      location.reload();
    }
  }, 5 * 60 * 1000);

  function wireForm() {
    const $form = document.getElementById("lockForm");
    const $id = document.getElementById("lockId");
    const $pw = document.getElementById("lockPw");
    const $err = document.getElementById("lockErr");
    if ($form) {
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
    const $logout = document.getElementById("logoutBtn");
    if ($logout) $logout.addEventListener("click", logout);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireForm);
  } else {
    wireForm();
  }

  return { isUnlocked, logout };
})();
