# Fantasy WL Node Backend
> This project provide better Fantasy features in Rest API for Admin Panel as well as Users App.

## Requirements  (Prerequisites)
Tools and packages required to successfully install this project.

* Nodejs - 16.13.1 LTS [Install](https://nodejs.org/en/download/)
* NPM - 8.1.2
* Redis - [Install](https://redis.io/download)
* MongoDB - [Install](https://www.mongodb.com/try/download/community)
* SQL - [Install](https://dev.mysql.com/downloads/)

## Cloning Project
`Clone with HTTPS: `
```sh
git clone https://gitlab.com/fantasy-wl/fantasy-node-backend.git
```
or 
`Clone with SSH: `
```sh
git@gitlab.com:fantasy-wl/fantasy-node-backend.git
```

## Installation and Setup
A step by step list of commands / guide that informs how to install an instance of this project. 

```sh
cd ./fantasy-node-backend

npm install
```

## Run Project
Now you're done with setup and install please run your project using this command.

In Development Environment
```sh
npm run dev
```

In Production Environment
```sh
npm run start
```

## Folder Structure
This Project follows four main directories

### config
- In this folder all configuration related to this project goes here.
For e.g.- 
  - config.js -> all environments configuration.
  - development.js -> dev(Development) environment related configuration goes here.
  - staging.js -> stag(Staging) environment related configuration goes here.
  - production.js -> prod(Production) environment related configuration goes here.
  - test.js -> test(Test) environment related configuration goes here.
  - common.js -> common changes for all environments goes here.

### databases
- In this folder all databases related setup for this project goes here.
For e.g.- 
  - mongoose.js -> Mongoose (Mongo DB) connection establishment
  - sequelize.js -> Sequelize (My SQL) connection establishment

### helper
- In this folder all reusable and frequently used functions and services for this project goes here according to different file.
For e.g.- 
  - third-party-cred -> all third party credential and it's file goes here.
  - firebase.services.js -> all firebase related services like push notification, topic notification, etc. goes here.
  - api.responses.js -> all response status and messages, etc. goes here.
  - email.service.js -> all email sending related services goes here.
  - redis.js -> all redis configuration and it's services goes here.
  - s3config.js -> all s3 bucket related configuration and it's services goes here.
  - sms.services.js -> all sms sending related configuration and it's services goes here.
  - truecaller.services.js -> all truecaller related configuration and it's services goes here.
  - utillities.services.js -> all common helper services which is frequently used in project goes here.
  - Same for others....

### lang
- In this folder all messages that we send back as response for this project goes here according to different folder.
For e.g.- 
  - english/general.js -> all statements of response goes here
  - english/words.js -> all statement's words of response goes here
  - Same for others....

### luaScript
- Redis luaScript related functions will goes here.

### middlewares
- In this folder all middleware function and routes defined in this project goes here according to different folder.
For e.g.- 
  - index.js -> all nodejs server related configurations goes here.
  - routes.js -> all routes for this project goes here.
  - middleware.js -> all middleware functions goes here.

### migrations
- In this folder all migrations related to sequelize for this project goes here according to different folder.
For e.g.- 
  - new file that you generated to update particular table will generate inside this folder

### models-routes-services
- In this folder all module's models, routes and it's services for this project goes here according to different folder.

### views/email_templates
- basic.ejs -> In this folder all mail related templates for this project goes here.


## To Generate and Run Migration for MySQL
* To generate new migrations for passbooks table
```sh
sequelize migration:create --name add_fields_in_passbooks
``` 

Now, see new file added inside migration folder, add your code inside new generated file named add_fields_in_passbooks according your need

* To run this migration execute this command
```sh
sequelize db:migrate
```

## To Generate and Run Seeders for MongoDB
### Cloning Seeders Project to get Seeders file
`Clone with HTTPS: `
```sh
git clone https://gitlab.com/fantasy-wl/fantasy-seeders.git
```
or 
`Clone with SSH: `
```sh
git@gitlab.com:fantasy-wl/fantasy-seeders.git
```
* This Repository contains whole seeders file for this project.
* This will add and update new seeds for static table for this project.

For that, review seeders.js file code and add or update your code inside this file.

* To run new seeds for static table for this project execute this command.
```sh
node seeders.js
``` 

## Running the tests
Describe and show how to run the test cases for particular module.
- Add you test cases inside models-routes-services according to your module and make sure your test case file should have named postfix as filename.test.js .
- Then, import this file's path to main test.test.js file.

- To run your test cases simply run this command:
```sh
npm run test
```

## Deployment Notes
Explain how to deploy your project on a live server. To do so include step by step guide will explained in this documentation. 
[While Going Live Docs.](https://docs.google.com/document/d/11oZlD4yCWPL9KetTMUjrEQSqG4oN6H9vJ4pZ6ieIE0o/edit?usp=sharing)


## POSTMAN Collection Links:

For Admin:
- https://documenter.getpostman.com/view/17120878/TzzDLauo

For User:
- https://documenter.getpostman.com/view/17120878/TzzDLaqV


