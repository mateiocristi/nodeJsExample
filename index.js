const express = require('express');
const app = express();
const PORT = 8080;
let ids = [];
let authObj = {};

var bodyParser = require('body-parser');

app.use(bodyParser.text({ type: 'text/csv' }));
app.use(express.json());

app.post('/medic', (req, res) => {

    const authHeader = req.headers['x-vamf-jwt'];
    
    decodeAuth(authHeader);
    if (!isValidAuth()) {
        res.status(401).send('Unauthorised')
        return;
    };
    
    if (req.headers['content-type'] === 'application/json') {
        processJson(req.body, res);
        return;
    }
    
    if (req.headers['content-type'] === 'text/csv') {
        processCSV(req.body, res);
        return;
    }

    res.status(400).send()
    
});

app.listen(
    PORT, 
    () => console.log('app is live')
);

function processJson(medic, res) {
    console.log('medic: ' + medic.resourceType);
    if (medic.id === undefined || medic.resourceType !== 'Practitioner') {
        res.status(400).send('Invalid resource');
        return;
    }

    if (ids.includes(medic.id)) {
        console.log("ids ", ids);
        res.status(400).send('Repeating id');
        return;
    }

    if (medic.active) {
    
        console.log('name: ' + medic.name);
        console.log('facility: ' + medic.facility);
    }

    ids.push(medic.id);
    res.status(200).send();
}


function processCSV(file, res) {
    
    let practitioners = [];
    let lines = file.split(/\r?\n/);

    if (lines[0] !== 'ID, FamilyName, GivenName, FacilityId, SystemId, NameId, Active') {
        res.status(400).send('Invalid csv file');
    }
    lines.shift();

    lines.filter(line => {
        let items = line.split(', ');
        if (!authObj.facility.includes(items[3])) {
            return false
        } 
        return true;
        
    }).forEach(line => {
        let items = line.split(', ');
        let practitioner = {
            resourceType: "Practitioner",
            id: items[0],
            name: items[1] + ' ' + items[2],
            facility: {
                value: items[3],
                system: items[4],
                name: items[5]
            },
            active: items[6]

        }
        practitioners.push(practitioner);
    })
    
    const groupedMap = practitioners.reduce(
        (entryMap, doctor) => entryMap.set(doctor.name, [...entryMap.get(doctor.name)||[], {...doctor.facility, active: doctor.active}]),
        new Map()
    );

    for (key of groupedMap.keys()) {
        let line = key + ':';
        let OK = false;
        for (item of groupedMap.get(key)) {
            if (item.active === 'false') {
                groupedMap.get(key).splice(groupedMap.get(key).indexOf(item), 1)
            } else {
                OK = true;
                line += ' ' + item.name + ',';
            }
        }
        if (OK) {
            line = line.slice(0, -1);
            console.log(line);
        }
    }
    
    res.status(200).send();
}

function decodeAuth(authString) {
    const buffer = Buffer.from(authString, 'base64');
    const str = buffer.toString('utf-8') 
    authObj = JSON.parse(str);
    console.log('authObj ', authObj);
}

function isValidAuth(req) {
    if (!authObj.roles.includes('Admin') || authObj.roles.includes('Practitioner')) {
        return false;
    }
    return true;
}

  