# Fbtrack

* [Features](#features)
* [Requirements](#requirements)
* [Installation](#installation)
  + [Setup a Fitbit Oauth2 web app](#setup-a-fitbit-oauth2-web-app)
  + [Install `fbtrack`](#install-fbtrack)
* [Configuration](#configuration)
* [Usage](#usage)
  + [Registering Participants](#registering-participants)
  + [Querying data for one or more participants](#querying-data-for-one-or-more-participants)
    - [Querying all active participants in the current window](#querying-all-active-participants-in-the-current-window)
    - [Querying all active participants with a specific window size](#querying-all-active-participants-with-a-specific-window-size)
    - [Querying specific participants in the default window](#querying-specific-participants-in-the-default-window)
    - [Querying specific participants in a specific date range](#querying-specific-participants-in-a-specific-date-range)
    - [Querying all participants in a specific date range](#querying-all-participants-in-a-specific-date-range)
    - [Performance](#performance)

A data collection tool and basic participant management platform for research studies collecting Fitbit data.

## Features

Fbtrack is a command-line utility supporting participant management and data collection at a user-defined interval. 

- Automates data collection using a user-defined window-size
- Collect data as granular as the minute-level (you need Fitbit's approval for this, see below)
- browser-based study participant registration and Fitbit OAuth authorization
- participant history and collection reporting


## Requirements

- This application is built for Mac only, with Google Chrome and Node.js 12+ installed. 
- You are registering subjects in person via the computer hosting fbtrack
- You or the study administrator are willing to use the terminal on a very basic level.
- You are creating [HIPAA](https://www.hhs.gov/hipaa/for-professionals/privacy/laws-regulations/index.html)-compliant participant ids that in no way identify your subjects.
- You are creating study-specific Fitbit accounts for your subjects, or otherwise have a way to request that they re-authorize the application to collect their data, should some technical issue occur that would de-authorize them.

## Installation

### Setup a Fitbit Oauth2 web app

- Configure an OAuth2 Fitbit web app [here](https://dev.fitbit.com/apps/new) and then navigate to the app details associated with the app you've created. You will need this information to configure the `fbtrack` command-line application:
  + OAuth 2.0 Client ID
  + Client Secret
  + Callback URL (**IMPORTANT:** set this url to `http://localhost:3000/store_subject_data`).
  + OAuth 2.0: Authorization URI
  + OAuth 2.0: Access/Refresh Token Request URI
- **IMPORTANT:** If you need access for data on the **minute** or **hourly** level, make sure to make an Intraday Access Request [here](https://dev.fitbit.com/build/reference/web-api/intraday-requests/) explaining the use-case for your application to Fitbit.


### Install `fbtrack`

Now that you've created the Fitbit Oauth2 Web App and, if necessary, you've been granted access to more granular data levels, run the following at a bash prompt on the computer hosting `fbtrack`:


```console
git clone https://github.com/foundling/fbtrack && \
cd fbtrack && \
npm install && \
fbtrack="$(pwd)/bin" && \
echo 'export PATH=$PATH:'$fbtrack >> ~/.bashrc && \
source ~/.bashrc
```


## Configuration

After you run `npm install fbtrack`, you will be asked to enter configuration values required for fbtrack to run.  Those values are written to a file located at `<fbtrack location>/USER_CONFIG.env`. Some of these values come from your Fitbit app details, and others are up to you.

The values once written to disk look like this (sensitive values have been removed):

```
STUDY_NAME=<YOUR STUDY NAME>
CLIENT_ID=<a 6-character string>
CLIENT_SECRET=<a 32-character string>
CALLBACK_URL=http://localhost:3000/store_subject_data
AUTH_URI=https://www.fitbit.com/oauth2/authorize
REFRESH_URI=https://api.fitbit.com/oauth2/token
SCOPE=heartrate activity sleep
WINDOW_SIZE=3
```


## Usage

To get information on specific `fbtrack` sub-commands, use the `-h` or `--help` flag, e.g. `fbtrack -h` or `fbtrack query -h`.

### Registering Participants

Run `fbtrack register` to register one or more participants.  This will open a web registration form running on your local machine at `http://localhost:3000`.
- Enter a participant id (`_` and `-` characters are currently not allowed).
- Set the date field to a specific start date in the future or past, or use the default date which is the current day.
- Finally, if you'd like to re-authorize a subject, you can check the 'reauthorize' box.  This will overwrite the database entry for that subject (but the existing data will remain).

### Querying data for one or more participants

#### Querying all active participants in the current window

Run `fbtrack query -a` to query for all active participants in a window of `WINDOW_SIZE` days prior to the current day up until the current day, where `WINDOW_SIZE` is a value configured by you upon installation via `npm`.  You can update this value by editing the `WINDOW_SIZE` value at `<fbtrack location>/USER_CONFIG.env`. 

#### Querying all active participants with a specific window size

Run `fbtrack query -a -w 20` to query for all active participants in a window of 20 days prior to the current day up until the current day.

#### Querying specific participants in the default window

Run `fbtrack query -p 001,002,003` to query participants  by their ids.  Make sure not to include spaces in the comma-separated list, as the shell will interpret those as separate commands.

#### Querying specific participants in a specific date range

Use the `-d` flag to query using the date range.  This is to be used instead of the `-w` window flag argument. For example: `fbtrack query -p 001,002,003 -d 2020-01-01..2020-02-05`.

#### Querying all participants in a specific date range

Run `fbtrack query -a -d 2020-01-01..2020-02-05`

#### Performance

To limit the number of simultaneous requests, which overloads fitbit's server and causes collection to fail, multi-participant queries are queued linearly by default. This can be slow for queries with many participants.  You can increase the query workload with the `-n` or `--chunk-size` flags.  The value you pass in for the chunk size will determine the number of concurrent participants.

Example: `fbtrack query -p 001,002,003,004,005 -w 3` will query each participant one at a time, while `fbtrack query -p 001,002,003,004,005 -w 3 -n 5` will query them all simultaneously.

If you get an `ECONNRESET` error, you are likely using too high of a chunk size. 
