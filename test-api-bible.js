const https = require('https');
const options = {
  hostname: 'api.scripture.api.bible',
  path: '/v1/bibles',
  method: 'GET',
  headers: {
    'api-key': 'I8LpaQ_H2CEc1BTNLIXj8'
  }
};
const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log(parsed.data.filter(b => b.language.id === 'eng').slice(0, 5).map(b => `${b.id} : ${b.name}`));
    } catch(e) { console.error(e); }
  });
});
req.on('error', e => console.error(e));
req.end();
