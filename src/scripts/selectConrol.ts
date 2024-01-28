export const selectNext = (id: string) => {
  const s = document.getElementById(id) as HTMLSelectElement;
  if (s.options.length === 0) return;
  if (s.selectedIndex === -1) {
    s.selectedIndex = 0;
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (s.options.length === 0) return;
  if (s.selectedIndex >= s.options.length - 1) return;
  s.selectedIndex++;
  s.dispatchEvent(new Event('change', { bubbles: true }));
};

export const selectPrev = (id: string) => {
  const s = document.getElementById(id) as HTMLSelectElement;
  if (s.options.length === 0) return;
  if (s.selectedIndex <= 0) return;
  s.selectedIndex--;
  s.dispatchEvent(new Event('change', { bubbles: true }));
};
