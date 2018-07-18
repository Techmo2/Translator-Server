'use strict';

var fs = require('fs');
var https = require('https');
var express = require('express');
var http = require('http').Server(app);
var bodyParser = require('body-parser');
var app = express();

// Load the config file
var config = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8'));

// Configure express to use body-parser as middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var host = 'api.cognitive.microsofttranslator.com';
var path = '/translate?api-version=3.0';
//var params = '&to=it';

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

let get_guid = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

let Translate = function (content, params, response_handler) {
    let request_params = {
        method: 'POST',
        hostname: host,
        path: path + params,
        headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': config.key,
            'X-ClientTraceId': get_guid(),
        }
    };

    let req = https.request(request_params, response_handler);
    req.write(content);
    req.end();
}

// Translate(JSON.stringify([{ 'Text': text }]), '&to=' + lang, response_handler);

app.post('/translate', function (request, res) {
    var id = request.body.id;
    var text = request.body.text;
    var lang = request.body.language;

    console.log('processing request: \n' + JSON.stringify(request.body, null, 4));
    console.log('Language: "' + lang + '"');
    console.log('Text: "' + text + '"');

    var response_handler = function (response) {
        var body = '';
        response.on('data', function (d) {
            body += d;
        });
        response.on('end', function () {
            var json = JSON.parse(body);
            console.log('recieved translation from microsoft: \n' + JSON.stringify(json, null, 4));
            res.json(json);
            res.end();
        });
        response.on('error', function (e) {
            console.log('Error: ' + e.message);
            res.send('error');
            res.end();
        });
    };

    Translate(JSON.stringify([{ 'Text': text }]), '&to=' + lang, response_handler);
});

http.listen(config.port, function () {
    console.log('Azure api listening on port ' + config.port);
});

app.listen(1313, function () {
    console.log('Translator listening on port 1313');
});