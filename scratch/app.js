var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

var bcrypt = require('bcrypt');
const saltRounds = 12;
const usersalt = "$2b$12$Blj9eNPAVPi5J2wAXwFDp."

//AWS set up. 
const AWS = require('aws-sdk');
AWS.config.loadFromPath('./aws-config.json');//Access Keys in ./aws-config.json need to be updated
var S3 = new AWS.S3();
var s3bucket = new AWS.S3({params:{Bucket:'demo-account-db'}});

var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());

//Go to home page
app.get('/', function(req, res){
    //get any saved login credentials
    var cookies = req.cookies.aramuk_login_credentials;

    //if the user's is still in session, load their data
    if(cookies != null){
        console.log("Welcome Home: ", cookies.username);
        res.sendFile(path.join(__dirname + '/public/home.html'));
    }
    //else load default landing page
    else{
        console.log("Welcome New User!");
        res.sendFile(path.join(__dirname + '/public/index.html'));
    }
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
        //I suppose the login button needs to disappear at some point but this should disable it for now
        res.send("Logout first before you login");
    }
});

//Logout by clearing any existing login credentials
app.get('/logout', function(req, res){
    res.clearCookie('aramuk_login_credentials');
    res.redirect('/');
});

//Go to sign up page
app.get('/sign_up', function(req, res){
    if(req.cookies.aramuk_login_credentials != null){
        console.log("Create a new account?");
    }
    res.sendFile(path.join(__dirname + '/public/create_account.html'));
});

//Page where user can edit password, and data
app.get('/edit', function(req, res){
    if(req.cookies.aramuk_login_credentials != null){
        res.send('Edit your profile here');
    }
    else{
        res.send('Please login again to continue');
    }
});

//Check account availability before account creation
app.get('/checkAvailability', function(req, res){
    encrypt(req.query.username + '.json', usersalt).then(function(hash){
        hash = hash.replace(new RegExp(/\//g), '$');//can't have slashes in the filename
        getAccountData(hash).then(function(data){
            if(data != null){
                res.json({available : false});
            }
            else{
                res.json({available : true});
            }
        });
    }).catch(function(err){
        console.log("Error: ", err);
        res.status(500).send("There was an error with our server, please try again later");
    });
});


//Endpoint where login credentials are sent from login screen
app.get('/verify', function(req ,res){
    encrypt(req.query.username + ".json", usersalt).then(function(hash){
        var hashedUName = hash.replace(new RegExp(/\//g), '$');//can't have slashes in the filename
        verifyPassword(hashedUName, req.query.pwd).then(function(success){
            if(success){
                var options = {
                    httpOnly: true,
                    maxAge: 1000 * 60 * 1 //login key lasts for 1 min; increase for actual use
                }
                var credentials = {username: hashedUName};
                res.cookie('aramuk_login_credentials', credentials, options);
                console.log("Cookie created");
            }
            res.json({verified: success});
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
        createAccount(req.body.username, hashedUName, req.body.pwd).then(function(message){
            console.log(message);
            var httpUName = req.body.username.split('@')
            res.redirect('/verify?username=' + httpUName[0] + '%40' + httpUName[1] + '&pwd=' + req.body.pwd);
        })
    }).catch(function(error){
        console.log("Error Creating Account: ", error);
        res.status(500).send("There was an error creating your account. Please try again.");
    });
});

//Get user data except for username and password and return to front-end
app.get('/loadData', function(req, res){
    var cookies = req.cookies.aramuk_login_credentials;
    if(cookies != null){
        console.log(cookies.username);
        getAccountData(cookies.username).then(function(json){
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
        var uName = cookies.username;
        getAccountData(uName).then(function(json){
            json.data = req.body.data;
            var params = {
                Key: uName,
                Body: JSON.stringify(json)
            }
            s3bucket.putObject(params, function(err){
                if(err){
                    res.status(500).send('uh oh');
                }
                else{
                    res.send('success');
                }
            })
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
    console.log("Starting Login: ", username, password);
    return new Promise(function(resolve, reject){
        getAccountData(username).then(function(data){
            console.log("Data: ", data);
            //only proceed to verification if the account already exists
            if(data != null){
                var hashedpwd = data.pwd;
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
        }).catch(function(error){
            reject(error);
        });
    });
}

//Creates an account, if the username is not already taken.
function createAccount(uName, hashedUName, password){
    console.log("Starting Account Creation", uName, password);
    return new Promise(function(resolve, reject){
        getAccountData(hashedUName).then(function(data){
            console.log("Data: ", data);
            if(data != null){
                resolve("That username is taken");
            }
            //only if account name is not taken, proceed with account creation.
            else{
                var pwdsalt = bcrypt.genSaltSync(saltRounds);
                encrypt(password, pwdsalt).then(function(hash){
                    //Generate fake user data for now
                    getDummyData().then(function(json){
                        var params = {
                            Key: hashedUName,
                            ContentType: 'application/json',
                            Body: JSON.stringify({
                                username: uName,
                                pwd: hash,
                                data: json
                            })
                        }
                        console.log("Creating Account", params);
                        s3bucket.upload(params, function(err){
                            if(err){
                                reject(err);
                            }
                            else{
                                resolve("Successfully created account");
                            }
                        });
                    });
                });
            }
        }).catch(function(error){
            reject(error);
        });
    });
}

//new account creation function: doesn't recheck for availability; asynchronously generates salt.
function createAcct(acctName, acctData){
    console.log("Creating account: ", acctData.username);
    return new Promise(function(resolve, reject){
        bcrypt.genSalt(saltRounds, function(err, pwdSalt){
            if(err){
                reject(err);
            }
            else{
                encrypt(acctData.password, pwdSalt).then(function(hashedPwd){
                    acctData.password = hashedPwd;
                    var params = {
                        Key: acctName,
                        ContentType: 'application/json',
                        Body: acctData
                    };
                    console.log("Creating Account", params);
                    s3bucket.upload(params, function(err){
                        if(err){
                            reject(err);
                        }
                        else{
                            resolve("Successfully created account");
                        }
                    });
                }).catch(function(error){
                    reject(err);
                });
            }
        });
    });
}

//Get account data from the database if it exists, else return null
function getAccountData(uName){
    console.log("Searching for account: ", uName);
    return new Promise(function(resolve, reject){
        var params = {
            Key: uName
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

//bcrypt a string given a salt and return the value as a promise
function encrypt(text, salt){
    console.log("Encrypting: ", text);
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

function getDummyData(){
    return new Promise(function(resolve, reject){
        var num = Math.floor(Math.random() * 3);
        var filename = 'dummy-account/test' + num + '.json';
        var params = {
            Key: filename
        }
        s3bucket.getObject(params, function(err, data){
            if(err){
                reject(err);
            }
            else{
                resolve(JSON.parse(data.Body.toString()));
            }
        });
    });
}

//Run server @ IP if not running on localhost, else at port 8000
app.listen(process.env.PORT||8000, function(){
    console.log('Listening on port 8000'); 
});