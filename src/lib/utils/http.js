function isServerError({ response }) {
  return response.statusCode.toString().startsWith('5')
}

function isSuccess(response) {
  return response.statusCode === 200
}

function rateLimitExceeded (response) {
  return response.statusCode === 429
}

function invalidRefreshToken(response) {
  return response.statusCode === 400 &&
         response.body.errors[0].errorType === 'invalid_token'
}


function accessTokenExpired(body) {
  return body.success === false && body.errors[0].errorType === 'expired_token'
}

function invalidGrantToken(response) {
  return response.statusCode === 400
}

module.exports = exports = {
  accessTokenExpired,
  isServerError,
  isSuccess,
  invalidRefreshToken,
  rateLimitExceeded,
}
