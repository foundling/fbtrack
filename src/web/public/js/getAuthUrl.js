const subjectIdInput = document.getElementById('subject_id');
const submitButton = document.querySelector('button[type="submit"]');
const form = document.getElementById('subject_id_form');
const errorBox = document.getElementById('error-box');

errorBox.addEventListener('click', (e) => {

    hideError(e.target);
    subjectIdInput.value = '';

});

submitButton.addEventListener('click', getAuthUrl);

function hideError(el) {
  el.classList.remove('error');
}

function notify (el, msg) {
  el.classList.add('error');
  el.innerHTML = msg;
}

async function getAuthUrl(e) {

  e.preventDefault()

  const participantId = subjectIdInput.value.trim()

  if (!participantId) {

      notify(errorBox, 'Please enter a subject id.');             

  } else {

    if (errorBox.classList.contains('.error'))
        errorBox.classList.remove('.error');

    let redirectURI

    try {

      const authorizePath = `http://localhost:3000/authorize?participantId=${participantId}`
      const response = await fetch(authorizePath, { method: 'post' })
      const parsedResponse = await response.json()

      redirectURI = parsedResponse.data.redirectURI

    } catch (e) {
      throw e
    }

    // ensure redirect url is valid
    try {
      new URL(redirectURI)
    } catch(e) {
      throw new Error(['redirectURI is not valid', e])
    }

    window.location.href = redirectURI

  }

}
