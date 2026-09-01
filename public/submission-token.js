function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

const form = document.querySelector('form[name="item-contribution"], form[name="submit-source"]');
if (form) {
  let input = form.querySelector('input[name="status-token"]');
  if (!input) {
    input = document.createElement('input'); input.type = 'hidden'; input.name = 'status-token'; form.appendChild(input);
  }
  if (!input.value) input.value = newToken();
  form.addEventListener('submit', () => {
    sessionStorage.setItem('civic-commons:last-submission-status-token', input.value);
  });
}
