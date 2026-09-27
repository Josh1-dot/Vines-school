const menuButton = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
const modal = document.querySelector('.portal-modal');

menuButton?.addEventListener('click', () => {
  navLinks.classList.toggle('mobile-open');
});

document.querySelectorAll('[data-open-dashboard], .parent-login').forEach((button) => {
  button.addEventListener('click', () => {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  });
});

document.querySelector('.close-modal')?.addEventListener('click', closePortal);
modal?.addEventListener('click', (event) => { if (event.target === modal) closePortal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePortal(); });

function closePortal() {
  modal?.classList.remove('open');
  modal?.setAttribute('aria-hidden', 'true');
}
