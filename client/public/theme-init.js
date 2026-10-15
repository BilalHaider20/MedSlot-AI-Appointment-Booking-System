try {
  var theme = localStorage.getItem('medslot.theme')
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
} catch (e) {}
