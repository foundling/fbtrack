# fbt

`fbt` is a command-line application for collecting Fitbit participant data on your local Mac or Linux machine.

## Why Would I Want This?

While Fitbit offers CSV web exports of participant data with a somewhat configurable export feature, the `fbt` app offers the following additional capabilities:

- Collects the data at a configurable interval
- Collectes the data intelligently:
  + requests are made only for data not yet collected between a configurable [capture window](#capture-window)
  + request are [rate-limit](https://dev.fitbit.com/build/reference/web-api/basics/#rate-limits) aware and will pause when that rate-limit is reached, continuing once the wait period has ended.
- Can access daily, hourly or minute-level data (pending Fitbit's approval, see below) via Fitbit's REST API.
- Can request data in JSON format, which might offer more programming flexibility, depending on your data analysis needs.
- Offers some basic participant management features:
  + browser-based OAuth2 registration
  + participant study registration, OAuth-based authorization
  + data collection reporting

## Requirements

#### Technology

- You have an internet-connected Mac or Linux, with Google Chrome and Node.js 12+ installed. 
- You are registering subjects in person via this computer
- You or your administrator are willing to use the terminal on a very basic level.
- You are creating [HIPAA](https://www.hhs.gov/hipaa/for-professionals/privacy/laws-regulations/index.html)-compliant participant ids that in no way identify your subjects.
- You are creating study-specific Fitbit accounts for your subjects, or otherwise have a way to request that they re-authorize the application to collect their data, should some technical issue occur that would de-authorize them.

#### Fitbit
- You or someone your behalf has configured an OAuth2 web application [here](https://dev.fitbit.com/apps/new) and have access to the resulting OAuth information required to install the `fbt` application:
  + OAuth 2.0 Client ID
  + Client Secret
  + Callback URL
  + OAuth 2.0: Authorization URI
  + OAuth 2.0: Access/Refresh Token Request URI
- **NOTE:** If you need access for data on the **minute** or **hourly** level, you have placed an Intraday Access Request [here](https://dev.fitbit.com/build/reference/web-api/intraday-requests/) with Fitbit.

## Install Instructions

At a terminal, run the following:

```bash
# fetches the latest code from github
git clone git@github.com:foundling/fbt

# enter the application directory of the downloaded repository
cd fbt

# install the application dependencies
npm install

# add the command-line path to your startup configuration file so you can 
# type 'fbt' from anywhere to run the command 
fbt="$(pwd)/bin"; echo 'export PATH=$PATH:'$fbt >> ~/.bashrc

# configure the app using your oauth keys and desired Fitbit Scopes
fbt setup
```
