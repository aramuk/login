# Login
A basic end-to-end user authentication system, built largely from scratch.

## Current features
Security
* `bcrypt` user data hashing
* Username and password salting
* AWS credentials stored in separtate location from server
* Decryption-free password verification
* Password strength rules (at least: 8 long, 1 #, 1 uppercase, 1 lowercase, 1 special character)
* Cookie time-out for limited access

Front-End
* Efficient site navigation
* Pre-submit form data validation

## Further Details
The server is built using an `express.js` framework, which connects to an AWS S3 database, where all user data is stored. `bcrypt` is used as the salting and hashing algorithm. The front-end is built ground up using HTML, CSS, and javascript (including JQuery and JQuery Validation libraries). 

## Disclaimer
Random user data was generated for this project. It was not intended to imitate any
person living or dead.