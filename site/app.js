const motion = document.querySelector("#motion-toggle");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
let paused = reduced.matches;
function updateMotion() {
  document.body.dataset.motion =
    paused || reduced.matches ? "paused" : "playing";
  motion.disabled = reduced.matches;
  motion.textContent = reduced.matches
    ? "Reduced motion enabled"
    : paused
      ? "Play animation"
      : "Pause animation";
  motion.setAttribute("aria-pressed", String(paused || reduced.matches));
}
motion.addEventListener("click", () => {
  paused = !paused;
  updateMotion();
});
reduced.addEventListener("change", updateMotion);
updateMotion();

// Only offer independent builds; the historical 0.3.0 release used a retired helper.
async function loadDownloads() {
  const status = document.querySelector("#release-status");
  try {
    const response = await fetch(
      "https://api.github.com/repos/iAbadia/micbridge/releases?per_page=20",
      { signal: AbortSignal.timeout(7000) },
    );
    if (!response.ok) throw new Error("Release listing unavailable");
    const releases = await response.json();
    const release = releases.find((item) => {
      const version = /^v(\d+)\.(\d+)\.(\d+)$/.exec(item.tag_name);
      if (!version || item.draft) return false;
      const [, major, minor, patch] = version.map(Number);
      return major > 0 || minor > 3 || (minor === 3 && patch >= 1);
    });
    if (!release) {
      status.textContent =
        "Independent preview downloads are being prepared. Build from source in the meantime.";
      for (const link of document.querySelectorAll("[data-download]")) {
        link.href = "https://github.com/iAbadia/micbridge#run-from-source";
        link.textContent = "Build from source";
      }
      return;
    }
    for (const link of document.querySelectorAll("[data-download]")) {
      const name = `Micbridge-${release.tag_name.slice(1)}-${link.dataset.download}`;
      const asset = release.assets.find((item) => item.name === name);
      if (
        asset &&
        asset.browser_download_url.startsWith(
          "https://github.com/iAbadia/micbridge/releases/download/",
        )
      ) {
        link.href = asset.browser_download_url;
        if (link.dataset.download.endsWith("setup.exe"))
          link.textContent = "Windows installer";
      } else {
        link.href = "https://github.com/iAbadia/micbridge#run-from-source";
        link.textContent = "Build from source";
      }
    }
    status.textContent = `${release.tag_name} preview · See release notes for platform testing and limitations.`;
  } catch {
    status.textContent =
      "Direct download links are unavailable. Open GitHub Releases for the current preview, or build from source.";
  }
}
void loadDownloads();
