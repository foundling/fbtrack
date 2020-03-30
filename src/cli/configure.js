const path = require('path')
const { question } = require('readline-sync')
const { io, formatters } = require('../lib/utils')
const { writeFilePromise } = io

async function main() {

  console.log('\nConfigure FBTRACK for your app:\n') 
  console.log('Specific config values can be found in your Fitbit app panel.')
  console.log('See: https://dev.fitbit.com/apps\n')

  const id = _ => _
  const config = [

    { prompt: 'Study Name',   value: 'STUDY_NAME', example: 'XYZ Study' },
    { prompt: 'OAuth 2.0 Client ID', value: 'CLIENT_ID', example: '31B1A0' },
    { prompt: 'Client Secret', value: 'CLIENT_SECRET', example: '9d2590d0d66a9641cc42a19c09c17a80' },
    { prompt: 'Callback URL', value: 'CALLBACK_URL', example: 'http://localhost:3000/store_subject_data' },  
    { prompt: 'OAuth 2.0 Authorization URI', value: 'AUTH_URI', example: 'https://www.fitbit.com/oauth2/authorize' },
    { prompt: 'OAuth 2.0 Access/Refresh Token Request URI', value: 'REFRESH_URI', example: 'https://api.fitbit.com/oauth2/token' },
    { prompt: 'Scope',        value: 'SCOPE',            example: 'heartrate activity sleep' },
    { prompt: 'Window Size',  value: 'WINDOW_SIZE', example: 3 },

  ].reduce((config, param) => {
    const { value, prompt, example } = param
    const formattedPrompt = Boolean(example) ? `${prompt} [ e.g., ${example} ]: ` : `${param}: `
    config[value] = question(formattedPrompt).trim() || example
    return config
  }, {})

  const temp = Object.keys(config).reduce((output, key) => {
    return output + `\n${key}: ${config[key]}`
  }, '')

  const answer = question(`\nYou Entered: \n${temp}\n\nType 'yes' to confirm or 'no' / ENTER to abort: `)
  if (answer.toLowerCase().trim() === 'yes') {
    const finalOutput = Object.keys(config).reduce((output, param) => output + `${param}=${config[param]}\n`, '')
    const outputPath = path.join(__dirname, '..', '..', 'USER_CONFIG.env')
    await writeFilePromise(outputPath, finalOutput)
    console.log('\nApplication successfully configured!')
  } else {
    console.log('Configuration was aborted.')
  }

}

module.exports = exports = { main }
