const express = require('express');
const bodyParser = require('body-parser');
const notesRoutes = require('../../routes/notes');

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use('/', notesRoutes);

module.exports = app;
