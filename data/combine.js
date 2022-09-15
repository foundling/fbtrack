const fs = require('fs');
const { promisify } = require('util');

const readFileP = promisify(fs.readFile);
const writeFileP = promisify(fs.writeFile);
const readdirP = promisify(fs.readdir);

readdirP('./raw').then(async filenames => {

    const memo = {};

    for (let filename of filenames) {

        if (!(filename.endsWith('.json') && !filename.startsWith('combined')))
            continue;

        const [ userId, captureDate, metric, fileExtension ] = filename.split(/[_\.]/);


        try {

            const fileContent = await readFileP(`./raw/${filename}`, 'utf-8');
            const data = JSON.parse(fileContent);

            if (!memo[captureDate]) {
                memo[captureDate] = {};
            }
            memo[captureDate][metric] = data;

        } catch (e) {
            throw e;
        }
    }

    return memo;

})
.then(async combined => {
    await writeFileP('./raw/combined.json', JSON.stringify(combined, null, 4))
})
.then(() => {
    console.log('combination complete! file written to: raw/combined.json');
})
.catch(e => {
    console.log('combine.js failed: ', e.message);
    console.log('combination failed!', e);
});



