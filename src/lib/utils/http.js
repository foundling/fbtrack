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


function invalidAccessToken(response) {
  return response.statusCode === 401 &&
         response.body.errors[0].errorType === 'invalid_token'
}

function accessTokenExpired(response) {
  return response.statusCode === 400
}


module.exports = exports = {
  isServerError,
  isSuccess,
  invalidRefreshToken,
  invalidAccessToken,
  rateLimitExceeded,
  accessTokenExpired,
}
