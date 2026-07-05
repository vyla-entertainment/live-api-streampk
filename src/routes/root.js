const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const LOGO_TEXT = fs.readFileSync(path.join(__dirname, '../../public/assets/title.txt'), 'utf8');

router.get('/', (req, res) => {
    res
        .type('text/plain; charset=utf-8')
        .send(`${LOGO_TEXT}\n\ndeveloped_by: @vyla-entertainment\ngithub: https://github.com/vyla-entertainment\ndocs: https://docs.vyla.cc\ndmca: https://docs.vyla.cc/misc/dmca`);
});

module.exports = router;