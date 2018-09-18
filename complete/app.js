var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');

var bcrypt = require('bcrypt');
const saltRounds = 12;

//AWS set up. 
const AWS = require('aws-sdk');
AWS.config.loadFromPath('./aws-config.json');//Access Keys in ./aws-config.json need to be updated
var S3 = new AWS.S3();
var s3bucket = new AWS.S3({params:{Bucket:'demo-account-db'}});

var app = express();
app.use(bodyParser.urlencoded({extended: true}));

//Go to home page (login)
app.get('/', function(req, res){
    res.sendFile(path.join(__dirname + '/index.html'));
});

//Go to sign up page
app.get('/sign_up', function(req, res){
    res.sendFile(path.join(__dirname + '/create_account.html'))
});

//Endpoint where login credentials are sent from login screen
app.get('/verify', function(req ,res){
    verifyPassword(req.query.username + ".json", req.query.pwd) .then(function(message){
        console.log(message);
        res.send(message);
    }).catch(function(error){
        console.log("Error Verifying Login Credentials: ", error);
        res.status(500).send("There was an error retrieving your account information. Please try again.");
    });   
});

//Checks to see if account + password combination is valid and returns appropriate response
function verifyPassword(username, password){
    console.log("Starting Login: ", username, password);
    return new Promise(function(resolve, reject){
        getAccountData(username).then(function(data){
            console.log("Data: ", data);
            if(data != null){
                var hashedpwd = data.pwd;
                bcrypt.compare(password, hashedpwd, function (err, res){
                    if(err){
                        reject(err);
                    }
                    if(res){
                        resolve("Success");
                    }
                    else{
                        resolve("Invalid Username + Password Combination");
                    }
                });
            }
            else{
                resolve("Invalid Username + Password Combination");
            }
        }).catch(function(error){
            reject(error);
        });
    });
}

//Endpoint for account creation
app.post('/create', function(req, res){
    createAccount(req.body.username + ".json", req.body.pwd).then(function(message){
        console.log(message);
        res.send(message);
    }).catch(function(error){
        console.log("Error Creating Account: ", error);
        res.status(500).send("There was an error creating your account. Please try again.");
    });
});

//Creates an account, if the username is not already taken.
function createAccount(username, password){
    console.log("Starting Account Creation", username, password);
    return new Promise(function(resolve, reject){
        getAccountData(username).then(function(data){
            console.log("Data: ", data);
            if(data != null){
                resolve("That username is taken");
            }
            else{
                encrypt(password).then(function(hash){
                    var params = {
                        Key: username,
                        ContentType: 'application/json',
                        Body: JSON.stringify({'pwd': hash})
                    }
                    console.log("Creating Account", params);
                    s3bucket.upload(params, function(err){
                        if(err) {
                            reject(err);
                        }
                        else{
                            resolve("Successfully created account");
                        }
                    });
                })
            }
        }).catch(function(error){
            reject(error);
        });
    });
}

function getAccountData(username){
    console.log("Checking account availability: ", username);
    return new Promise(function(resolve, reject){
        var params = {
            Key: username
        }
        s3bucket.getObject(params, function(err, data){
            if(err && err.code == 'NoSuchKey'){
                console.log("Account not found");
                resolve(null);
            }
            else if(err){
                reject(err);
            }
            else{
                console.log("Account found");
                resolve(JSON.parse(data.Body.toString()));
            }
        });
    });
}

function encrypt(text){
    console.log("Encrypting: ", text);
    return new Promise(function(resolve, reject){
        bcrypt.genSalt(saltRounds, function(err, salt){
            bcrypt.hash(text, salt, function(err, hash){
                if(err){
                    reject(err);
                }else{
                    resolve(hash);
                }
            });
            if(err){
                reject(err);
            }
        });
    });
}


app.listen(process.env.PORT||8000, function(){
    console.log('Listening on port 8000'); 
});