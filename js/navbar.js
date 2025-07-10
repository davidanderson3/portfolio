export function initMobileNavbar() {
  const navbars = document.querySelectorAll('.navbar');
  navbars.forEach(nav => {
    const toggle = nav.querySelector('.menu-toggle');
    if (!toggle) return;

    const overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    nav.parentNode.insertBefore(overlay, nav.nextSibling);

    const closeMenu = () => nav.classList.remove('expanded');

    toggle.addEventListener('click', () => {
      nav.classList.toggle('expanded');
    });

    overlay.addEventListener('click', closeMenu);
  });
}
