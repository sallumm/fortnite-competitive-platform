// Runs before CSS and React to avoid flashing a different saved theme.
try {
  const saved = localStorage.getItem('clutchfolio-theme');
  const theme = ['dark', 'light', 'tidal', 'system'].includes(saved) ? saved : 'dark';
  document.documentElement.dataset.theme = theme === 'system' ? matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark' : theme;
  document.documentElement.dataset.density = localStorage.getItem('kyrven-density') === 'compact' ? 'compact' : 'comfortable';
} catch { document.documentElement.dataset.theme = 'dark'; }
