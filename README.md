
# Kaspa Solo Mining Pool (Not Finished + Missing Libraries)

This is a feature-rich, commercially viable solo mining pool implementation for Kaspa, designed for stability, scalability, and ease of use. It enables individual miners to connect to the Kaspa network, solve blocks, and receive the full block reward directly.

## Features:

### Core Functionality
*   **Stratum Protocol:** Implements the full stratum protocol for efficient communication between miners and the pool.
*   **TCP and WebSocket Support:** Allows miners to connect via both TCP and WebSocket protocols.
*   **Real Block Headers:** Fetches and distributes authentic block templates from a connected Kaspa full node via RPC.
*  **Direct Block Reward**: When a miner solves a block, the full block reward will be sent directly to their Kaspa address used when connecting to the pool.

### Mining Pool Management
*   **User Authentication:** Allows miners to authenticate using a username (which is their Kaspa address) and any password.
*   **Robust Difficulty Adjustment:** Uses a dynamic difficulty algorithm with variance adjustments to maintain an optimal share rate.
*   **Job Management:**
    *  Uses a job system to keep miners in sync with the pool.
    *  The pool will timeout any old or expired jobs.
    *  The pool has the option to clean old jobs to maintain the best compatibility with mining software.
*   **Configurable Job Timeout:**  Allows setting a timeout for when jobs expire, preventing miners from using old data.
*   **Clean Jobs Support:** Provides an option for sending `clean_jobs` notification to the miners.

### Web UI & Monitoring
*   **Real-time Web UI:** A user-friendly web interface is included to monitor pool performance.
*   **Secure Web UI Access:** The web UI is secured with username/password login, JWT authentication and rate limiting to prevent abuse.
*   **Real Time data:** The UI uses web sockets to show information about miners, shares, and blocks.
*   **Comprehensive Logging:** Implements a robust logging system using Winston for monitoring and troubleshooting.
*   **Dynamic Data:** All data is refreshed in real time.
*  **Pool Statistics:** The pool statistics available are the pool name, server address, web UI port, current difficulty and number of blocks found.
*   **Miner Statistics:** The UI displays the active miners, their number of shares, hashrate and authentication status.
*   **Share Statistics**: The UI displays all submitted shares, including the timestamp, the validity and the user, and the jobID.

### Security
*   **JWT Authentication:** Uses JWT (JSON Web Tokens) for secure communication and authentication of the web UI and websockets.
*   **Rate Limiting:** Implements rate limiting on the web UI to prevent abuse.

### Configuration
*   **YAML Configuration:** The pool is configured using a `config.yaml` file to manage all parameters.
*   **Validation:** The pool validates configurations using Joi to ensure proper behavior and prevent errors.

## Configuration:

The pool configuration is done with a `config.yaml` file located in the root folder of the pool. This is a description of the parameters in this file:

*   `server.host`, `server.tcpPort`, `server.wsPort`: Pool server settings (host, TCP port, and WebSocket port).
*   `pool.name`, `pool.extraNonceSize`, `pool.maxExtraNonce`: pool information (name, extranonce size and max extranonce).
*   `kaspaNode.host`, `kaspaNode.port`, `kaspaNode.user`, `kaspaNode.pass`: Kaspa node RPC connection details.
*   `blockTimeTarget`: Target time for each block, used to send notifications to the miners.
*    `difficulty.adjustmentInterval`: How often the difficulty adjustment happens in blocks.
*   `difficulty.targetTime`: Target time between blocks in seconds.
*   `difficulty.initialDifficulty`: Initial difficulty of the pool.
*   `difficulty.varianceTarget`: The amount of acceptable variance in the pool difficulty adjustment.
*    `job.cleanJobs`: A flag to indicate if the pool should send `clean_jobs`.
*   `job.jobTimeout`: Timeout for jobs in seconds.
*   `webUI.port`: Port where the web UI will be available.
*    `webUI.secret`: Secret string used to sign JWT tokens for authentication, this should be a strong secret.
*   `webUI.enableAuth`: Flag to indicate if the web UI should use authentication
*   `webUI.username`, `webUI.password`: Username and password to access the web UI.
*   `webUI.rateLimitWindow`:  Rate limiting time window in milliseconds for the web UI.
*   `webUI.rateLimitMax`: Max number of request for rate limiting.
 *   `monitoring.logLevel`: Sets the log level.
*   `monitoring.logFile`: Sets the log file.
*  `solo.confirmationsNeeded`: The number of block confirmations needed before removing old jobs.
*   `testnet.genesisHash`, `testnet.genesisTimestamp`, `testnet.genesisVersion`, `testnet.genesisBits`, `testnet.genesisParentHash`, `testnet.genesisSubnetId`: Used for test environment setup.

## Getting Started:

1.  **Clone the repository.**
2.  **Install dependencies:** `npm install`
3.  **Configure `config.yaml`:** Update with your Kaspa node RPC credentials, and other settings as needed.
4.  **Run the server:** `node server.js`
5.  **Connect your miners:** Use a mining client that supports stratum connections (e.g., `lolMiner`, `bzminer`, etc.). Connect to either the TCP port or the WebSocket port of the server. Use your Kaspa wallet address as the username and any password to connect to the server.
6.  **Access the Web UI:** Open your web browser and navigate to http://`<server_ip>:`3000` (default port 3000) to view the pool's status.

## Stratum Protocol Implementation:

*   **mining.subscribe**: Request subscription to the mining pool.
*   **mining.authorize**: Authenticate using a user and password.
*   **mining.notify**: Send a new block template to the miners.
*   **mining.submit**: Submit a share to the pool.
*   **mining.set_difficulty**: Set new difficulty for the miners.

## Project Roadmap:

### Phase 1: Core Functionality
*   [x] Implement core stratum protocol.
*   [x] Establish TCP and WebSocket communication with miners.
*   [x] Integrate with a Kaspa full node to fetch block headers via RPC.
*   [x] Implement a difficulty adjustment algorithm.
*   [x] Implement username/password authentication.
*   [x] Develop a basic web interface for monitoring.
*  [x] Implement real block submissions to the Kaspa Network.
*   [x] Implement a robust job system
*   [x] Implement a validation system to check for errors in configuration and environment
*   [x] Implement a monitoring system to log errors and status updates.

### Phase 2: Advanced Features
*   [ ] Implement hashrate tracking per miner.
*   [ ] Implement a more extensive web UI with more granular monitoring data.
*   [ ] Implement a more sophisticated difficulty adjustment based on hashrate
*   [ ] Add configuration options through web UI
*  [ ] Implement more advanced job management with priority assignment
*  [ ] Implement more security practices and DDOS protection.
*   [ ] Add configuration options through environment variables.

### Phase 3: Scalability & Performance
*   [ ] Migrate the pool data to a robust database (PostgreSQL, MongoDB, etc.).
*   [ ] Optimize the code for large-scale operations.
*   [ ] Implement a more advanced caching mechanism.
*   [ ] Improve connection management and error handling.
*   [ ] Add a cluster mode for better scalability.

### Phase 4: Future Enhancements

*   [ ] Add support for Stratum V2.
*   [ ] Expand the user interfaces to be more user friendly.
*    [ ] Implement a profit switching algorithm for solo mining.
*   [ ] Add a complete API for pool monitoring and control.

## Development Notes:

*   **Security:** The web UI is protected by a username/password login and a JWT. It also has rate limiting to avoid DDOS attacks.
*   **Logging:** The pool is logging all major operations and errors.
*   **Database**: Shares are saved in a sqlite database for debugging and testing.
*   **Job Management:** The pool implements a job system that makes sure that the miners have a recent job and also avoid using old data.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

This project is licensed under the [MIT License](LICENSE).
