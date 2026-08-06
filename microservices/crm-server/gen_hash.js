const bcrypt = require('bcryptjs');
bcrypt.hash('Vivera2026', 10).then(h => console.log(h));
