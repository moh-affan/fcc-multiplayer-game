require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const expect = require('chai');
const socket = require('socket.io');
const cors = require('cors');
const http = require('http');
const socketIo = require("socket.io");
const helmet = require('helmet');
const noCache = require('nocache');

const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// security
app.use(helmet.noSniff());
app.use(noCache());

app.use('/public', express.static(process.cwd() + '/public'));
app.use('/assets', express.static(process.cwd() + '/assets'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//For FCC testing purposes and enables user to connect from outside the hosting platform
app.use(cors({ origin: '*' }));

app.use((req, res, next) => {
  res.setHeader('X-Powered-By', 'PHP 7.4');
  res.setHeader("X-Powered-By", "PHP 7.4.3");
  res.setHeader("X-Xss-Protection", "1; mode=block");
  next();
});

//For FCC testing purposes
fccTestingRoutes(app);

app.route('/_api').get(function (req, res) {
  res.json({ message: "OK" });
});

// Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  });
let players = [];
let coll;

const callUpdate = (sock) => {
  sock.emit('update', { players, coll });
}

io.sockets.on('connection', (socket) => {
  const id = socket.id;
  console.log(id, "connected");

  socket.emit('init', { id, players, coll });

  socket.on('new-collectible', (collectible) => {
    coll = collectible;
    callUpdate(io);
  })

  socket.on('new-player', (player) => {
    players.push(player)
    callUpdate(io);
  });

  socket.on('move-player', (id, x, y) => {
    players = players.map(p => {
      if (p.id === id) {
        p.x = x;
        p.y = y;
      }
      return p;
    });
    callUpdate(io);
  });

  socket.on('item-destroyed', (player, currCollectible, newCollectible) => {
    players = players.map(p => {
      if (p.id === player.id) {
        p.score += currCollectible.value;
      }
      return p;
    });
    coll = newCollectible;
    callUpdate(io);
  })

  socket.on('disconnect', () => {
    console.log(id, "disconnected");
    const dc = players.findIndex(p => p.id === id);
    players.splice(dc, 1);
    callUpdate(io);
  })
});


// 404 Not Found Middleware
app.use(function (req, res, next) {
  res.status(404)
    .type('text')
    .send('Not Found');
});

const portNum = process.env.PORT || 3000;

// Set up server and tests
server.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
  if (process.env.NODE_ENV === 'test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch (error) {
        console.log('Tests are not valid:');
        console.error(error);
      }
    }, 1500);
  }
});

module.exports = app; // For testing
