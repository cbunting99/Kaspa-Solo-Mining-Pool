const crypto = require('crypto');
const config = require('./config');
const { RPC } = require('node-kaspa-rpc');
const kaspaRPC = new RPC(config.KASPA_RPC_HOST, config.KASPA_RPC_PORT, config.KASPA_RPC_USER, config.KASPA_RPC_PASS);
const jwt = require('jsonwebtoken');

async function generateBlockHeader() {
    try {
        const response = await kaspaRPC.getBlockTemplate();
        const {  headerData, target, isSynch } = response.result;
        if (!isSynch){
          console.log("WARNING: Kaspa node not synched");
        }
        return {
            headerData,
            target
          };
    } catch (error) {
        console.error('Error fetching block template:', error);
        return null;
    }
}

function difficultyToTarget(difficulty) {
    if (difficulty === 1) {
        return "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    } else {
        console.error("ERROR: Solo pool can only use difficulty 1");
        return null;
    }
}

function bitsToTarget(bits){
  const shift = (bits >> 24) & 0xff;
  const value = bits & 0x00ffffff;
  const target = value * (2 ** (8 * (shift - 3)));
  let target_hex = target.toString(16).padStart(64,'0');
  if(target_hex.length>64){
    target_hex = 'f'.repeat(64);
  }
  return target_hex;
}

async function calculateBlockReward(){
   try {
    const response = await kaspaRPC.getBlockTemplate();
    const blockReward = response.result.blockreward;
    return blockReward;
}
catch (error){
    console.error("Error getting block reward from kaspa RPC", error);
    return 0;
}
}

async function getBlockHash(headerBytes) {
   try {
        const response = await kaspaRPC.submitBlock({
             header: headerBytes
        });
        return response.result;
    } catch (error) {
        console.error("Error getting block hash from kaspa RPC", error);
        return null;
    }
}

function generateJWT(payload) {
  try {
    return jwt.sign(payload, config.WEB_UI_SECRET, {expiresIn: '1h'});
  } catch (e) {
    console.error("Error creating JWT", e);
    return null;
  }
}

function generateJobId() {
    return crypto.randomBytes(8).toString('hex');
}

function calculateHashrate(lastShare, now){
    const timeDiff = (now - lastShare ) / 1000; //time difference in seconds
        if (timeDiff > 0){
            return (1/timeDiff) * (2**25);
    }
    return 0;
}

function generateSubscriptionId() {
    return crypto.randomBytes(8).toString('hex');
}


module.exports = {
    generateBlockHeader,
    difficultyToTarget,
    generateSubscriptionId,
    bitsToTarget,
    calculateBlockReward,
    generateJWT,
    generateJobId,
    calculateHashrate,
    getBlockHash
};
