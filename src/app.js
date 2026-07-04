const express = require('express');
const cors = require('cors');
const path = require('path');
const rootRoutes = require('./routes/root');
const apiRoutes = require('./routes/api');

const app = express();

app.use(cors());
app.use(express.static(path.join(__dirname, '../../public')));
app.use('/', rootRoutes);
app.use('/api', apiRoutes);

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

module.exports = app;