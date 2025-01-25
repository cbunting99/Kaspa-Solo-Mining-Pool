const net = require('net');
const WebSocket = require('ws');
const config = require('./config');
const stratum = require('./stratum');
const express = require('express');
const path = require('path');
const sqlite = require('./sqlite');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const utils = require('./utils');
const jwt = require('jsonwebtoken');
const winston = require('winston');
const rateLimit = require('express-rate-limit');

// Initialize Express for the web UI
const app = express();
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files
app.use(cookieParser());
app.use(express.urlencoded({ extended: true })); //Parse URL encoded bodies

// Setup session
app.use(session({
    secret: config.WEB_UI_SECRET,
    resave: false,
    saveUninitialized: true,
     cookie: {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
      },
}));

// WebSocket server for the web UI
const wss = new WebSocket.Server({ port: config.WEB_UI_PORT + 1 });

//Rate limiter for web UI
const limiter = rateLimit({
  windowMs: config.WEB_UI_RATE_LIMIT_WINDOW,
  max: config.WEB_UI_RATE_LIMIT_MAX,
  message: "Too many requests, please try again later",
  standardHeaders: true,
    legacyHeaders: false,
});


// Middleware to verify the jwt token and authenticate web socket connections.
function authenticateWebsocket(ws, req) {
  try {
        const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        ws.close(1008, 'Authentication failed');
          return false;
      }
          jwt.verify(token, config.WEB_UI_SECRET);
        return true;
      } catch (error) {
        logger.error("Invalid token", error);
        ws.close(1008, 'Authentication failed');
         return false;
  }
}

// Setup logger
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: config.LOG_FILE }),
  ],
});


// Function to send data through websocket
function sendWsMessage(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(data));
            } catch (e) {
                logger.error("Error sending message to websocket",e);
            }
        }
    });
}

async function handleConnection(socket) {
  logger.info(`Client connected from: ${socket.remoteAddress}:${socket.remotePort}`);

  socket.on('data', (data) => {
    stratum.handleMessage(socket,data);
  });

  socket.on('close', () => {
      logger.info(`Client connection closed: ${socket.remoteAddress}:${socket.remotePort}`);
       if (stratum.MINERS[socket]) {
          delete stratum.MINERS[socket];
      }
  });
   socket.on('error', (err) => {
      logger.error(`TCP Socket error ${err}`);
    });
}

async function handleWsConnection(ws, req) {
    if(!authenticateWebsocket(ws,req)){
        return;
     }
    logger.info(`Client connected from: WS`);
    ws.on('message', (message) => {
        stratum.handleMessage(ws, message);
    });
    ws.on('close', () => {
        logger.info(`Client WS connection closed`);
         if (stratum.MINERS[ws]) {
            delete stratum.MINERS[ws];
        }
    });
    ws.on('error', (err) => {
       logger.error(`Websocket error ${err}`);
    });
}

// Start TCP Server
const tcpServer = net.createServer(handleConnection);
tcpServer.listen(config.SERVER_TCP_PORT, config.SERVER_HOST, () => {
    logger.info(`TCP Server listening on ${config.SERVER_HOST}:${config.SERVER_TCP_PORT}`);
});

// Start WebSocket Server for miners
const wss_miners = new WebSocket.Server({ port: config.SERVER_WS_PORT });
wss_miners.on('connection', handleWsConnection);
logger.info(`WebSocket Server listening on ${config.SERVER_HOST}:${config.SERVER_WS_PORT}`);

// Broadcast new block to all clients.
async function broadcastNewBlock(){
  logger.info("New Block! sending mining.notify to all miners.")
  for (const socket of Object.keys(stratum.MINERS)) {
       try{
          await stratum.sendMiningNotify(socket, true);
       } catch (e) {
            logger.error(`Error broadcasting block: ${e}`);
        }
    }
}

// Notify clients of new blocks every X seconds.
setInterval(broadcastNewBlock, config.BLOCK_TIME_TARGET * 1000)


// Authentication middleware
function authenticate(req, res, next) {
    if (config.WEB_UI_ENABLE_AUTH) {
         if (!req.session.token) {
            return res.redirect('/login');
        }
         try {
          jwt.verify(req.session.token, config.WEB_UI_SECRET);
           next();
        } catch (e) {
             logger.error("Invalid session token", e);
          return res.redirect('/login');
          }
    } else {
        next();
     }
}
//Login route
app.get('/login', (req, res) => {
  if (config.WEB_UI_ENABLE_AUTH){
     res.sendFile(path.join(__dirname, 'public', 'login.html'));
    } else {
        res.redirect('/');
   }
});

// Handle login form submission
app.post('/login', (req, res) => {
      if (config.WEB_UI_ENABLE_AUTH){
          const { username, password } = req.body;
            if (username === config.WEB_UI_USERNAME && password === config.WEB_UI_PASSWORD) {
                  const token = utils.generateJWT({ user: username });
                 req.session.token = token
                 res.redirect('/');
            } else {
                  res.status(401).send('Invalid username or password');
            }
      } else {
        res.redirect('/');
     }
});

app.get('/logout', (req, res)=>{
   if (config.WEB_UI_ENABLE_AUTH){
        req.session.destroy((err) => {
          if (err) {
               logger.error("Error destroying session", err);
                return res.status(500).send('Error destroying session');
          }
          res.redirect('/login');
         });
   }  else {
     res.redirect('/')
   }
})


// Apply authentication middleware to all other routes
app.use(authenticate);
app.use(limiter); //Apply rate limiting to all routes

// Set up Web UI
app.get('/api/miners', (req, res) => {
       try {
        const minerData = Object.values(stratum.MINERS).map(miner => ({
               user: miner.user,
                shares: miner.shares,
               authenticated: miner.authenticated,
               hashrate: miner.hashrate.toFixed(2)
          }));
            res.json(minerData);
           sendWsMessage({ type: 'miners', data: minerData});
         } catch (error){
           logger.error("Error getting miner data", error);
          res.status(500).send('Internal Server Error');
         }
});

app.get('/api/shares', async (req, res) => {
    try {
        const shareData = await sqlite.getAllShares();
         res.json(shareData);
           sendWsMessage({type: 'shares', data: shareData})
      } catch (error){
          logger.error("Error getting share data", error);
          res.status(500).send('Internal Server Error');
       }
});


let blockCount = 0;
app.get('/api/pool', (req, res) => {
     try{
           blockCount++;
          res.json({
               poolName: config.POOL_NAME,
               serverHost: config.SERVER_HOST,
               serverPort: config.SERVER_TCP_PORT,
              webUI_Port: config.WEB_UI_PORT,
              difficulty: CURRENT_DIFFICULTY.toFixed(2),
              blocksFound: blockCount
          });
            sendWsMessage({type: 'pool', data: {
                poolName: config.POOL_NAME,
               serverHost: config.SERVER_HOST,
               serverPort: config.SERVER_TCP_PORT,
               webUI_Port: config.WEB_UI_PORT,
                difficulty: CURRENT_DIFFICULTY.toFixed(2),
                blocksFound: blockCount
            }
            })
       } catch (error){
            logger.error("Error getting pool data", error);
           res.status(500).send('Internal Server Error');
        }
});


app.get('/', (req,res)=>{
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

//Start web UI server
const server = app.listen(config.WEB_UI_PORT, () => {
    logger.info(`Web UI started on port: ${config.WEB_UI_PORT}`);
});

//Handle websocket connection, and verify the authorization token.
wss.on('connection', (ws, req) => {
   handleWsConnection(ws,req);
});


sqlite.init()

//Initial data fetch for the web UI on startup.
async function init_webUI_data() {
       try{
           const minerData = Object.values(stratum.MINERS).map(miner => ({
               user: miner.user,
                shares: miner.shares,
               authenticated: miner.authenticated,
                hashrate: miner.hashrate.toFixed(2)
          }));
           sendWsMessage({ type: 'miners', data: minerData});
           const shareData = await sqlite.getAllShares();
           sendWsMessage({type: 'shares', data: shareData});
           sendWsMessage({type: 'pool', data: {
               poolName: config.POOL_NAME,
              serverHost: config.SERVER_HOST,
               serverPort: config.SERVER_TCP_PORT,
              webUI_Port: config.WEB_UI_PORT,
                difficulty: CURRENT_DIFFICULTY.toFixed(2),
                 blocksFound: blockCount
           }
          })
      } catch (error) {
           logger.error("Error initializing webUI data", error);
       }
}

init_webUI_data();
//Send pool data to client every x seconds.
setInterval(async () => {
  try {
   const minerData = Object.values(stratum.MINERS).map(miner => ({
        user: miner.user,
         shares: miner.shares,
        authenticated: miner.authenticated,
         hashrate: miner.hashrate.toFixed(2)
    }));
    sendWsMessage({ type: 'miners', data: minerData});
     const shareData = await sqlite.getAllShares();
     sendWsMessage({type: 'shares', data: shareData})
      sendWsMessage({type: 'pool', data: {
              poolName: config.POOL_NAME,
             serverHost: config.SERVER_HOST,
            serverPort: config.SERVER_TCP_PORT,
              webUI_Port: config.WEB_UI_PORT,
              difficulty: CURRENT_DIFFICULTY.toFixed(2),
                 blocksFound: blockCount
       }
      })
   } catch (error) {
      logger.error("Error updating the webUI", error);
   }
}, 5000);
