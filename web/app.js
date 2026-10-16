const state = { projects: [], templates: [], selectedProject: null, files: {}, activeFile: null, dirty: false };
const editableFilePattern = /\.(tex|bib|sty|cls|cfg|txt|md|json|csv|ya?ml|mk)$/i;
let compileInFlight = false;

const $ = (selector) => document.querySelector(selector);

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function initializeWorkspace() {
  await Promise.all([
    request("/api/templates").then(data => { state.templates = data.templates; renderTemplates(); }),
    refreshProjects(),
  ]);
}

function showToast(message, error = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.style.color = error ? "#a33c32" : "";
  toast.style.background = error ? "#fff1ef" : "";
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function renderProjects() {
  $("#project-count").textContent = state.projects.length;
  const list = $("#project-list");
  list.innerHTML = state.projects.map(project => `
    <button class="project-item ${state.selectedProject?.id === project.id ? "selected" : ""}" data-project-id="${project.id}">
      <span class="project-item-name">${escapeHtml(project.name)}</span>
      <span class="project-item-meta">${(project.tex_files || project.files).length} source file${(project.tex_files || project.files).length === 1 ? "" : "s"}</span>
    </button>`).join("");
  list.querySelectorAll("[data-project-id]").forEach(button => {
    button.addEventListener("click", () => openProject(button.dataset.projectId));
    button.addEventListener("contextmenu", event => {
      event.preventDefault();
      showProjectContextMenu(event, button.dataset.projectId);
    });
  });
}

let contextProjectId = null;

function showProjectContextMenu(event, projectId) {
  contextProjectId = projectId;
  const menu = $("#project-context-menu");
  menu.hidden = false;
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - 170)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - 50)}px`;
}

function hideProjectContextMenu() {
  contextProjectId = null;
  $("#project-context-menu").hidden = true;
}

function renderTemplates() {
  $("#template-options").innerHTML = state.templates.map((template, index) => `
    <label class="template-option"><input type="radio" name="template" value="${template.id}" ${index === 0 ? "checked" : ""}>
      <span class="template-title">${escapeHtml(template.name)}</span>
      <span class="template-description">${escapeHtml(template.description)}</span>
    </label>`).join("");
}

function setPdfPreview(available) {
  const project = state.selectedProject;
  if (!project) return;
  const pdfUrl = `${project.pdf_url}?t=${Date.now()}`;
  $("#pdf-frame").hidden = !available;
  $("#preview-empty").hidden = available;
  $("#download-pdf").hidden = !available;
  if (available) {
    $("#pdf-frame").src = pdfUrl;
    $("#download-pdf").href = pdfUrl;
  }
}

function renderSecurityMode(status) {
  const badge = $("#security-mode");
  if (status.required) {
    badge.textContent = status.compile_mode === "container" ? "Password + container" : "Password protected";
    badge.classList.add("secure");
    $("#logout").hidden = false;
  } else {
    badge.textContent = status.compile_mode === "container" ? "Container compiler" : "Local only";
  }
}

function renderEditor() {
  const project = state.selectedProject;
  const hasProject = Boolean(project);
  $("#empty-state").hidden = hasProject;
  $("#editor-view").hidden = !hasProject;
  if (!project) return;
  $("#editor-project-name").textContent = project.name;
  const editableFiles = project.files.filter(isEditableFile);
  const texFiles = project.tex_files || editableFiles.filter(file => file.toLowerCase().endsWith(".tex"));
  $("#main-file-select").innerHTML = texFiles.map(file => `<option value="${encodeURIComponent(file)}">${escapeHtml(file)}</option>`).join("");
  $("#main-file-select").value = project.main_file ? encodeURIComponent(project.main_file) : "";
  $("#main-file-select").disabled = texFiles.length === 0;
  $("#file-list").innerHTML = editableFiles.map(file => `
    <button class="file-button ${state.activeFile === file ? "active" : ""}" data-file="${encodeURIComponent(file)}"><span class="file-glyph">${file.endsWith(".tex") ? "T" : "·"}</span>${escapeHtml(file)}</button>`).join("");
  $("#file-list").querySelectorAll("[data-file]").forEach(button => button.addEventListener("click", () => selectFile(decodeURIComponent(button.dataset.file))));
  $("#active-file").textContent = state.activeFile || "No file selected";
  $("#code-editor").value = state.files[state.activeFile] || "";
  $("#dirty-indicator").classList.toggle("visible", state.dirty);
  $("#save-state").textContent = state.dirty ? "Unsaved changes" : "All changes saved";
  setPdfPreview(Boolean(project.pdf_available));
  if (!layout.previewWidth && $(".editor-grid").clientWidth) {
    layout.previewWidth = Math.round($(".editor-grid").clientWidth * 0.38);
    applyLayout();
  }
}

async function openProject(projectId) {
  try {
    const project = await request(`/api/projects/${projectId}`);
    state.selectedProject = project;
    state.files = {};
    state.dirty = false;
    const editableFiles = project.files.filter(isEditableFile);
    state.activeFile = project.main_file || editableFiles[0] || null;
    for (const file of editableFiles) {
      const response = await fetch(`/api/projects/${projectId}/files/${file.split("/").map(encodeURIComponent).join("/")}`);
      if (response.ok) state.files[file] = await response.text();
    }
    renderProjects();
    renderEditor();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function saveFile() {
  if (!state.selectedProject || !state.activeFile) return;
  const content = $("#code-editor").value;
  state.files[state.activeFile] = content;
  try {
    await request(`/api/projects/${state.selectedProject.id}/files/${state.activeFile.split("/").map(encodeURIComponent).join("/")}`, { method: "PUT", headers: { "Content-Type": "text/plain; charset=utf-8" }, body: content });
    state.dirty = false;
    renderEditor();
    showToast("Saved to disk");
  } catch (error) { showToast(error.message, true); }
}

async function compileProject() {
  if (!state.selectedProject || compileInFlight) return;
  const button = $("#compile-project");
  compileInFlight = true;
  button.disabled = true;
  button.innerHTML = "Compiling…";
  try {
    await saveFileIfDirty();
    const result = await request(`/api/projects/${state.selectedProject.id}/compile`, { method: "POST" });
    $("#compile-log").textContent = result.log || "No compiler output.";
    if (result.ok) {
      state.selectedProject.pdf_available = true;
      setPdfPreview(true);
      showToast(`Compiled with ${result.engine}`);
    } else {
      $("#preview-empty").hidden = false;
      showToast("Compilation failed — see the compiler log", true);
    }
  } catch (error) { $("#compile-log").textContent = error.message; showToast(error.message, true); }
  compileInFlight = false;
  button.disabled = false;
  button.innerHTML = '<span class="play">▶</span> Compile PDF';
}

async function saveFileIfDirty() { if (state.dirty) await saveFile(); }

function selectFile(file) { saveFileIfDirty(); state.activeFile = file; state.dirty = false; renderEditor(); }

function isEditableFile(file) { return editableFilePattern.test(file) || /(^|\/)readme$/i.test(file); }

async function setMainFile(event) {
  if (!state.selectedProject || !event.target.value) return;
  const path = decodeURIComponent(event.target.value);
  try {
    const project = await request(`/api/projects/${state.selectedProject.id}/main-file`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) });
    state.selectedProject = project;
    state.activeFile = path;
    renderProjects();
    renderEditor();
    showToast(`Compile file set to ${path}`);
  } catch (error) { showToast(error.message, true); }
}

async function createProject(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const name = $("#project-name").value.trim();
  const template = document.querySelector("input[name=template]:checked")?.value || "standard";
  if (!name) return;
  try {
    const project = await request("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, template }) });
    $("#new-project-dialog").close();
    $("#new-project-form").reset();
    await refreshProjects();
    await openProject(project.id);
    showToast("Project created");
  } catch (error) { showToast(error.message, true); }
}

async function deleteProject(projectId = state.selectedProject?.id) {
  const project = state.projects.find(item => item.id === projectId) || state.selectedProject;
  if (!project) return;
  hideProjectContextMenu();
  if (!window.confirm(`Delete “${project.name}” and all of its files? This cannot be undone.`)) return;
  try {
    await request(`/api/projects/${project.id}`, { method: "DELETE" });
    if (state.selectedProject?.id === project.id) {
      state.selectedProject = null;
      state.files = {};
      state.activeFile = null;
      state.dirty = false;
    }
    await refreshProjects();
    renderEditor();
    showToast("Project deleted");
  } catch (error) { showToast(error.message, true); }
}

async function importZip(file) {
  try {
    const project = await request("/api/import", { method: "POST", headers: { "Content-Type": "application/zip", "X-Archive-Name": file.name }, body: await file.arrayBuffer() });
    await refreshProjects();
    await openProject(project.id);
    showToast("ZIP imported");
  } catch (error) { showToast(error.message, true); }
}

async function cloneRepository(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const url = $("#repo-url").value.trim();
  const name = $("#repo-name").value.trim();
  const button = $("#start-clone");
  if (!url) return;
  button.disabled = true;
  button.textContent = "Cloning…";
  try {
    const project = await request("/api/repos/clone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, name }) });
    $("#clone-repo-dialog").close();
    $("#clone-repo-form").reset();
    await refreshProjects();
    await openProject(project.id);
    showToast("Repository cloned");
  } catch (error) { showToast(error.message, true); }
  button.disabled = false;
  button.textContent = "Clone repository";
}

async function login(event) {
  event.preventDefault();
  const password = $("#auth-password").value;
  try {
    await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    $("#auth-dialog").close();
    $("#auth-password").value = "";
    await initializeWorkspace();
  } catch (error) { showToast(error.message, true); }
}

async function logout() {
  await request("/api/auth/logout", { method: "POST" });
  window.location.reload();
}

async function refreshProjects() {
  const data = await request("/api/projects");
  state.projects = data.projects;
  renderProjects();
  if (!state.selectedProject && state.projects.length) await openProject(state.projects[0].id);
}

function escapeHtml(value) { return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

const layout = {
  sidebarHidden: localStorage.getItem("suvhlatex.sidebarHidden") === "true",
  filesHidden: localStorage.getItem("suvhlatex.filesHidden") === "true",
  previewHidden: localStorage.getItem("suvhlatex.previewHidden") === "true",
  sidebarWidth: Number(localStorage.getItem("suvhlatex.sidebarWidth")) || 245,
  filesWidth: Number(localStorage.getItem("suvhlatex.filesWidth")) || 185,
  previewWidth: Number(localStorage.getItem("suvhlatex.previewWidth")) || 0,
};

function saveLayout() {
  localStorage.setItem("suvhlatex.sidebarHidden", layout.sidebarHidden);
  localStorage.setItem("suvhlatex.filesHidden", layout.filesHidden);
  localStorage.setItem("suvhlatex.previewHidden", layout.previewHidden);
  localStorage.setItem("suvhlatex.sidebarWidth", layout.sidebarWidth);
  localStorage.setItem("suvhlatex.filesWidth", layout.filesWidth);
  localStorage.setItem("suvhlatex.previewWidth", layout.previewWidth);
}

function applyLayout() {
  const appShell = $(".app-shell");
  const editorGrid = $(".editor-grid");
  appShell.classList.toggle("sidebar-hidden", layout.sidebarHidden);
  editorGrid.classList.toggle("files-hidden", layout.filesHidden);
  editorGrid.classList.toggle("preview-hidden", layout.previewHidden);
  appShell.style.setProperty("--sidebar-width", `${layout.sidebarWidth}px`);
  editorGrid.style.setProperty("--files-width", `${layout.filesWidth}px`);
  if (layout.previewWidth) editorGrid.style.setProperty("--preview-width", `${layout.previewWidth}px`);
  $("#toggle-sidebar").textContent = layout.sidebarHidden ? "☰ Show projects" : "☰ Projects";
  $("#show-files").hidden = !layout.filesHidden;
  $("#show-preview").hidden = !layout.previewHidden;
}

function makeResizable(handleId, container, cssVar, layoutKey, min, max, invert = false) {
  const handle = $(handleId);
  handle.addEventListener("pointerdown", event => {
    if (window.innerWidth <= 1100) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = layout[layoutKey] || (cssVar === "--sidebar-width" ? 245 : 185);
    handle.classList.add("dragging");
    const move = moveEvent => {
      const delta = (moveEvent.clientX - startX) * (invert ? -1 : 1);
      let availableMax = container.clientWidth - 360;
      if (cssVar === "--preview-width") {
        const containerRect = container.getBoundingClientRect();
        const codeRect = $(".code-panel").getBoundingClientRect();
        const codeMinimum = 220;
        const spaceBeforeCode = codeRect.left - containerRect.left;
        availableMax = container.clientWidth - spaceBeforeCode - codeMinimum - 24;
      }
      availableMax = Math.max(min, Math.min(max, availableMax));
      layout[layoutKey] = Math.round(Math.max(min, Math.min(availableMax, startWidth + delta)));
      container.style.setProperty(cssVar, `${layout[layoutKey]}px`);
    };
    const stop = () => {
      handle.classList.remove("dragging");
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
      saveLayout();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop, { once: true });
  });
}

$("#new-project").addEventListener("click", () => $("#new-project-dialog").showModal());
$("#empty-new-project").addEventListener("click", () => $("#new-project-dialog").showModal());
$("#new-project-form").addEventListener("submit", createProject);
$("#clone-repo").addEventListener("click", () => $("#clone-repo-dialog").showModal());
$("#clone-repo-form").addEventListener("submit", cloneRepository);
$("#auth-form").addEventListener("submit", login);
$("#logout").addEventListener("click", logout);
$("#toggle-sidebar").addEventListener("click", () => { layout.sidebarHidden = !layout.sidebarHidden; applyLayout(); saveLayout(); });
$("#hide-sidebar").addEventListener("click", () => { layout.sidebarHidden = true; applyLayout(); saveLayout(); });
$("#hide-files").addEventListener("click", () => { layout.filesHidden = true; applyLayout(); saveLayout(); });
$("#hide-preview").addEventListener("click", () => { layout.previewHidden = true; applyLayout(); saveLayout(); });
$("#show-files").addEventListener("click", () => { layout.filesHidden = false; applyLayout(); saveLayout(); });
$("#show-preview").addEventListener("click", () => { layout.previewHidden = false; applyLayout(); saveLayout(); });
$("#main-file-select").addEventListener("change", setMainFile);
$("#zip-input").addEventListener("change", event => { if (event.target.files[0]) importZip(event.target.files[0]); event.target.value = ""; });
$("#save-file").addEventListener("click", saveFile);
$("#compile-project").addEventListener("click", compileProject);
$("#delete-context-project").addEventListener("click", () => deleteProject(contextProjectId));
document.addEventListener("click", event => {
  if (!$("#project-context-menu").contains(event.target)) hideProjectContextMenu();
});
document.addEventListener("keydown", event => { if (event.key === "Escape") hideProjectContextMenu(); });
$("#code-editor").addEventListener("input", () => { state.dirty = true; $("#dirty-indicator").classList.add("visible"); $("#save-state").textContent = "Unsaved changes"; });
$("#code-editor").addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveFile(); } });

const editorGrid = $(".editor-grid");
const appShell = $(".app-shell");
if (!layout.previewWidth) layout.previewWidth = Math.round(editorGrid.clientWidth * 0.38);
applyLayout();
makeResizable("#sidebar-resizer", appShell, "--sidebar-width", "sidebarWidth", 180, 380);
makeResizable("#files-resizer", editorGrid, "--files-width", "filesWidth", 150, 360);
makeResizable("#preview-resizer", editorGrid, "--preview-width", "previewWidth", 300, 2000, true);

request("/api/auth/status").then(async status => {
  renderSecurityMode(status);
  if (status.required && !status.authenticated) {
    $("#auth-dialog").showModal();
    $("#auth-password").focus();
    return;
  }
  await initializeWorkspace();
}).catch(error => showToast(error.message, true));
