/* Catatan Belajar ERP YonSuite — in-browser editor (GitHub-backed, personal use)
 *
 * How it works: a GitHub fine-grained Personal Access Token (scoped to just
 * this repo, Contents: Read & write) is stored in this browser's
 * localStorage and used to call the GitHub Contents API directly from the
 * client (no backend). A password set on first setup gates the "Edit"
 * button on this device — it's a local deterrent, not real security; the
 * token is the actual authorization boundary. Nobody else can save changes
 * without both a valid token AND write access to the repo.
 */
window.YSEditor = (function () {
  "use strict";

  const TOKEN_KEY = "ys-gh-token";
  const PW_HASH_KEY = "ys-editor-pw-hash";
  const REPO_OWNER = "rickielvaj-cyber";
  const REPO_NAME = "Beginner-ERP-Guide";
  const BRANCH = "claude/yonsuite-erp-learning-site-9k37bq";
  const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

  // -----------------------------------------------------------------------
  // utils
  // -----------------------------------------------------------------------
  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }
  function utf8ToBase64(str) {
    return bytesToBase64(new TextEncoder().encode(str));
  }
  function base64ToUtf8(b64) {
    const binary = atob(b64.replace(/\n/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function esc(s) { return window.YSApp ? window.YSApp.escapeHtml(s) : String(s); }

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function hasSetup() { return !!getToken() && !!localStorage.getItem(PW_HASH_KEY); }

  // -----------------------------------------------------------------------
  // GitHub API
  // -----------------------------------------------------------------------
  async function ghRequest(path, options) {
    const res = await fetch(`${API_BASE}${path}`, Object.assign({}, options, {
      headers: Object.assign({
        "Authorization": `Bearer ${getToken()}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      }, (options && options.headers) || {}),
    }));
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).message; } catch (e) { /* ignore */ }
      const err = new Error(`${res.status} ${detail || res.statusText}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  function contentsPath(path) {
    return "/contents/" + path.split("/").map(encodeURIComponent).join("/");
  }

  async function ghGetFile(path) {
    try {
      return await ghRequest(`${contentsPath(path)}?ref=${BRANCH}`);
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async function ghPutFile(path, base64Content, sha, message) {
    return ghRequest(contentsPath(path), {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: base64Content,
        sha: sha || undefined,
        branch: BRANCH,
      }),
    });
  }

  // -----------------------------------------------------------------------
  // state
  // -----------------------------------------------------------------------
  let currentSlug = null;
  let currentIsIssueLog = false;

  function titleForSlug(slug) {
    const manifest = window.YSApp && window.YSApp.manifest;
    if (!manifest) return slug;
    if (manifest.issueLog.slug === slug) return manifest.issueLog.title;
    const m = manifest.modules.find((x) => x.slug === slug);
    return m ? m.title : slug;
  }

  // -----------------------------------------------------------------------
  // overlay/modal shell
  // -----------------------------------------------------------------------
  function ensureOverlay() {
    let el = document.getElementById("ysEditorOverlay");
    if (!el) {
      el = document.createElement("div");
      el.id = "ysEditorOverlay";
      el.className = "ys-editor-overlay";
      document.body.appendChild(el);
      el.addEventListener("mousedown", (e) => { if (e.target === el) closeOverlay(); });
    }
    return el;
  }
  function closeOverlay() {
    const el = document.getElementById("ysEditorOverlay");
    if (el) { el.classList.remove("open"); el.innerHTML = ""; }
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOverlay();
  });

  // -----------------------------------------------------------------------
  // "Edit" button injection
  // -----------------------------------------------------------------------
  function mount() {
    document.querySelectorAll(".doc-edit-slot").forEach((slot) => {
      if (slot.dataset.mounted) return;
      slot.dataset.mounted = "1";
      const slug = slot.dataset.slug;
      const btn = document.createElement("button");
      btn.className = "doc-edit-btn";
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg><span>Edit</span>';
      btn.addEventListener("click", () => handleEditClick(slug));
      slot.appendChild(btn);
    });
  }

  function handleEditClick(slug) {
    if (!hasSetup()) { renderSetupModal(slug, false); return; }
    renderPasswordModal(slug);
  }

  // -----------------------------------------------------------------------
  // password gate
  // -----------------------------------------------------------------------
  function renderPasswordModal(slug) {
    const overlay = ensureOverlay();
    overlay.innerHTML = `
      <div class="ys-editor-modal ys-editor-modal-sm">
        <h3>Masuk sebagai editor</h3>
        <p class="ys-editor-hint">Masukkan password editor buat edit "${esc(titleForSlug(slug))}".</p>
        <input type="password" id="ysEditorPw" class="ys-editor-input" placeholder="Password" autocomplete="current-password">
        <p class="ys-editor-error" id="ysEditorPwErr"></p>
        <div class="ys-editor-actions">
          <button class="ys-btn ghost" id="ysEditorPwCancel">Batal</button>
          <button class="ys-btn primary" id="ysEditorPwSubmit">Masuk</button>
        </div>
        <button class="ys-editor-reset-link" id="ysEditorResetLink" type="button">Setup ulang token/password</button>
      </div>
    `;
    overlay.classList.add("open");
    const $pw = document.getElementById("ysEditorPw");
    $pw.focus();
    const submit = async () => {
      const hash = await sha256Hex($pw.value || "");
      if (hash !== localStorage.getItem(PW_HASH_KEY)) {
        document.getElementById("ysEditorPwErr").textContent = "Password salah.";
        return;
      }
      openEditor(slug);
    };
    document.getElementById("ysEditorPwSubmit").addEventListener("click", submit);
    $pw.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    document.getElementById("ysEditorPwCancel").addEventListener("click", closeOverlay);
    document.getElementById("ysEditorResetLink").addEventListener("click", () => renderSetupModal(slug, true));
  }

  function renderSetupModal(slug, isReset) {
    const overlay = ensureOverlay();
    overlay.innerHTML = `
      <div class="ys-editor-modal">
        <h3>${isReset ? "Setup Ulang Editor" : "Setup Editor (sekali aja per browser/device)"}</h3>
        <p class="ys-editor-hint">
          1. Buat <strong>GitHub fine-grained personal access token</strong> yang di-scope <strong>cuma ke repo
          ${esc(REPO_OWNER)}/${esc(REPO_NAME)}</strong>, izin <strong>Contents: Read and write</strong>.<br>
          2. Tempel token-nya di sini, dan bikin password editor kamu sendiri.<br>
          Keduanya cuma tersimpan di browser ini (localStorage) — nggak pernah ke-commit ke kode atau dikirim ke server manapun selain langsung ke GitHub.
        </p>
        <label class="ys-editor-label">GitHub Token</label>
        <input type="password" id="ysSetupToken" class="ys-editor-input" placeholder="ghp_... atau github_pat_..." autocomplete="off">
        <label class="ys-editor-label">Password Editor (bikin sendiri)</label>
        <input type="password" id="ysSetupPw" class="ys-editor-input" placeholder="Password baru" autocomplete="new-password">
        <input type="password" id="ysSetupPw2" class="ys-editor-input" placeholder="Ulangi password" autocomplete="new-password">
        <p class="ys-editor-error" id="ysSetupErr"></p>
        <div class="ys-editor-actions">
          <button class="ys-btn ghost" id="ysSetupCancel">Batal</button>
          <button class="ys-btn primary" id="ysSetupSubmit">Simpan &amp; Lanjut</button>
        </div>
      </div>
    `;
    overlay.classList.add("open");
    document.getElementById("ysSetupCancel").addEventListener("click", closeOverlay);
    document.getElementById("ysSetupSubmit").addEventListener("click", async () => {
      const token = document.getElementById("ysSetupToken").value.trim();
      const pw = document.getElementById("ysSetupPw").value;
      const pw2 = document.getElementById("ysSetupPw2").value;
      const $err = document.getElementById("ysSetupErr");
      if (!token) { $err.textContent = "Token wajib diisi."; return; }
      if (!pw || pw.length < 4) { $err.textContent = "Password minimal 4 karakter."; return; }
      if (pw !== pw2) { $err.textContent = "Password gak sama."; return; }
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(PW_HASH_KEY, await sha256Hex(pw));
      openEditor(slug);
    });
  }

  // -----------------------------------------------------------------------
  // main editor
  // -----------------------------------------------------------------------
  async function openEditor(slug) {
    const overlay = ensureOverlay();
    overlay.innerHTML = `<div class="ys-editor-modal"><p class="ys-editor-hint">Memuat konten dari GitHub...</p></div>`;
    overlay.classList.add("open");

    currentSlug = slug;
    currentIsIssueLog = window.YSApp.manifest.issueLog.slug === slug;
    const path = `content/${slug}.md`;

    let file;
    try {
      file = await ghGetFile(path);
    } catch (e) {
      renderApiError(e);
      return;
    }
    if (!file) {
      renderApiError(new Error(`File ${path} nggak ketemu di GitHub.`));
      return;
    }
    const text = base64ToUtf8(file.content);
    renderEditorUI(text);
  }

  function renderApiError(e) {
    const overlay = ensureOverlay();
    const authHint = e.status === 401 || e.status === 403
      ? '<br><br>Kemungkinan token salah/kadaluarsa/nggak punya izin write ke repo ini. Coba <button class="ys-editor-reset-link" id="ysEditorResetFromErr" type="button">setup ulang token</button>.'
      : "";
    overlay.innerHTML = `
      <div class="ys-editor-modal ys-editor-modal-sm">
        <h3>Gagal</h3>
        <p class="ys-editor-error">${esc(e.message)}${authHint}</p>
        <div class="ys-editor-actions">
          <button class="ys-btn ghost" id="ysEditorCloseErr">Tutup</button>
        </div>
      </div>
    `;
    document.getElementById("ysEditorCloseErr").addEventListener("click", closeOverlay);
    const $reset = document.getElementById("ysEditorResetFromErr");
    if ($reset) $reset.addEventListener("click", () => renderSetupModal(currentSlug, true));
  }

  function renderEditorUI(text) {
    const overlay = ensureOverlay();
    overlay.innerHTML = `
      <div class="ys-editor-modal ys-editor-modal-lg">
        <div class="ys-editor-header">
          <h3>Edit: ${esc(titleForSlug(currentSlug))}</h3>
          <button class="ys-editor-close" id="ysEditorClose" aria-label="Tutup">&times;</button>
        </div>
        <div class="ys-editor-toolbar">
          <label class="ys-btn ghost ys-editor-upload-btn">
            ${uploadIcon()} Upload gambar / PDF / SVG
            <input type="file" id="ysEditorFile" accept=".png,.svg,.pdf" style="display:none">
          </label>
          <span class="ys-editor-upload-status" id="ysEditorUploadStatus"></span>
        </div>
        <div class="ys-editor-split">
          <textarea id="ysEditorTextarea" class="ys-editor-textarea" spellcheck="false">${esc(text)}</textarea>
          <div class="ys-editor-preview markdown-body" id="ysEditorPreview"></div>
        </div>
        <p class="ys-editor-error" id="ysEditorSaveErr"></p>
        <div class="ys-editor-actions">
          <button class="ys-btn ghost" id="ysEditorCancel">Batal</button>
          <button class="ys-btn primary" id="ysEditorSave">Simpan &amp; Publish</button>
        </div>
      </div>
    `;
    const $ta = document.getElementById("ysEditorTextarea");
    const $preview = document.getElementById("ysEditorPreview");
    const pendingBlobUrls = {}; // relPath -> local blob URL, for files uploaded this session
    const updatePreview = () => {
      let html = window.YSApp.renderMarkdown($ta.value);
      // Just-uploaded files aren't live on GitHub Pages yet (1-2 min rebuild
      // delay) — swap in the local blob so the preview shows them instantly.
      Object.keys(pendingBlobUrls).forEach((relPath) => {
        html = html.split(`${window.YSApp.CONTENT_DIR}/${relPath}`).join(pendingBlobUrls[relPath]);
      });
      $preview.innerHTML = html;
    };
    updatePreview();
    let debounce;
    $ta.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(updatePreview, 250);
    });

    document.getElementById("ysEditorClose").addEventListener("click", closeOverlay);
    document.getElementById("ysEditorCancel").addEventListener("click", closeOverlay);
    document.getElementById("ysEditorFile").addEventListener("change", (e) => handleFileUpload(e, $ta, updatePreview, pendingBlobUrls));
    document.getElementById("ysEditorSave").addEventListener("click", () => handleSave($ta.value));
  }

  function uploadIcon() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>';
  }

  async function handleFileUpload(e, $ta, updatePreview, pendingBlobUrls) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const $status = document.getElementById("ysEditorUploadStatus");
    $status.textContent = "Mengupload " + file.name + "...";
    try {
      const buf = await file.arrayBuffer();
      const base64 = bytesToBase64(new Uint8Array(buf));
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const filename = `${Date.now()}-${safeName}`;
      const folder = currentIsIssueLog ? "issue-log" : currentSlug;
      const path = `content/images/${folder}/${filename}`;
      await ghPutFile(path, base64, null, `Upload ${filename} lewat web editor`);
      const relPath = `images/${folder}/${filename}`;
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const insertion = isPdf ? `[📄 ${file.name}](${relPath})` : `![${file.name}](${relPath})`;
      if (!isPdf) pendingBlobUrls[relPath] = URL.createObjectURL(file);
      insertAtCursor($ta, insertion);
      updatePreview();
      $status.textContent = "✓ " + file.name + " ke-upload & disisipkan.";
      setTimeout(() => { $status.textContent = ""; }, 4000);
    } catch (err) {
      $status.textContent = "Upload gagal: " + err.message;
    }
  }

  function insertAtCursor($ta, text) {
    const start = $ta.selectionStart;
    const end = $ta.selectionEnd;
    const before = $ta.value.slice(0, start);
    const after = $ta.value.slice(end);
    const needsNewlineBefore = before.length && !before.endsWith("\n\n");
    const insertion = (needsNewlineBefore ? (before.endsWith("\n") ? "\n" : "\n\n") : "") + text + "\n\n";
    $ta.value = before + insertion + after;
    const pos = (before + insertion).length;
    $ta.focus();
    $ta.setSelectionRange(pos, pos);
  }

  async function handleSave(newText) {
    const $btn = document.getElementById("ysEditorSave");
    const $err = document.getElementById("ysEditorSaveErr");
    $err.textContent = "";
    $btn.disabled = true;
    $btn.textContent = "Menyimpan...";
    try {
      const path = `content/${currentSlug}.md`;
      // Re-fetch sha right before writing in case the file changed since the editor opened.
      const fresh = await ghGetFile(path);
      const sha = fresh ? fresh.sha : undefined;
      const base64 = utf8ToBase64(newText);
      await ghPutFile(path, base64, sha, `Update ${currentSlug}.md lewat web editor`);
      if (window.YSApp) {
        // Show the just-saved text immediately instead of re-fetching the
        // static file — GitHub Pages takes 1-2 min to rebuild, so a refetch
        // right now would still return the old version.
        window.YSApp.setCachedContent(currentSlug, newText);
        window.YSApp.resetSearchIndex();
        window.YSApp.reroute();
      }
      closeOverlay();
      showToast("Tersimpan! Situs bakal ke-update dalam 1-2 menit setelah GitHub Pages rebuild.");
    } catch (err) {
      $err.textContent = "Gagal menyimpan: " + err.message;
    } finally {
      $btn.disabled = false;
      $btn.textContent = "Simpan & Publish";
    }
  }

  function showToast(msg) {
    let t = document.getElementById("ysToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "ysToast";
      t.className = "ys-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("open");
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(() => t.classList.remove("open"), 5000);
  }

  return { mount };
})();
