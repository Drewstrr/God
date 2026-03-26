exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body);

        // Honeypot: daca campul e completat, e un bot - raspundem fals OK
        if (body.honeypot) {
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
        delete body.honeypot;

        // Cheia se adauga doar server-side, nu e vizibila in browser
        body.access_key = process.env.WEB3FORMS_KEY;

        const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        return { statusCode: 200, body: JSON.stringify(data) };

    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Eroare server' }) };
    }
};
