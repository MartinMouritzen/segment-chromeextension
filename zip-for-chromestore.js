const fs = require('fs');
const archiver = require('archiver');

// Array of files to be added to the zip
const files = [
	'background.js',
	'background-service.js',
	'logo.png',
	'logo16.png',
	'logo32.png',
	'logo48.png',
	'logo64.png',
	'manifest.json',
	'popup.css',
	'popup.html',
	'popup.js'
];

// Create a file to stream archive data to
const output = fs.createWriteStream('segment-chromeextension.zip');
const archive = archiver('zip', {
	zlib: { level: 9 } // Sets the compression level
});

// Listen for all archive data to be written
output.on('close', () => {
	console.log('Archive: segment-chromeextension.zip, has been saved.');
	console.log(`${archive.pointer()} total bytes`);
});

// Good practice to catch warnings (e.g., stat failures and other non-blocking errors)
archive.on('warning', (err) => {
	if (err.code !== 'ENOENT') {
		throw err;
	}
});

// Good practice to catch this error explicitly
archive.on('error', (err) => {
	throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Append files from the array
files.forEach((file) => {
	archive.file(file, { name: file.split('/').pop() });
});

// Finalize the archive (i.e., we are done appending files but streams have to finish yet)
archive.finalize();