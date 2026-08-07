require('dotenv').config();
const jwt = require('jsonwebtoken');
console.log(jwt.sign({id:1,name:'Claude Test'}, process.env.CRM_JWT_SECRET, {expiresIn:'30m'}));
