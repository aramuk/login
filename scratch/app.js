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
        console.log("Welcome Home: ", cookies.username);//placeholder
        res.sendFile(path.join(__dirname + '/public/home.html'));
    }
    //else load default landing page
    else{
        console.log("Welcome New User!");//placeholder
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

app.get('/logout', function(req, res){
    res.clearCookie('aramuk_login_credentials');
    res.redirect('/')
});

//Go to sign up page
app.get('/sign_up', function(req, res){
    if(req.cookies.aramuk_login_credentials != null){
        console.log("Create a new account?");
    }
    res.sendFile(path.join(__dirname + '/public/create_account.html'))
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
        username = hash.replace(new RegExp(/\//g), '$');//can't have slashes in the filename
        verifyPassword(username, req.query.pwd).then(function(success){
            if(success){
                var options = {
                    httpOnly: true,
                    maxAge: 1000 * 60 * 1 //login key lasts for 1 min; increase for actual use
                }
                var credentials = {username: username};
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

app.get('/loadData', function(req, res){
    if(req.cookies.aramuk_login_credentials != null){
        console.log(req.cookies.aramuk_login_credentials.username);
        getAccountData(req.cookies.aramuk_login_credentials.username).then(function(json){
            console.log(json.data);
            res.json(json.data);
        }).catch(function(error){
            console.log("Error: ", error);
            res.status(500).send("There was an error retrieving your account information. Please try again.");
        });
    }
    else{
        res.send('Please login first');
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

//Endpoint for account creation
app.post('/create', function(req, res){
    encrypt(req.body.username + ".json", usersalt).then(function(hash){
        username = hash.replace(new RegExp(/\//g), '$');//can't have slashes in the filename
        createAccount(req.body.username, username, req.body.pwd).then(function(message){
            console.log(message);
            var httpUName = req.body.username.split('@')
            res.redirect('/verify?username=' + httpUName[0] + '%40' + httpUName[1] + '&pwd=' + req.body.pwd);
        })
    }).catch(function(error){
        console.log("Error Creating Account: ", error);
        res.status(500).send("There was an error creating your account. Please try again.");
    });
});

//Creates an account, if the username is not already taken.
function createAccount(username, hashedName, password){
    console.log("Starting Account Creation", username, password);
    return new Promise(function(resolve, reject){
        getAccountData(hashedName).then(function(data){
            console.log("Data: ", data);
            if(data != null){
                resolve("That username is taken");
            }
            //only if account name is not taken, proceed with account creation.
            else{
                var pwdsalt = bcrypt.genSaltSync(saltRounds);
                encrypt(password, pwdsalt).then(function(hash){
                    var params = {
                        Key: hashedName,
                        ContentType: 'application/json',
                        Body: JSON.stringify({
                            username: username,
                            pwd: hash,
                            data: getDummyData()
                        })
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
                });
            }
        }).catch(function(error){
            reject(error);
        });
    });
}

//Get account data from the database if it exists, else return null
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
    var user = Math.floor(Math.random() * 3);
    if(user == 1){
        return {
            fname: 'Roger',
            lname: 'Kimball',
            birthday: 'November 27, 1940',
            age: 77,
            details: {}
        }
    }
    else if(user == 2){
        return {
            fname: 'Johnnie',
            lname: 'Healy',
            birthday: 'July 6, 1940',
            age: 78,
            details: {}
        }
    }
    else{
        return {
            fname: 'Dawn',
            lname: 'Garcia',
            birthday: 'October 8, 1993',
            age: 24,
            details: {}
        }
    }
}

//Run server @ IP if not running on localhost, else at port 8000
app.listen(process.env.PORT||8000, function(){
    console.log('Listening on port 8000'); 
});