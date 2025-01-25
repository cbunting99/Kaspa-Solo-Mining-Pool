const fs = require('fs');
const yaml = require('js-yaml');
const Joi = require('joi');
const path = require('path');

const configPath = path.join(__dirname, 'config.yaml');

const configSchema = Joi.object({
    server: Joi.object({
        host: Joi.string().default('0.0.0.0'),
        tcpPort: Joi.number().integer().default(3333),
        wsPort: Joi.number().integer().default(3334),
    }).required(),
    pool: Joi.object({
        name: Joi.string().default("MySoloKaspaPool"),
        extraNonceSize: Joi.number().integer().default(4),
        maxExtraNonce: Joi.number().integer().default(4294967295)
    }).required(),
    kaspaNode: Joi.object({
        host: Joi.string().default('127.0.0.1'),
        port: Joi.number().integer().default(16110),
        user: Joi.string().default('your_rpc_user'),
        pass: Joi.string().default('your_rpc_password'),
    }).required(),
    blockTimeTarget: Joi.number().integer().default(1),
    difficulty: Joi.object({
        adjustmentInterval: Joi.number().integer().default(5),
        targetTime: Joi.number().integer().default(5),
        initialDifficulty: Joi.number().integer().default(1),
        varianceTarget: Joi.number().default(0.2),
    }).required(),
    job: Joi.object({
        cleanJobs: Joi.boolean().default(true),
        jobTimeout: Joi.number().integer().default(60),
    }).required(),
    webUI: Joi.object({
        port: Joi.number().integer().default(3000),
        secret: Joi.string().default("my_secret_key_change_me"),
        enableAuth: Joi.boolean().default(true),
        username: Joi.string().default('admin'),
        password: Joi.string().default('password'),
        rateLimitWindow: Joi.number().integer().default(60000),
        rateLimitMax: Joi.number().integer().default(100),
    }).required(),
    monitoring: Joi.object({
        logLevel: Joi.string().valid('error', 'warn', 'info', 'verbose', 'debug', 'silly').default('info'),
        logFile: Joi.string().default('./pool.log')
    }).required(),
    solo: Joi.object({
        confirmationsNeeded: Joi.number().integer().default(10),
    }).required(),
    testnet: Joi.object({
        genesisHash: Joi.string().default("379515597d2289c42b674d56aa3f2e347419d85fbe8f82b21af5a7e13e8f3018"),
        genesisTimestamp: Joi.number().integer().default(1636527288),
        genesisVersion: Joi.number().integer().default(1),
        genesisBits: Joi.string().default("2000ffff"),
        genesisParentHash: Joi.string().default('0000000000000000000000000000000000000000000000000000000000000000'),
        genesisSubnetId: Joi.string().default('00'),
    }).required()
});

// Load config from YAML file
function loadConfig() {
   try {
     const fileContent = fs.readFileSync(configPath, 'utf8');
       const config = yaml.load(fileContent);
        const { value, error } = configSchema.validate(config, { abortEarly: false });
       if (error) {
            console.error('Config validation error:', error.details.map(detail => detail.message).join(', '));
            process.exit(1);
        }
      return value;
   } catch (error) {
     console.error('Error loading configuration:', error);
       process.exit(1);
  }
}

const config = loadConfig();

module.exports = {
    SERVER_HOST: config.server.host,
    SERVER_TCP_PORT: config.server.tcpPort,
    SERVER_WS_PORT: config.server.wsPort,
    POOL_NAME: config.pool.name,
    EXTRA_NONCE_SIZE: config.pool.extraNonceSize,
    MAX_EXTRA_NONCE: config.pool.maxExtraNonce,
    // Kaspa Node RPC Configuration
    KASPA_RPC_HOST: config.kaspaNode.host,
    KASPA_RPC_PORT: config.kaspaNode.port,
    KASPA_RPC_USER: config.kaspaNode.user,
    KASPA_RPC_PASS: config.kaspaNode.pass,
    BLOCK_TIME_TARGET: config.blockTimeTarget,
    //Difficulty Adjustment
    DIFF_ADJ_INTERVAL: config.difficulty.adjustmentInterval,
    TARGET_TIME: config.difficulty.targetTime,
    DIFFICULTY_ONE: config.difficulty.initialDifficulty,
    VARIANCE_TARGET: config.difficulty.varianceTarget,
     //Job Management
    CLEAN_JOBS: config.job.cleanJobs,
    JOB_TIMEOUT: config.job.jobTimeout,
     //Web UI configuration
    WEB_UI_PORT: config.webUI.port,
    WEB_UI_SECRET: config.webUI.secret,
    WEB_UI_ENABLE_AUTH: config.webUI.enableAuth,
    WEB_UI_USERNAME: config.webUI.username,
    WEB_UI_PASSWORD: config.webUI.password,
    WEB_UI_RATE_LIMIT_WINDOW: config.webUI.rateLimitWindow,
    WEB_UI_RATE_LIMIT_MAX: config.webUI.rateLimitMax,
        //Monitoring
    LOG_LEVEL: config.monitoring.logLevel,
    LOG_FILE: config.monitoring.logFile,
    //Solo
    CONFIRMATIONS_NEEDED: config.solo.confirmationsNeeded,
    //Static variables for test environment
    TESTNET_GENESIS_HASH: config.testnet.genesisHash,
    TESTNET_GENESIS_TIMESTAMP: config.testnet.genesisTimestamp,
    TESTNET_GENESIS_VERSION: config.testnet.genesisVersion,
    TESTNET_GENESIS_BITS: config.testnet.genesisBits,
    TESTNET_GENESIS_PARENTHASH: config.testnet.genesisParentHash,
    TESTNET_GENESIS_SUBNETID: config.testnet.genesisSubnetId
};
