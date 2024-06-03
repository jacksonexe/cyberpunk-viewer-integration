const express = require('express');
const open = require('open');


let oAuth2Client = undefined;

const server = express();
server.get('/callback', async (req, response) => {
  const { code } = req.query;
  const r = await oAuth2Client.getToken(code);
  // Make sure to set the credentials on the OAuth2 client.
  oAuth2Client.setCredentials(r.tokens);
  console.info('Tokens acquired.');
});

const initYoutube = async () => {
  /*oAuth2Client = new OAuth2Client(
    config.youtubeCredentials.clientId,
    config.youtubeCredentials.clientSecret,
    "http://localhost:3000/callback"
  );

  // Generate the url that will be used for the consent dialog.
  const authorizeUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/userinfo.profile',
  });
  open(authorizeUrl, {wait: false}).then(cp => cp.unref());*/
}

server.listen(3000, function() {
    console.log('Server is Ready');
    if(config.youtubeCredentials !== undefined){
      initYoutube();
    }
  });