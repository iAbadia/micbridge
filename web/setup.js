fetch('/setup-info').then(response => response.json()).then(info => {
  document.getElementById('fingerprint').textContent = info.fingerprint;
}).catch(() => { document.getElementById('fingerprint').textContent = 'Could not load fingerprint. Verify it in the desktop app before installing.'; });
