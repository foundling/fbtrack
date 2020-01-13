const isClientError = ({ statusCode }) => statusCode.toString().startsWith('4')
const isServerError = ({ statusCode }) => statusCode.toString().startsWith('5')
const isSuccess = ({ statusCode }) => statusCode.toString().startsWith('2')
const rateLimitExceeded = ({ statusCode}) => statusCode === 429
const accessTokenExpired = ({ statusCode }) => statusCode === 401
const invalidRefreshToken = ({ statusCode }) => statusCode === 400

module.exports = exports = {
  isClientError,
  isServerError,
  isSuccess,
  invalidRefreshToken,
  rateLimitExceeded,
  accessTokenExpired,
}
