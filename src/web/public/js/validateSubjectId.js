const subjectIdInput = document.getElementById('subject_id');
const submitButton = document.querySelector('button[type="submit"]');
const form = document.getElementById('subject_id_form');
const errorBox = document.getElementById('error-box');

errorBox.addEventListener('click', (e) => {

    hideError(e.target);
    subjectIdInput.value = '';

});

submitButton.addEventListener('click', register);

function hideError(el) {
  el.classList.remove('error');
}

function notify (el, msg) {
  el.classList.add('error');
  el.innerHTML = msg;
}

async function register(e) {

  e.preventDefault()
  // sanitize
  const participantId = subjectIdInput.value.trim()

  if (!participantId) {
      notify(errorBox, 'Please enter a subject id.');             
      return e.preventDefault(); 
  } else {
      if (errorBox.classList.contains('.error')) {
          errorBox.classList.remove('.error');
      }
      fetch(`http://localhost:3000/authorize?participantId=${participantId}`, {
        method: 'post'
      }).then(response=>response.json()).then(({ data }) => {
        window.location.href = data.redirectURI
      }).catch(console.log)
      //const result = await response.json()
      //console.log({ result })

  }

}
