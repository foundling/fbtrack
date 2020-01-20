# Fbtrack

Participant management platform and data collection tool for research studies collecting Fitbit data.

## Install Instructions

At a terminal, run the following:

```
# fetch the latest code from github
$ git clone git@github.com:foundling/fbtrack

# enter the application directory of the downloaded repository
$ cd fbtrack

# install the application dependencies
$ npm install

# add the command-line path to your startup configuration file so you can 
# type 'fbtrack' from anywhere to run the command 
$ fbtrack="$(pwd)/bin"; echo 'export PATH=$PATH:'$fbtrack >> ~/.bashrc

# configure the app using your oauth keys and desired Fitbit Scopes
$ fbtrack setup
```

## Usage

Fbtrack is a command-line utility supporting participant management and data collection at a user-defined interval. 

- Automates data collection at a user-defined interval and window-size
- Collect data as granular as the minute-level (you need Fitbit's approval for this, see below)
- browser-based study participant registration and Fitbit OAuth authorization
- participant history and collection reporting


## Assumptions

- You have an internet-connected Mac or Linux, with Google Chrome and Node.js 12+ installed. 
- You are registering subjects in person via this computer
- You or your administrator are willing to use the terminal on a very basic level.
- You are creating [HIPAA](https://www.hhs.gov/hipaa/for-professionals/privacy/laws-regulations/index.html)-compliant participant ids that in no way identify your subjects.
- You are creating study-specific Fitbit accounts for your subjects, or otherwise have a way to request that they re-authorize the application to collect their data, should some technical issue occur that would de-authorize them.

#### Fitbit
- You or someone your behalf has configured an OAuth2 web application [here](https://dev.fitbit.com/apps/new) and have access to the resulting OAuth information required to install the `fbtrack` application:
  + OAuth 2.0 Client ID
  + Client Secret
  + Callback URL
  + OAuth 2.0: Authorization URI
  + OAuth 2.0: Access/Refresh Token Request URI
- **NOTE:** If you need access for data on the **minute** or **hourly** level, you have placed an Intraday Access Request [here](https://dev.fitbit.com/build/reference/web-api/intraday-requests/) with Fitbit.


