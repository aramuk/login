# Login
A basic end-to-end user authentication system, built largely from scratch.

## Current features
A list of all the security features I have implemented in this project
* `bcrypt` user data hashing
* Username and password salting
* Decryption-free password verification
* AWS credentials stored in separtate location from server
* Password strength rules (at least: 8 long, 1 #, 1 uppercase, 1 lowercase, 1 special character)
* Logging in opens a temporary session on the database
* Cookie placed only contains session credentials
* No encryption keys or user data stored on server
* Pre-submit form data validation
* Cookie expiration for limited access


**Password Strength Rules:**
Password strength is important when discussing how to protect user data. If the data is leaked in any form from the database, the hacker will attempt to use some algorithm to try to decrypt the hash. A stronger password will delay that algorithm long enough that you may have the opportunity to change it and keep your data secure.

Password length makes decryption by brute force considerably harder, as the number of character combinations increases exponentially with each additional character. 

Password complexity rules (1 uppercase, 1 lowercase, etc.) discourage common phrases and words that a smarter hacker might check for when attempting to decrypt your password.

**Encryption:**
It is important that all the data is encrypted before it is stored in the database. This helps protect user information if any data is leaked from the database in an attack. Encrypting user data means that even if data is leaked, it is of little value as it must first be decrypted before the hacker can learn the user data.

Encryption algorithms are an extremely dense topic, but at their core share two common features in modern cybersecurity: hashing and salting. _Hashing_ uses a specific function to scramble and reexpress a simple value as a complex string. This string does not contain any raw user data, but is rather a highly incoherent representation of it. This means that if the hashed value is leaked at any point, the data is of little value until it is decrypted. _Salting_ is the other main component of encryption. To increase the difficulty of decrypting a hash, a random string value is added to the data before it is encrypted. This means that a potential attacker will have little success if they try to crack a hashing algorithm by trying common phrases and patterns.

**`bcrypt`:**
There are many nuances to a hashing algorithm, and I do not expect to be able to write a safe hashing algorithm on my own at the current time. As a result, I opted into using the `bcrypt` libary to take care of the hashing.

`bcrypt` can implement both salting and hashing, which for reasons listed above is quite helpful. `bcrypt` asyncrhonously generates hashes, which makes it more resistant to timing-based attacks. `bcrypt` also compares hashes to plaintext passwords without decrypting anything, so nowhere along the way is the user's data exposed.

**AWS setup:**
This application stores data on the AWS S3 database. The server gains access to the bucket through IAM credentials. This means that the server does not have root access to the database and if the credentials are leaked, then they can be wiped and regenerated. Note that the credentials are stored in a tertiary file, not the actual server code. This prevents their leakage as well.

**Cookies**
A cookie is placed on the user's broswer so the server can tell when a user has logged in. The cookie expires after a certain amount of time, which then requires the user to sign-in again. This maintains security from the front-end.

The data stored in the cookie is simpy a link to a session in the database. Each session deletes itself after a short amount of time and contains credentials to access the root account. This keeps the root credentials from being sent back and forth from any client to the server, thereby increasing security.

## Further Details
The server is built using the `express.js` framework. The server connects to an AWS S3 database, to post and get user data. `bcrypt` is used as the salting and hashing algorithm. The front-end is built from the ground up using HTML, CSS, and javascript (including React.js JQuery and JQuery Validation libraries). 
