/**
 * RCON Client for Project Zomboid
 * 
 * PZ uses a simple RCON protocol over TCP.
 * RCON Packet Format:
 *   - Length: 4 bytes (little-endian int32)
 *   - Request ID: 4 bytes (little-endian int32)
 *   - Type: 4 bytes (little-endian int32)
 *      - 2: SERVERDATA_AUTH
 *      - 3: SERVERDATA_EXECCOMMAND
 *      - 0: SERVERDATA_RESPONSE_VALUE
 *      - 1: SERVERDATA_AUTH_RESPONSE
 *   - Body: null-terminated string
 *   - Padding: null byte (for 2-null termination)
 * 
 * PZ-specific RCON uses port 27015 by default.
 */

const net = require('net');

class RconClient {
    constructor(config) {
        this.host = '127.0.0.1';
        this.port = config.rconPort || 27015;
        this.password = config.rconPassword || '';
        this.socket = null;
        this.authenticated = false;
        this.requestId = 0;
        this.pending = new Map();
        this.buffer = Buffer.alloc(0);
    }

    connect() {
        return new Promise((resolve, reject) => {
            if (this.socket && this.socket.readyState === 'open') {
                if (this.authenticated) {
                    resolve(true);
                    return;
                }
                // Need to re-authenticate
            }

            this.socket = new net.Socket();
            this.buffer = Buffer.alloc(0);

            this.socket.connect(this.port, this.host, () => {
                this._authenticate()
                    .then(() => resolve(true))
                    .catch(reject);
            });

            this.socket.on('data', (data) => {
                this._handleData(data);
            });

            this.socket.on('error', (err) => {
                console.error('[RCON] 连接错误:', err.message);
                this.authenticated = false;
                reject(err);
            });

            this.socket.on('close', () => {
                console.log('[RCON] 连接关闭');
                this.authenticated = false;
                // Reject all pending requests
                for (const [id, { reject: rej }] of this.pending) {
                    rej(new Error('RCON 连接已关闭'));
                }
                this.pending.clear();
            });

            // Timeout
            setTimeout(() => {
                if (!this.authenticated) {
                    this.socket.destroy();
                    reject(new Error('RCON 连接超时'));
                }
            }, 5000);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
        this.authenticated = false;
    }

    sendCommand(command) {
        return new Promise((resolve, reject) => {
            if (!this.socket || this.socket.readyState !== 'open') {
                reject(new Error('RCON 未连接'));
                return;
            }

            const id = ++this.requestId;
            const packet = this._createPacket(id, 2, command); // SERVERDATA_EXECCOMMAND

            this.pending.set(id, { resolve, reject, command });

            // Set timeout
            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error('RCON 命令超时'));
                }
            }, 10000);

            this.socket.write(packet);
        });
    }

    _authenticate() {
        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            const packet = this._createPacket(id, 3, this.password); // SERVERDATA_AUTH

            this.pending.set(id, { 
                resolve: (result) => {
                    if (result === true) {
                        this.authenticated = true;
                        resolve(true);
                    } else {
                        reject(new Error('RCON 认证失败'));
                    }
                }, 
                reject,
                command: '__auth__'
            });

            // Timeout
            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error('RCON 认证超时'));
                }
            }, 5000);

            this.socket.write(packet);
        });
    }

    _createPacket(id, type, body) {
        const bodyBytes = Buffer.from(body, 'utf-8');
        const nullByte = Buffer.from([0x00]);
        
        // Packet: ID (4) + Type (4) + Body (variable) + NULL (1) + NULL (1)
        const payload = Buffer.concat([
            this._int32LE(id),
            this._int32LE(type),
            bodyBytes,
            nullByte,
            nullByte
        ]);

        // Length: size of payload
        const length = this._int32LE(payload.length);
        
        return Buffer.concat([length, payload]);
    }

    _int32LE(value) {
        const buf = Buffer.alloc(4);
        buf.writeInt32LE(value, 0);
        return buf;
    }

    _handleData(data) {
        this.buffer = Buffer.concat([this.buffer, data]);
        
        while (this.buffer.length >= 12) { // Minimum: Length(4) + ID(4) + Type(4) + 2 null bytes
            const length = this.buffer.readInt32LE(0);
            
            if (length <= 0 || length > 4096) {
                // Invalid packet, clear buffer
                this.buffer = Buffer.alloc(0);
                return;
            }

            // Full packet: Length(4) + ID(4) + Type(4) + Body(variable) + 2 null bytes
            const fullLength = 4 + length;
            
            if (this.buffer.length < fullLength) {
                // Wait for more data
                return;
            }

            const packet = this.buffer.slice(4, fullLength);
            this.buffer = this.buffer.slice(fullLength);

            const id = packet.readInt32LE(0);
            const type = packet.readInt32LE(4);
            // Body ends before the trailing 2 null bytes
            const body = packet.slice(8, -2).toString('utf-8');

            this._processPacket(id, type, body);
        }
    }

    _processPacket(id, type, body) {
        if (type === 0) { // SERVERDATA_RESPONSE_VALUE
            const pending = this.pending.get(id);
            if (pending) {
                if (pending.command === '__auth__') {
                    // Auth response with body containing the password means success
                    pending.resolve(true);
                } else {
                    pending.resolve(body);
                }
                this.pending.delete(id);
            }
        } else if (type === 2) { // SERVERDATA_EXECCOMMAND response
            // This is a response to a command
            const pending = this.pending.get(id);
            if (pending) {
                pending.resolve(body);
                // Don't delete - PZ may send multiple responses
            }
        }
    }
}

module.exports = RconClient;