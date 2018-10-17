# Login
A basic end-to-end user authentication system, built largely from scratch.

## Current features
A list of all the security features I have implemented in this project
* `bcrypt` user data hashing
* Username and password salting
* AWS credentials stored in separtate location from server
* Decryption-free password verification
* Password strength rules (at least: 8 long, 1 #, 1 uppercase, 1 lowercase, 1 special character)
* Logging in opens a temporary session on the database
* Cookie placed only contains session credentials
* No encryption keys or user data stored on server
* Pre-submit form data validation
* Cookie expiration for limited access


### Back-End
**`bcrypt` hashing**
It is important that all the data is hashed before it is stored in the database. This
helps protect user information if any data is leaked from the database in an attack.
Hashing user data means that even if data is leaked, it is of little value as it must 
first be decrypted before the hacker can learn the user data.

There are many nuances to a hashing algorithm, and I do not expect to be able to write a safe hashing algorithm on my own at the current time, so I opted into using `bcrypt`.
`bcrypt` is a common hashing algorithm due to its strength. The `bcrypt` allows users to specify the strength of the encryption by specifying the "Salt Rounds". `bcrypt` asyncrhonously generates hashes, which makes it more resistant to timing-based attacks.

### Front-End

## Further Details
The server is built using an `express.js` framework, which connects to an AWS S3 database, where all user data is stored. `bcrypt` is used as the salting and hashing algorithm. The front-end is built from the ground up using HTML, CSS, and javascript (including JQuery and JQuery Validation libraries). 
