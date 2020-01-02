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
      return e.preventDefault(); 
  } else {
      if (errorBox.classList.contains('.error')) {
          errorBox.classList.remove('.error');
      }
      try {
        const response = await fetch(
          `http://localhost:3000/authorize?participantId=${participantId}`, { method: 'post' }
        )
        const { data, errorMessage } = await response.json()
        if (data) {
          window.location.href = data.redirectURI
        } else {
          console.log('fail: ', errorMessage)
        }


      } catch (e) {
        throw e
      }
  }

}
