let toastTimer = null;

/** Displays a user-facing message for 2.5 seconds. */
export function showMessage(text) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.append(toast);
  }
  toast.textContent = text;
  toast.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.style.opacity = "0"), 2500);
}
