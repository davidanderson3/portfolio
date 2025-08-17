export function initContactUI() {
  const link = document.getElementById('contactDeveloperLink');
  const modal = document.getElementById('contactModal');
  const cancelBtn = document.getElementById('contactCancelBtn');
  const form = document.getElementById('contactForm');
  const nameInput = document.getElementById('contactName');
  const emailInput = document.getElementById('contactEmailInput');
  const messageInput = document.getElementById('contactMessage');

  if (!link || !modal || !cancelBtn || !form) return;

  link.addEventListener('click', e => {
    e.preventDefault();
    modal.style.display = 'flex';
  });

  cancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      name: nameInput?.value.trim(),
      from: emailInput?.value.trim(),
      message: messageInput?.value.trim(),
    };
    try {
      await fetch('/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      alert('Message sent');
    } catch {
      alert('Failed to send message');
    }
    modal.style.display = 'none';
    form.reset();
  });
}
