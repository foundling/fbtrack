const subjectIdInput = document.getElementById('subject_id');
const submitButton = document.querySelector('button[type="submit"]');
const participantStartDateInput = document.querySelector('input[type="date"]');
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
  el.innerHTML = `Error: ${msg}`;
}

async function getAuthUrl(e) {

  e.preventDefault()

  const participantId = subjectIdInput.value.trim();
  const participantStartDate = participantStartDateInput.value;
  console.log(participantStartDate);

  if (!participantId) {

      notify(errorBox, 'Please enter a subject id.');             

  } else {

    if (errorBox.classList.contains('.error'))
        errorBox.classList.remove('.error');

    let redirectURI

    try {

      const authorizePath = `http://localhost:3000/authorize`
      const authorizeQueryParams = `participantId=${participantId}&participantStartDate=${participantStartDate}`
      const response = await fetch(`${authorizePath}?${authorizeQueryParams}`, { method: 'post' })
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
