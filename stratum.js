const config = require('./config');
const utils = require('./utils');
const crypto = require('crypto');
const { RPC } = require('node-kaspa-rpc');
const kaspaWalletRPC = new RPC(config.KASPA_WALLET_RPC_HOST, config.KASPA_WALLET_RPC_PORT, config.KASPA_WALLET_RPC_USER, config.KASPA_WALLET_RPC_PASS);


const MINERS = {}; // Active miner connections. {socket: {subscriptionId: str, user:str, extNonce: int, lastShare: int,  authenticated: bool, hashrate: float, jobId: string}}
let CURRENT_WORK = {}; //Current work object sent to miners {blockHeader: hex, target: hex}
let CURRENT_DIFFICULTY = config.DIFFICULTY_ONE;
const SHARES = []; // In-memory share database. {timestamp: int, valid: bool, user: str, jobId: string}
let BLOCK_COUNT = 0; // For difficulty adjustment
const DIFFICULTY_HISTORY = [];
const JOBS = {}; // Active jobs {jobId: {timestamp: int, block: hex, target: string}}

function sendMessage(socket, message) {
    const line = JSON.stringify(message) + "\n";
    if (socket.readyState === 1) {
      socket.send(line);
    } else {
      socket.write(line);
    }
  }

function handleSubscription(socket, params) {
    const subscriptionId = utils.generateSubscriptionId();
    let nextExtNonce;

    if (Object.keys(MINERS).length === 0) {
      nextExtNonce = 0;
    } else {
      const currentMaxExtNonce = Math.max(...Object.values(MINERS).map(miner => miner.extNonce));
      nextExtNonce = currentMaxExtNonce + 1;
    }

    if (nextExtNonce > config.MAX_EXTRA_NONCE) {
        console.error(`ERROR: Max miners reached. ${config.MAX_EXTRA_NONCE} active connections`);
        return false;
    }
    
    const user = params[1] || 'solo';
    MINERS[socket] = { subscriptionId, user, extNonce: nextExtNonce, lastShare: Date.now(),  authenticated: false, hashrate: 0, jobId: null };
    console.log(`Miner ${user} subscribed with ID: ${subscriptionId}`);
    const response = {
        id: params[0],
        result: [[`mining.${config.POOL_NAME}`, subscriptionId],
                 nextExtNonce.toString(16).padStart(config.EXTRA_NONCE_SIZE * 2, '0'),
                config.EXTRA_NONCE_SIZE
                ],
        error: null,
    };
    sendMessage(socket, response);
    return true;
}

function handleAuthorize(socket, params) {
    const user = params[1];
    const password = params[2];

    // Basic authentication - In this example just allow any user/password
    if (user && password) {
        MINERS[socket].authenticated = true;
          const response = {
              id: params[0],
              result: true,
              error: null,
          };
          sendMessage(socket, response);
          console.log(`Miner ${user} authorized`);
          return;
    }
    const response = {
        id: params[0],
        result: false,
        error: 'Invalid username or password',
    };
    sendMessage(socket, response)
      console.log(`Miner ${user} authorization failed`);
}

async function sendMiningNotify(socket, clean_jobs = false) {
  if (!MINERS[socket] || !MINERS[socket].authenticated) {
      console.error("Unauthorized access");
      return;
    }
    try{
          const blockData = await utils.generateBlockHeader();
          if(!blockData){
              return;
          }
          const { headerData, target: bits } = blockData;
          const target = utils.bitsToTarget(parseInt(bits, 16));
          const jobId = utils.generateJobId();
         CURRENT_WORK = { blockHeader:headerData, target };
         JOBS[jobId] = {timestamp: Date.now(), block: headerData, target};
          const extraNonceHex = MINERS[socket].extNonce.toString(16).padStart(config.EXTRA_NONCE_SIZE * 2, '0');
           MINERS[socket].jobId = jobId;
          const response = {
              method: "mining.notify",
              params: [
                  jobId,
                  headerData,
                  extraNonceHex,
                  clean_jobs,
              ],
          };
          sendMessage(socket, response);
      } catch(error){
         console.error("Error sending mining notify message", error)
       }

}

async function handleSubmit(socket, params) {
    if (!MINERS[socket] || !MINERS[socket].authenticated) {
          console.error("Unauthorized share submit");
          return;
      }
      try {
          const jobId = params[1];
            const extranonce2 = params[2];
            const nonce = params[3];
           const currentJob = JOBS[jobId];
           if(!currentJob){
              console.error(`Job not found ${jobId}`);
                 return;
            }
         if (config.CLEAN_JOBS && currentJob.timestamp + config.JOB_TIMEOUT * 1000 < Date.now() ){
             console.log(`Job ${jobId} expired. Sending new job`);
             delete JOBS[jobId];
                sendMiningNotify(socket, true);
               return;
        }

            const { blockHeader, target } = currentJob;
            const extraNonceHex = MINERS[socket].extNonce.toString(16).padStart(config.EXTRA_NONCE_SIZE * 2, '0');
          
            const fullHeader = Buffer.from(blockHeader, 'hex');
            const fullHeaderWithExtraNonce = Buffer.concat([
                fullHeader.slice(0, fullHeader.length - 8),
                Buffer.from(extraNonceHex, 'hex'),
                Buffer.from(extranonce2, 'hex'),
                Buffer.from(nonce, 'hex')
            ]);
          
            const headerHashBytes = crypto.createHash('sha3-256').update(fullHeaderWithExtraNonce).digest();
            const headerHash = headerHashBytes.toString('hex');
            let result = false;
            if (headerHash < target) {
                 console.log(`Block found! Hash: ${headerHash}`);
                 result = true;
                try {
                    const blockHash = await utils.getBlockHash(fullHeaderWithExtraNonce.toString('hex'));
                    if (blockHash){
                         console.log(`Block submitted to the network. Hash: ${blockHash}`);
                         //Wait X number of confirmations before giving up the work.
                          setTimeout(()=>delete JOBS[jobId],config.CONFIRMATIONS_NEEDED * config.BLOCK_TIME_TARGET * 1000);

                        } else {
                         console.error("Error submitting block")
                          if (config.CLEAN_JOBS){
                               delete JOBS[jobId];
                            }
                       }
                 } catch(e){
                      console.error("Error pushing block to the network", e);
                     if (config.CLEAN_JOBS){
                        delete JOBS[jobId];
                      }
                 }
             }

             //Add the new share to the database
            const user = MINERS[socket].user;
             SHARES.push({timestamp: Date.now(), valid: result, user: user, jobId: jobId});
              const now = Date.now();
            MINERS[socket].hashrate = utils.calculateHashrate(MINERS[socket].lastShare, now);
           MINERS[socket].lastShare = now;
            const response = {
                id: params[0],
                result: result,
                error: null
            };
            sendMessage(socket, response);
             if (!result){
             sendMiningNotify(socket, config.CLEAN_JOBS); // Send new work after submission if not a valid block
            }

             // Update difficulty every X blocks
             BLOCK_COUNT++;
             if (BLOCK_COUNT >= config.DIFF_ADJ_INTERVAL){
                  adjustDifficulty();
                  BLOCK_COUNT = 0;
              }

      } catch (error){
        console.error("Error handling submit message", error);
      }
}

function handleSetDifficulty(socket, params){
    if (!MINERS[socket] || !MINERS[socket].authenticated) {
        console.error("Unauthorized set difficulty");
          return;
      }
  const newDifficulty = params[1];
  CURRENT_DIFFICULTY = newDifficulty;
  console.log(`Difficulty set to ${newDifficulty}`);
  const response = {
    "id": params[0],
    "result": true,
    "error": null
    };
  sendMessage(socket, response);
}

// Improved Difficulty Adjustment Algorithm (Using Variance)
function adjustDifficulty() {
    if (SHARES.length < config.DIFF_ADJ_INTERVAL) {
        return; // Skip if not enough data
    }
      const validShares = SHARES.slice(-config.DIFF_ADJ_INTERVAL).filter(s => s.valid).map(s => s.timestamp);
      if (validShares.length < 2) {
            return;
        }
      const timeWindow = (validShares[validShares.length - 1] - validShares[0]) / 1000;
     const shareRate = (validShares.length - 1) / timeWindow;
      const targetShareRate = (config.TARGET_TIME * config.DIFF_ADJ_INTERVAL) > 0 ? 1 / (config.TARGET_TIME) : 1;
     let diff_adjustment = targetShareRate / shareRate;
      // Calculate variance
     const variance = Math.max(Math.min(diff_adjustment, 1 + config.VARIANCE_TARGET), 1 - config.VARIANCE_TARGET);
      // Calculate moving average
      const history_length = 5;
       DIFFICULTY_HISTORY.push(variance);
       if (DIFFICULTY_HISTORY.length > history_length) {
         DIFFICULTY_HISTORY.shift();
       }
        const diff_adjustment_avg = DIFFICULTY_HISTORY.reduce((a, b) => a + b, 0) / DIFFICULTY_HISTORY.length;
     let new_difficulty = CURRENT_DIFFICULTY * diff_adjustment_avg;
      if (new_difficulty < 1) {
            new_difficulty = 1;
        }
        CURRENT_DIFFICULTY = new_difficulty;

    console.log(`New difficulty is ${CURRENT_DIFFICULTY.toFixed(2)}, adjustment: ${diff_adjustment_avg.toFixed(2)}, share rate: ${shareRate.toFixed(2)}, target rate: ${targetShareRate.toFixed(2)}`);
      // Clean up old share data
     SHARES.splice(0, SHARES.length - config.DIFF_ADJ_INTERVAL);
    broadcastNewDifficulty();
}

async function broadcastNewDifficulty() {
    console.log(`Broadcasting new difficulty ${CURRENT_DIFFICULTY.toFixed(2)} to all authenticated miners`);
    for (const socket of Object.keys(MINERS)) {
      if(MINERS[socket].authenticated){
        const params = [null, CURRENT_DIFFICULTY]; //Id is irrelevant here
        handleSetDifficulty(socket, params);
      }
    }
}

function handleMessage(socket, data) {
  try {
    const message = JSON.parse(data.toString().trim());
    const method = message.method;
    const params = message.params || [];
    
    if (method === 'mining.subscribe') {
      console.log(`Received subscription request from: ${socket.remoteAddress || 'ws'} ${socket.readyState}`);
      if(handleSubscription(socket, params)){
         sendMiningNotify(socket,true); // Send first work
      }
    } else if (method === 'mining.authorize') {
      console.log(`Received authorization request from: ${socket.remoteAddress || 'ws'} ${socket.readyState}`);
      handleAuthorize(socket, params);
    } else if (method === 'mining.submit') {
      console.log(`Received submit request from: ${socket.remoteAddress || 'ws'} ${socket.readyState}`);
      handleSubmit(socket, params);
    } else if (method === 'mining.set_difficulty'){
      console.log(`Received set_difficulty request from: ${socket.remoteAddress || 'ws'} ${socket.readyState}`);
      handleSetDifficulty(socket, params);
    } else {
      console.log(`Received unknown method: ${method} from ${socket.remoteAddress || 'ws'} ${socket.readyState}`);
    }
  } catch (e) {
      console.error(`Invalid JSON received from ${socket.remoteAddress || 'ws'}`, e);
  }
}


module.exports = {
    handleMessage,
    MINERS, // Export MINERS for cleanup on server.js
    sendMiningNotify
};
