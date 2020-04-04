const subjectIdInput = document.getElementById('subject_id');
const participantStartDateInput = document.getElementById('subject_start_date');
const reauthorizeCheckbox = document.getElementById('subject_reauthorize');
const submitButton = document.getElementById('subject_signup_submit');
const form = document.getElementById('subject_id_form');
const errorBox = document.getElementById('error-box');

submitButton.addEventListener('click', getAuthUrl);
errorBox.addEventListener('click', (e) => {

    hideError(e.target);
    subjectIdInput.value = '';

});


function hideError(el) {
  el.classList.remove('error');
}

function notify (el, msg) {
  el.classList.add('error');
  el.innerHTML = `Error: ${msg}`;
}

async function getAuthUrl(e) {

  e.preventDefault()

  const participantId = subjectIdInput.value.trim();
  const participantStartDate = participantStartDateInput.value;
  const reauthorize = reauthorizeCheckbox.checked;

  if (!participantId) {

      notify(errorBox, 'Please enter a subject id.');

  } else {

    if (errorBox.classList.contains('.error'))
        errorBox.classList.remove('.error');

    let redirectURI

    try {

      const authorizeURL = new URL(`http://localhost:3000/authorize`)
      const authorizeQueryParams = [
        [ 'participantId', participantId ],
        [ 'participantStartDate', participantStartDate ],
        [ 'reauthorize', reauthorize ? '1' : '' ],
      ].map(([ param, value]) => `${param}=${value}`).join('&')

      const response = await fetch(`${authorizeURL}?${authorizeQueryParams}`, { method: 'post' })
      const parsedResponse = await response.json()

      if (response.ok) {
        redirectURI = parsedResponse.data.redirectURI
      } else if (response.status === 409) {
        console.log(parsedResponse.errorMessage)
        notify(errorBox, parsedResponse.errorMessage)
        return
      }

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
