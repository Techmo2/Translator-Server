'use strict';

var fs = require('fs');
var https = require('https');
var express = require('express');
var http = require('http').Server(app);
var bodyParser = require('body-parser');
var app = express();
var uuid = require('uuid/v4');

var connected_servers = [];
var config = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8'));
var host = 'api.cognitive.microsofttranslator.com';
var path = '/translate?api-version=3.0';

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

function Server(_id, _uuid) {
    this.id = _id;
    this.uuid = _uuid;
}

function IsValidRequest(_id, _key) {
    var valid = false;
    connected_servers.forEach(function (server) {
	console.log(_id);
	console.log(server.id);
	console.log(_key);
	console.log(server.uuid);
        if (server.id == _id && server.uuid == _key) {
            valid = true;
        }
    });
    return valid;
}

// Dummy index page in case someone decides to visit this server with a web browser.
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

// GUID generator to use for the azure api
var get_guid = function () {
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
            'Ocp-Apim-Subscription-Key': config.api_key,
            'X-ClientTraceId': get_guid(),
        }
    };

    let req = https.request(request_params, response_handler);
    req.write(content);
    req.end();
}

// The translation api, post requests are sent here by the clients to get translations
app.post('/translate', function (request, res) {

    if (IsValidRequest(request.body.id, request.body.key)) {

        if (config.verbose) {
            console.log('processing request: \n' + JSON.stringify(request.body, null, 4));
            console.log('Language: "' + request.body.to + '"');
            console.log('Text: "' + request.body.text + '"');
            if (request.body.auto == "1") {
                console.log('Origional Language: "' + request.body.from + '"');
            }
            else {
                console.log('Origional Language: AUTO');
            }
        }

        var response_handler = function (response) {
            var body = '';
            response.on('data', function (d) {
                body += d;
            });
            response.on('end', function () {
                var json = JSON.parse(body);
                if (config.verbose)
                    console.log('recieved translation from microsoft: \n' + JSON.stringify(json, null, 4));
                res.json(json);
                res.end();
            });
            response.on('error', function (e) {
                if (config.verbose)
                    console.log('Error: ' + e.message);
                res.send('error');
                res.end();
            });
        };

        if (request.body.auto == "1") {
            Translate(JSON.stringify([{ 'Text': request.body.text }]), '&to=' + request.body.to, response_handler);
        }
        else {
            Translate(JSON.stringify([{ 'Text': request.body.text }]), '&from=' + request.body.from + '&to=' + request.body.to, response_handler);
        }
    }
    else {
        if (config.verbose) {
            console.log("Failed translation");
            console.log("id: " + request.body.id);
            console.log("key: " + request.body.key);
            console.log("text: " + request.body.text);
            console.log("lang_to: " + request.body.to);
            console.log("lang_from: " + request.body.from);
            console.log("auto: " + request.body.auto);
        }
        res.json({ error: "Invalid key or id" });
        res.end();
    }
});

app.post('/authenticate', function (request, res) {

    var id = request.body.id;
    var ip_addr = request.header('x-forwarded-for') || request.connection.remoteAddress;

    if (id != null) {
        var exists = -1;
        connected_servers.forEach(function (server) {
            if (server.id == id) {
                exists = connected_servers.indexOf(server);
            }
        });

        // Remove the server if it exists
        if (exists >= 0) {
            connected_servers.splice(exists, 1);
        }

        // Generate a uuid for the server and add the server to the list
        let _key = uuid();
        connected_servers.push(new Server(id, _key)); 

        // Send the uuid to the server
        res.json({ key: _key });
        res.end();

        if (config.verbose) {
	    var type = "INITIAL";
	    if(exists > -1){
		type = "RENEW";
	    }
            console.log('Registered server');
	    console.log('Type: ' + type);
            console.log('Name: ' + id);
            console.log('UUID: ' + _key);
	    console.log('IP: ' + ip_addr + '\n');
        }
    }
    else {
        res.json({ error: "No id provided" });
        res.end();
    }
});

http.listen(config.azure_port, function () {
    console.log('Azure api listening on port ' + config.azure_port);
});

app.listen(config.translator_port, function () {
    console.log('Translator listening on port ' + config.translator_port);
});






