const https = require('https');

const WEB3FORMS_KEY = '2c08edf6-2dcf-4c0f-893a-0a32ea871b97';

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body);

        // Honeypot: daca campul ascuns e completat, e un bot
        if (body.honeypot) {
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
        delete body.honeypot;

        body.access_key = WEB3FORMS_KEY;

        const result = await new Promise((resolve, reject) => {
            const postData = JSON.stringify(body);
            const options = {
                hostname: 'api.web3forms.com',
                path: '/submit',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error('Raspuns invalid Web3Forms')); }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });

        return { statusCode: 200, body: JSON.stringify(result) };

    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, message: err.message || 'Eroare server' }) };
    }
};
