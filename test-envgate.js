const https = require('https');
const options = {
  hostname: 'servicedesk.perkom.co.id',
  path: '/api/v1/requests/32452',
  method: 'GET',
  headers: {
    'Authorization': 'Basic U1lTVEVNOjFudkdBdGUyMDI0IQ==',
    'Accept': 'application/json'
  }
};
const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(JSON.stringify(JSON.parse(data), null, 2)));
});
req.on('error', e => console.error(e));
req.end();
