var API_BASE_URL;
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  API_BASE_URL = '';
} else {
  API_BASE_URL = 'https://lor-personal-web-site-back-end.onrender.com';
}
