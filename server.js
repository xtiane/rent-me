require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const keys = require('./config/keys');
const PlaceAutocomplete = require('googleplaces/lib/PlaceAutocomplete');
const Zillow = require('node-zillow');
const nodemailer = require('nodemailer');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

app.get('/api/autocomplete/:address', (req, res) => {
  let placeAutocomplete = new PlaceAutocomplete(keys.googlePlacesApiKey, 'json');

  let parameters = {
      input: req.params.address,
      types: 'address'
  };

  placeAutocomplete(parameters, function (error, response) {
      if (error) throw error;

      res.json(response);
  });
});

app.get('/api/rent-zestimate', (req, res) => {
  // Zillow API docs:  https://www.zillow.com/howto/api/GetSearchResults.htm
  let zillow = new Zillow(keys.zillowApiKey);
  let parameters = {
    address: req.query.address,
    citystatezip: req.query.cityStateZip,
    rentzestimate: true
  };

  zillow.get('GetSearchResults', parameters)
  .then( zillowResults => {
    res.json(zillowResults);
  })
  .catch( error => {
    res.status(500).json(error);
  })
});

app.post('/api/send-email', (req, res) => {
  try {
    // Check if keys have been populated
    if(!keys.emailHost || !keys.emailPort || !keys.emailUser || !keys.emailPassword) {
      throw 'One or more required values for sending email are missing!  Check your keys.js file!';
    }

    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
      host: keys.emailHost,
      port: keys.emailPort,
      auth: {
      user: keys.emailUser,
      pass: keys.emailPassword
      },
      tls: {
          rejectUnauthorized: false
      }
    });

    // Get IP address
    const userIP = req.header('X-Forwarded-For') || req.connection.remoteAddress;

    // setup email data with unicode symbols
    let mailOptions = {
        from: keys.emailSenderAddress, // sender address
        to: req.body.email, // list of receivers
        subject: 'Thank you for signing up!', // Subject line
        text: '',
        html: `<div>
          <p>Congratulations ${req.body.firstName}!</p>
          <p>You have successfully signed up.  Below are the details you have provided</p>
          <br />
          <table style='background-color: #FAEBD7; box-shadow: 10px 10px 5px grey;'>
            <tr>
              <td><th style='text-decoration: underline;'>Personal Data</th></td>
            </tr>
            <tr>
              <td>First Name:</td>
              <td>${req.body.firstName}</td>
            </tr>
            <tr>
              <td>Last Name:</td>
              <td>${req.body.lastName}</td>
            </tr>
            <tr>
              <td>Email:</td>
              <td>${req.body.email}</td>
            </tr>
            <tr>
              <td>Phone:</td>
              <td>${req.body.phone}</td>
            </tr>
            <tr colspan='2'>
              <td><th style='text-decoration: underline;'>Rent Valuation Range</th><td>
            </tr>
            <tr colspan='2'>
              <td>Address:</td>
              <td>${req.body.address}</td>
            </tr>
            <tr colspan='2'>
              <td>Low:</td>
              <td style='padding: 0'>$${req.body.range.low.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              <td>High:</td>
              <td style='padding: 0'>$${req.body.range.high.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            </tr>
            <tr>
              <td>Expected Rent:</td>
              <td>$${req.body.rent.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            </tr>
            <tr></tr>
            <tr colspan='2'>
              <td>IP Address:</td>
              <td>${userIP}</td>
            </tr>
          </table>
        </div>`
        
        
        //${userIP} ${req.body.firstName} ${req.body.lastName} ${req.body.phone} ${req.body.email}</div>` // html body
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error(error);
          res.status(500).json(error);
        }
        
        let success = {
          'messageSuccess': true,
          'messageId': info.messageId
        }
        res.status(200).json(success);
    });
  } 
  catch (error) {
    console.error(error);
    res.status(500).json(error);
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname + '/client/build/index.html'));
});

//const port = process.env.PORT || 5000;

module.exports = app;