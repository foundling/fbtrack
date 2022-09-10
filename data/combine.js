const fs = require('fs');
const { promisify } = require('util');

const readFileP = promisify(fs.readFile);
const writeFileP = promisify(fs.writeFile);
const readdirP = promisify(fs.readdir);

readdirP('./raw').then(async filenames => {

    const memo = {};

    return filenames.filter(filename => !filename.endsWith('.json') || filename === 'combined.json')
        .reduce(filename => {

            

            const [ userId, captureDate, metric, fileExtension ] = filename.split(/[_\.]/);

            if (! memo[ captureDate ] ) {
                memo[ captureDate ] = {};
            }

            const fileContent = await readFileP(`./raw/${filename}`, 'utf-8');
            const data = JSON.parse(fileContent);

            memo[ captureDate ][ metric ] = data;


        return memo;

        }, []);

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



