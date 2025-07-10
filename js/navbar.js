export function initMobileNavbar() {
  const navbars = document.querySelectorAll('.navbar');
  navbars.forEach(nav => {
    const toggle = nav.querySelector('.menu-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      nav.classList.toggle('expanded');
    });
  });
}
