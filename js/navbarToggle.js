export function initNavbarToggle() {
  const toggle = document.getElementById('navToggle');
  if (!toggle) return;
  const navbar = toggle.closest('.navbar');
  if (!navbar) return;
  toggle.addEventListener('click', () => {
    navbar.classList.toggle('expanded');
  });
}
