//Libraries used
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var fs = require('fs');

var bcrypt = require('bcryptjs');
const saltRounds = 12;
const usersalt = JSON.parse(fs.readFileSync('./salts.json', 'utf8')).usersalt;//Load salt for usernames from external file

const uuid = require('uuid/v4');

const SESSION_LENGTH = 20 * 60 * 1000;//minutes * seconds * milliseconds
const EXP_DATE = new Date(new Date().getTime() + SESSION_LENGTH); //5 minute session. change for actual use

//AWS set up. 
const AWS = require('aws-sdk');
AWS.config.loadFromPath('./aws-config.json');//Access Keys in ./aws-config.json need to be updated
var s3bucket = new AWS.S3({params:{Bucket:'demo-account-db'}});

var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(session({
    secret: 'login',
    resave: false,
    saveUninitialized: true,
}));

//Go to home page
app.get('/', function(req, res){
    //get any saved login credentials
    var cookie = req.cookies.aramuk_login_credentials;
    //if the user is still in session, load their data
    if(cookie != null){
        console.log("Welcome Home: ", cookie.sessionID);
        res.sendFile(path.join(__dirname + '/public/home.html'));
    }
    //else load default landing page
    else{
        console.log("Welcome New User!");
        res.sendFile(path.join(__dirname + '/public/index.html'));
    }
});

app.get('/test', function(req, res){
    res.sendFile(path.join(__dirname + '/public/test.html'));
});

app.get('/index.js', function(req, res){
    res.sendFile(path.join(__dirname + '/public/index.js'));
});

//Return stylesheets to front-end
app.get('/css/index.css', function(req, res){
    res.sendFile(path.join(__dirname + '/public/css/index.css'));
});

//Go to login page
app.get('/login', function(req, res){
    if(req.cookies.aramuk_login_credentials == null){
        res.sendFile(path.join(__dirname + "/public/login.html"));
    }
    else{
        res.redirect('/');
    }
});

//Logout by clearing any existing login credentials
app.get('/logout', function(req, res){
    res.clearCookie('aramuk_login_credentials');
    res.redirect('/');
});

//Go to sign up page
app.get('/signup', function(req, res){
    if(req.cookies.aramuk_login_credentials != null){
        res.redirect('/logout');
    }
    res.sendFile(path.join(__dirname + '/public/create_account.html'));
});

//Page where user can edit password, and data
app.get('/editaccount', function(req, res){
    fs.readFile('./public/edit-form.json', function(err, data){
        if(err){
            console.log("Error reading edit-form.json: ", err);
            res.status(500).send("Could not get permission to edit data");
        }
        res.json(JSON.parse(data).body);
    })
});

//Check account availability before account creation
app.get('/checkAvailability', function(req, res){
    encrypt(req.query.username + '.json', usersalt).then(function(hash){
        hash = hash.replace(new RegExp(/\//g), '$');//can't have slashes in the filename
        //Check to see if username exists by getting data for hashed username
        getAccountData(hash).then(function(data){
            if(data != null){
                res.json({available : false});
            }
            else{
                res.json({available : true});
            }
        });
    }).catch(function(error){
        console.log("Error: ", error);
        res.status(500).send("There was an error with our server, please try again later");
    });
});

//Endpoint where login credentials are sent from login screen
app.get('/verify', function(req ,res){
    encrypt(req.query.username + ".json", usersalt).then(function(hash){
        var hashedUName = hash.replace(new RegExp(/\//g), '$');//can't have slashes in the filename
        verifyPassword(hashedUName, req.query.pwd).then(function(success){
            if(success){
                //Create a session in the database if data verified
                createSessionID(hashedUName).then(function(session){
                    var options = {
                        httpOnly: true,
                        expires: EXP_DATE
                    }
                    res.cookie('aramuk_login_credentials', session, options);
                    console.log("Cookie created: ", session);
                    res.redirect('/');
                });
            }
            else{
                res.send("Login Failed");
            }
        });
    }).catch(function(error){
        console.log("Error Verifying Login Credentials: ", error);
        res.status(500).send("There was an error logging in. Please try again.");
    });   
});

//Endpoint for account creation
app.post('/create', function(req, res){
    encrypt(req.body.username + ".json", usersalt).then(function(hash){
        var hashedUName = hash.replace(new RegExp(/\//g), '$');//can't have slashes in the filename
        var acctData = {
            username: req.body.username,
            password: req.body.pwd,
            data: {}
        }
        //Create an account with the specified user data and username
        createAccount(hashedUName, acctData).then(function(success){
            if(success){
                console.log("Successfully Created Account");
                var httpUName = req.body.username.split('@');
                //Log the user in automatically following account creation
                res.redirect('/verify?username=' + httpUName[0] + '%40' + httpUName[1] + '&pwd=' + req.body.pwd);
            }
        });
    }).catch(function(error){
        console.log("Error Creating Account: ", error);
        res.status(500).send("There was an error creating your account. Please try again.");
    });
});

//Get user data except for username and password and return to front-end
app.get('/loadData', function(req, res){
    var cookies = req.cookies.aramuk_login_credentials;
    if(cookies != null){
        getAccountDataFromSession(cookies.sessionID).then(function(json){
            res.json(json.data);
        }).catch(function(error){
            console.log("Error Getting Account Data: ", error);
            res.status(500).send("There was an error retrieving your account information. Please try again.");
        });
    }
    else{
        res.redirect('/login');
    }
});

app.post('/update', function(req, res){
    var cookies = req.cookies.aramuk_login_credentials;
    if(cookies != null){
        getAccountDataFromSession(cookies.sessionID).then(function(userinfo){
            //Update user data
            userinfo.data = {
                fname: req.body.fname,
                lname: req.body.lname,
                bday: req.body.bday
            };

            var params = {
                Key: userinfo.hashedUName,
                ContentType: 'application/json',
                Body: JSON.stringify(userinfo)
            };

            s3bucket.upload(params, function(err){
                if(err){
                    res.status(500).send("There was an error updating your account info.")
                }
                else{
                    res.redirect('/')
                }
            });
        }).catch(function(error){
            console.log("Error Getting Account Data: ", error);
            res.status(500).send("There was an error retrieving your account information. Please try again.");
        });
    }
    else{
        res.redirect('/login');
    }
});

//Checks to see if account + password combination is valid and returns appropriate response
function verifyPassword(username, password){
    console.log("Starting Login: ", username);
    return new Promise(function(resolve, reject){
        getAccountData(username).then(function(data){
            //only proceed to verification if the account already exists
            if(data != null){
                var hashedpwd = data.password;
                //use bcrypt to compare the stored password with the supplied one
                bcrypt.compare(password, hashedpwd, function (err, res){
                    if(err){
                        reject(err);
                    }
                    else{
                        resolve(res);
                    }
                });
            }
            else{
                resolve("Invalid Username + Password Combination");
            }
        }).catch(function(err){
            reject(err);
        });
    });
}

//new account creation function: doesn't recheck for availability; asynchronously generates salt.
function createAccount(acctName, acctData){
    console.log("Creating account: ", acctData.username);
    return new Promise(function(resolve, reject){
        //Gerenate a salt for the password before creating an account
        bcrypt.genSalt(saltRounds, function(err, pwdSalt){
            if(err){
                reject(err);
            }
            else{
                //Encrypt password, then upload account data to database
                encrypt(acctData.password, pwdSalt).then(function(hashedPwd){
                    acctData.password = hashedPwd;
                    var params = {
                        Key: acctName,
                        ContentType: 'application/json',
                        Body: JSON.stringify(acctData)
                    };
                    //Upload account data to database
                    s3bucket.upload(params, function(err){
                        if(err){
                            reject(err);
                        }
                        else{
                            resolve(true);
                        }
                    });
                }).catch(function(err){
                    reject(err);
                });
            }
        });
    });
}

//Get account data from the database if it exists or return null if it doesn't
function getAccountData(uName){
    console.log("Searching for account: ", uName);
    return new Promise(function(resolve, reject){
        var params = {
            Key: uName
        }
        //Attempt to get corresponding account data
        s3bucket.getObject(params, function(err, data){
            if(err && err.code == 'NoSuchKey'){
                console.log("Account does not exist");
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

//Get account data from the database given a sessionID
function getAccountDataFromSession(sessionID){
    console.log("Getting account data from session:", sessionID);
    return new Promise(function(resolve, reject){
        //Get login credentials from session data, then get user data from login credentials
        getAccountData('sessions/' + sessionID).then(function(sessionCreds){
            var accountName = sessionCreds.username;
            getAccountData(accountName).then(function(userData){
                userData.hashedUName = accountName;
                resolve(userData);
            });
        }).catch(function(err){
            reject(err);
        });
    }); 
}

//bcrypt a string given a salt and return the value as a promise
function encrypt(text, salt){
    console.log("Encrypting Data");
    return new Promise(function(resolve, reject){
        bcrypt.hash(text, salt, function(err, hash){
            if(err){
                reject(err);
            }else{
                resolve(hash);
            }
        });
    });
}

//Create a session within the database that holds user data temporarily
function createSessionID(uName){
    console.log("Opening Session");
    return new Promise(function(resolve, reject){
        var id = uuid();
        var pwd = uuid();
        var data = {
            username: uName,
            password: pwd
        }
        params = {
            Key: 'sessions/' + id,
            ContentType: 'application/json',
            Body: JSON.stringify(data)
        }
        s3bucket.upload(params, function(err){
            if(err){
                reject(err);
            }
            else{
                session = {sessionID: id, password: pwd}
                resolve(session);
            }
        });
    });
}

//Run server @ IP if not running on localhost, else at port 8000
app.listen(process.env.PORT||8000, function(){
    console.log('Listening on port 8000'); 
});