import sqlite3 from 'sqlite3';
import { INFINITE_POINTS } from '../utils/constants.js';

export class DatabaseManager {

    constructor(config, logger, platformMessanger) {
        this.db = new (sqlite3.verbose()).Database('db.sqlite3', sqlite3.OPEN_READWRITE, (err) => {
            if (err) return console.error(err.message);
        });
        this.logger = logger.child({ "source": "DatabaseManager" });
        this.platformMessanger = platformMessanger;
        this.config = config;
        this.writeEventLog = this.writeEventLog.bind(this);
        this.giveUserPoints = this.giveUserPoints.bind(this);
        this.refundUser = this.refundUser.bind(this);
        
    }

    writeEventLog(username, effect, cost, platform, channel) {
        const me = this;
        const addEvent = `INSERT INTO events VALUES (NULL, "${username}", "${effect}", CURRENT_TIMESTAMP, ${cost}, "${platform}", "${channel}")`
        this.db.run(addEvent, (err) => {
            if (err) return me.logger.error(err.message);
        });
    }

    giveUserPoints(username, channel, amount, platform) {
        const me = this;
        const query = `SELECT * FROM users WHERE username = "${username}"`
        this.db.all(query, function (err, rows) {
            if (err || rows.length === 0) {
                console.log(err);
                me.signUpUser(username, channel, amount, platform);
            } else {
                const user = rows[0];
                if (user["is_disabled"]) {
                    return;
                }
                const points = getPoints(user) + 1000;
                me.setPoints(username, points);
                me.platformMessanger.sendMessageViaPlatform(user.platform, username, user.channel, `@${username} you were given ${points}`);
            }
        });
    }

    refundUser(username, channel, id, platform) {
        const me = this;
        const query = `SELECT * FROM events WHERE id = ${id}`
        this.db.all(query, function (err, rows) {
            if (err || rows.length === 0) {
                console.log(err);
            } else {
                const event = rows[0];
                const query = `SELECT * FROM users WHERE username = "${event.username}"`
                me.db.all(query, function (err, rows) {
                    if (err || rows.length === 0) {
                        console.log(err);
                    } else {
                        const user = rows[0];
                        const points = getPoints(user) + event.cost;
                        me.setPoints(username, points);
                        me.platformMessanger.sendMessageViaPlatform(user.platform, username, user.channel, `@${user.username} you were refunded ${event.cost} with a new total balance of ${points}`);
                        const addEvent = `DELETE FROM events WHERE id = ${id}`
                        me.db.run(addEvent, (err) => {

                        });
                    }
                });
            }
        });
    }

    clearDB() {
        const me = this;
        const eventTable = `DROP TABLE events`
        const pointsTable = `DROP TABLE users`
        this.db.run(eventTable, (err) => {
            if (err) return me.logger.error(err.message);
        });
        this.db.run(pointsTable, (err) => {
            if (err) me.logger.error(err.message);
        });
    }

    async getUser(callback) {
        const me = this;
        const query = `SELECT * FROM users WHERE username = "${username}"`
        this.db.all(query, function (err, rows) {
            if (err || rows.length === 0) {
                me.logger.log(err);
                me.platformMessanger.sendMessageViaPlatform(platform, username, channel, `@${username} you may not be entered you gonk, type !newchoom to enter.`);
            } else {
                const user = rows[0];
                if (user["is_disabled"]) {
                    return;
                }
                callback(user);
            }
        });
    }


    initDB() {
        const me = this;
        const eventTable = `CREATE TABLE events(id INTEGER PRIMARY KEY, username TEXT, event_type TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, cost INTEGER, platform TEXT, channel TEXT)`
        const pointsTable = `CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT UNIQUE, last_point_allocation DATETIME DEFAULT CURRENT_TIMESTAMP, is_disabled INTEGER, joined DATETIME DEFAULT CURRENT_TIMESTAMP, total_points INTEGER, platform TEXT, channel TEXT)`
        this.db.run(eventTable, (err) => {
            if (err) return me.logger.error(err.message);
        });
        this.db.run(pointsTable, (err) => {
            if (err) me.logger.error(err.message);

            //Update timestamp between stream or crash to ensure no extra points
            const setPointsQuery = `UPDATE users SET last_point_allocation = CURRENT_TIMESTAMP`
            me.db.run(setPointsQuery, (err) => {
                if (err) return me.logger.error(err.message);
            });
        });

    }

    stop() {
        this.db.close()
    }

    signUpUser(username, channel, params, platform) {
        const me = this;
        const addToTable = `INSERT INTO users VALUES (NULL, "${username}", CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP, ${this.config.starterPoints}, "${platform}", "${channel}")`
        this.db.run(addToTable, (err) => {
            if (err) {
                me.logger.log(err);
                me.platformMessanger.sendMessageViaPlatform(platform, username, channel, `@${username} You have already entered`)
            }
            else {
                me.platformMessanger.sendMessageViaPlatform(platform, username, channel, `@${username} welcome choom, you start with ${me.config.starterPoints} points to spend.`)
            }
        })
    }

    setPoints(username, points) {
        if (this.config.useChannelPoints) {
            return;
        }
        const me = this;
        const setPointsQuery = `UPDATE users SET total_points = ${points}, last_point_allocation = CURRENT_TIMESTAMP WHERE username = "${username}"`
        this.db.run(setPointsQuery, (err) => {
            if (err) return me.logger.error(err.message);
        });
    }

    getPoints(userRecord) {
        if (INFINITE_POINTS || this.config.useChannelPoints) {
            return Number.MAX_SAFE_INTEGER;
        }
        const lastPointInterval = new Date(userRecord["last_point_allocation"] + " UTC");
        const now = new Date();
        let points = userRecord["total_points"];
        if (now - lastPointInterval >= config.interval) {
            points += Math.floor((now - lastPointInterval) / config.interval) * config.pointsPerInterval;
            this.setPoints(userRecord.username, points)
        }
        return points;
    }

    checkBalance(username, channel, params, platform) {
        const me = this;
        const query = `SELECT * FROM users WHERE username = "${username}"`
        this.db.all(query, function (err, rows) {
            if (err || rows.length === 0) {
                me.logger.log(err);
                me.platformMessanger.sendMessageViaPlatform(platform, username, channel, `@${username} you may not be entered you gonk, type !newchoom to enter.`)
            } else {
                const user = rows[0];
                if (user["is_disabled"]) {
                    return;
                }
                const points = me.getPoints(user);
                me.platformMessanger.sendMessageViaPlatform(platform, username, channel, `@${username} you have ${points} points in the bank right now.`)
            }
        });
    }
}