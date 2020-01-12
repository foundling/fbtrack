const isClientError = code => code >= 400 && code < 500
const isServerError = code => code >= 500 && code < 600
const isSuccess = code => 200 && code < 300

module.exports = exports = {
  isClientError,
  isServerError,
  isSuccess,
}
