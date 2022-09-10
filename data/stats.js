const fs = require('fs');
const { promisify } = require('util');

const readFileP = promisify(fs.readFile);
const getRestingHeartRate = (d) => {
    return d['activities-heartrate']?.['activities-heart']?.[0]?.value?.restingHeartRate
};

const restingHeartRateExceeds = bpm => d => {
    const hr = getRestingHeartRate(d);
    return hr ? (hr >= bpm) : false; 
}

const dateInWindow = (startDate, endDate) => d => new Date(d) >= new Date(startDate) && new Date(d) <= new Date(endDate)
const startDate = '2022-08-01'
const endDate = '2022-09-04'

const getHROver = (bpm) => {
    return {
        forDateRange: (startDate, endDate) => (data) => {
            return Object.entries(data).filter(([dateString, dataForDate]) => dateInWindow(startDate, endDate)(dateString))
                .filter(([dateString, dataForDate]) => restingHeartRateExceeds(bpm)(dataForDate))
                .map(([dateString, dataForDate]) => `${dateString}: ${getRestingHeartRate(dataForDate)} bpm`);
        }
    }
}
const getAverageForDateRange = (startDate, endDate) => (data) => {
    const datesSorted = Object.keys(data)
        .map(d => new Date(d))
        .sort((a,b) => a - b)


    const restingHeartRates = Object.entries(data).filter(([k, v]) => dateInWindow(startDate, endDate))
        .map(([key, value]) => getRestingHeartRate(value))
        .filter(Boolean);

    const avgHeartRates = restingHeartRates.reduce((a,b) => a + b, 0) / restingHeartRates.length;

    return {
        startDate,
        endDate,
        avg: avgHeartRates,
        restingHeartRates,
    };

};

readFileP('./raw/combined.json', 'utf-8')
.then(JSON.parse)
//.then(getAverageForDateRange(startDate, endDate))
.then(getHROver(89).forDateRange(startDate, endDate))
.then(console.log)
.catch(e => {
    throw e;
});



