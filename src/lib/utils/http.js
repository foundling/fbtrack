const isClientError = code => code >= 400 && code < 500
const isServerError = code => code >= 500 && code < 600
const isSuccess = code => 200 && code < 300
const rateLimitExceeded = code => code === 429
const accessTokenExpired = code => code === 401

module.exports = exports = {
  isClientError,
  isServerError,
  isSuccess,
  rateLimitExceeded,
  accessTokenExpired,
}
