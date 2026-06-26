const http = require('http');

http.get('http://localhost:3000/api/claims/7f059eb5-2d79-4d8e-b37c-1f2e7a09bbb0', (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => { console.log(JSON.parse(data).data.ticket); });
}).on("error", (err) => { console.log("Error: " + err.message); });
