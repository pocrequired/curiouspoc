
/**
 * Module dependencies
 */

var fs = require('fs');
var express = require('express');
var mongoose = require('mongoose');
var passport = require('passport');
var config = require('config');
var OAuth = require('oauth');
var Twitter = require('twitter');
var nodemailer = require('nodemailer');
var _ = require('underscore');
var phone = require('phone');

var app = express();
var port = process.env.PORT || 5000;

var twitterKey = "secret";
var twitterSecret = "secret";
var token = "secret";
var secret = "secret";
var handle = "handle";
var gmailSender = "gmailaddy";
var gmailPassword = "secret";

// Connect to mongodb
var connect = function () {
  var options = { server: { socketOptions: { keepAlive: 1 } } };
  mongoose.connect(config.db, options);
};
connect();

mongoose.connection.on('error', console.log);
mongoose.connection.on('disconnected', connect);

// Bootstrap models
fs.readdirSync(__dirname + '/app/models').forEach(function (file) {
  if (~file.indexOf('.js')) require(__dirname + '/app/models/' + file);
});

// Bootstrap passport config
require('./config/passport')(passport, config);

// Bootstrap application settings
require('./config/express')(app, passport);

// Bootstrap routes
require('./config/routes')(app, passport);

var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: gmailSender,
        pass: gmailPassword 
    }
});

// setup e-mail data with unicode symbols
var mailOptions = {
    from: '<' + gmailSender + '>', // sender address
    to: '', // list of receivers
    subject: '', // Subject line
    text: 'To complete registration, send message - #validate 123456 as a Direct Message to ' + handle + '.' // plaintext body
};

// send mail with defined transport object


var client = new Twitter({
	consumer_key: twitterKey,
	consumer_secret: twitterSecret,
	access_token_key: token,
	access_token_secret: secret
});

client.stream('user', {}, function(stream) {
	stream.on('data', function(data) {
		if (data.direct_message) {
			var text = data.direct_message.text;
			if (text.indexOf('#reg') >= 0) {
				// try to parse out the phone number
				var rest = text.slice(text.indexOf('#reg') + 4).trim();
				var phoneNum = phone(rest, 'USA');
				if (phoneNum.length > 0) {
					// found a decent found number; send the reg text message
					phoneNum = phoneNum[0].slice(2);
					mailOptions.to = phoneNum + '@vtext.com, ' + phoneNum + '@txt.att.net';
					transporter.sendMail(mailOptions, function(error, info){
					    if(error){
					        console.log(error);
					    }else{
					        console.log('Message sent: ' + info.response);
					    }
					});
				}

				// send info via DM
				client.post('direct_messages/new', {
					user_id: data.direct_message.sender.id,
					text: 'To complete registration, send message - #validate <xxxxxx>. PIN has been sent to your registered mobile number. ' + new Date().getTime()
				}, function(error, tweet, response) {
					if (error) {
						console.log('Post error: ' + JSON.stringify(error));
					}
				});
			} else if (text.indexOf('#bal') >= 0) {
				// assume the validation succeeds for demo purposes
				client.post('direct_messages/new', {
					user_id: data.direct_message.sender.id,
					text: 'Your account balance is $12,345.67. ' +  new Date().getTime()
				}, function(error) {
					if (error) {
						console.log('Post error: ' + JSON.stringify(error));
					}
				});
			} else if (text.indexOf('#validate') >= 0) {
				// assume the validation succeeds for demo purposes
				client.post('direct_messages/new', {
					user_id: data.direct_message.sender.id,
					text: 'You are successfully registered with ' + handle '. Send #bal to check your account balance. ' +  new Date().getTime()
				}, function(error) {
					if (error) {
						console.log('Post error: ' + JSON.stringify(error));
					}
				});
			}
		}
	});

	stream.on('follow', function(follow) {
		console.log(follow);
	});
	stream.on('user_update', function(update) {
		console.log(update);
	});
	stream.on('error', function(error) {
		throw error;
	});	
});

app.listen(port);
console.log('Express app started on port ' + port);
