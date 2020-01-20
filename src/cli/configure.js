const path = require('path')
const { question } = require('readline-sync')
const { io, formatters } = require('../lib/utils')
const { writeFilePromise } = io
const { splitArgsOn } = formatters

const {

  FITBIT_CONFIG,
  APP_CONFIG,
  USER_CONFIG,

} = require('../config')

async function main() {


  console.log('\nConfigure FBTRACK for your app:\n') 
  console.log('Specific config values can be found in your Fitbit app panel.')
  console.log('See: https://dev.fitbit.com/apps\n')

  const id = _ => _
  const config = [

    { prompt: 'Study Name',   value: 'STUDY_NAME', example: 'XYZ Study' },
    { prompt: 'OAuth 2.0 Client ID', value: 'CLIENT_ID', example: '31B1A0' },
    { prompt: 'OAuth 2.0 Access/Refresh Token Request URI', value: 'REFRESH_URI', example: 'https://api.fitbit.com/oauth2/token' },
    { prompt: 'Scope',        value: 'SCOPE',            example: 'heart activities sleep' },
    { prompt: 'Callback URL', value: 'CALLBACK_URL',     example: 'localhost:3000/callback' },  
    { prompt: 'Window Size',  value: 'WINDOW_SIZE', example: 3 },

  ].reduce((config, param) => {
    const { value, prompt, example } = param
    const formattedPrompt = Boolean(example) ? `${prompt} [ e.g., ${example} ]: ` : `${param}: `
    config[value] = question(formattedPrompt)
    return config
  }, {})

  const temp = Object.keys(config).reduce((output, key) => {
    return output + `\n${key}: ${config[key]}`
  }, '')

  const answer = question(`\nYou Entered: \n${temp}\n\nType 'yes' to confirm or 'no' / ENTER to abort: `)
  if (answer.toLowerCase().trim() === 'yes') {
    const finalOutput = Object.keys(config).reduce((output, param) => output + `${param}=${config[param]}\n`, '')
    const outputPath = path.join(__dirname, '..', '..', 'USER_CONFIG.env.test')
    await writeFilePromise(outputPath, finalOutput)
    console.log('\nApplication successfully configured!')
  } else {
    console.log('Configuration was aborted.')
  }



}

module.exports = exports = { main }
