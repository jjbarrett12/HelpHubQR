export function ThemeScript() {
  const script = `
    (function() {
      var key = 'helpHub-theme';
      var stored = localStorage.getItem(key);
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = stored === 'dark' || (stored !== 'light' && prefersDark);
      document.documentElement.classList.toggle('dark', isDark);
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
