
/**
 *  Copyright Telligro Pte Ltd 2017
 *
 *  This file is part of OPAL.
 *
 *  OPAL is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  OPAL is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with OPAL.  If not, see <http://www.gnu.org/licenses/>.
 */


module.exports = function (RED) {
    "use strict";
    var debuglength = RED.settings.debugMaxLength || 1000;
    var util = require("util");
    var events = require("events");

    /**
    * __DOCSPLACEHOLDER__
    * @function
    * @param {string} property - __DOCSPLACEHOLDER__
    * @param {string} type - __DOCSPLACEHOLDER__
    * @param {object} node - __DOCSPLACEHOLDER__
    * @return {object} property - __DOCSPLACEHOLDER__
    */
    function processJsonataType(property, type, node) {

        if (type === 'jsonata') {
            try {
                property = RED.util.prepareJSONataExpression(property, node);
            } catch (err) {
                throw RED._('logger.errors.invalid-expr', {error: err.message});
            }
        }

        return property;
    }

    /**
    * __DOCSPLACEHOLDER__
    * @function
    * @param {object} node - __DOCSPLACEHOLDER__
    * @param {object} msg - __DOCSPLACEHOLDER__
    * @param {object} param - __DOCSPLACEHOLDER__
    * @param {object} type - __DOCSPLACEHOLDER__
    * @return {object} prop - __DOCSPLACEHOLDER__
    */
    function evaluateTypedParameters(node, msg, param, type) {
        console.log('eval - p:%s, t:%s', param, type);
        let prop;
        if (type === 'jsonata') {
            let jsoPar = processJsonataType(param, type, node);
            prop = RED.util.evaluateJSONataExpression(jsoPar, msg);
        } else {
            prop = RED.util.evaluateNodeProperty(param, type, node, msg);
        }
        return prop;
    }


    function OpalLoggerNode(config) {

        let { flowLogger } = require('opal-logger');
        // var winston = require('winston');
        //  winston.handleExceptions(new winston.transports.File({ filename: 'exceptions.log' }));
        RED.nodes.createNode(this, config);
        var node = this;
        // var filesize = 1073741824;
        // var maxfiles = 1;
        // var archive = false;
        var name = config.name;
        var logType = config.logtype;
        var completeMessage = config.completeMessage;
        var message = config.message;
        var messageType = config.messageType;
        var debugLog = config.debug;
        // var consoleLog = config.console;
        // var fileLog = config.file;

        let logger = flowLogger;

        this.on('input', function (msg) {

          let evaldMessage = evaluateTypedParameters(node, msg, message, messageType);

          if (logType != null && logType != undefined) {
              if (completeMessage === true || completeMessage === "complete" || completeMessage === "true") {
                  if (debugLog === true || debugLog === "true") {
                      sendDebug({ id: this.id, name: this.name, topic: msg.topic, msg: msg, _path: msg._path });
                  }
                  logger.log(logType, msg);

              }
              else if (completeMessage !== undefined && completeMessage !== null && completeMessage !== "" && completeMessage !== true && completeMessage !== "true") {
                  if (debugLog === true || debugLog === "true") {
                      sendDebug({ id: this.id, name: this.name, topic: msg.topic, msg: msg[complete], _path: msg._path });
                  }
                  logger.log(logType, evaldMessage);

              }
          }
          else {
            sendDebug({ id: this.id, name: this.name, topic: "Config error", msg: "Log type was not defined for this log" });
          }

          if (msg.hasOwnProperty('error')) {
              if (debugLog === true || debugLog === "true") {
                  sendDebug({ id: this.id, name: this.name, topic: msg.topic, msg: msg.error, _path: msg._path });
              }

              logger.log('error', msg.error);

          }

          if (msg.hasOwnProperty('warn')) {
              if (debugLog === true || debugLog === "true") {
                  sendDebug({ id: this.id, name: this.name, topic: msg.topic, msg: msg.warn, _path: msg._path });
              }
              logger.log('warn', msg.warn);
          }

        });
    }
    function sendDebug(msg) {
        if (msg.msg instanceof Error) {
            msg.format = "error";
            msg.msg = msg.msg.toString();
        } else if (msg.msg instanceof Buffer) {
            msg.format = "buffer [" + msg.msg.length + "]";
            msg.msg = msg.msg.toString('hex');
        } else if (msg.msg && typeof msg.msg === 'object') {
            var seen = [];
            try {
                msg.format = msg.msg.constructor.name || "Object";
            } catch (err) {
                msg.format = "Object";
            }
            var isArray = util.isArray(msg.msg);
            if (isArray) {
                msg.format = "array [" + msg.msg.length + "]";
            }
            if (isArray || (msg.format === "Object")) {
                msg.msg = JSON.stringify(msg.msg, function (key, value) {
                    if (typeof value === 'object' && value !== null) {
                        if (seen.indexOf(value) !== -1) { return "[circular]"; }
                        seen.push(value);
                    }
                    return value;
                }, " ");
            } else {
                try { msg.msg = msg.msg.toString(); }
                catch (e) { msg.msg = "[Type not printable]"; }
            }
            seen = null;
        } else if (typeof msg.msg === "boolean") {
            msg.format = "boolean";
            msg.msg = msg.msg.toString();
        } else if (typeof msg.msg === "number") {
            msg.format = "number";
            msg.msg = msg.msg.toString();
        } else if (msg.msg === 0) {
            msg.format = "number";
            msg.msg = "0";
        } else if (msg.msg === null || typeof msg.msg === "undefined") {
            msg.format = (msg.msg === null) ? "null" : "undefined";
            msg.msg = "(undefined)";
        } else {
            msg.format = "string [" + msg.msg.length + "]";
            msg.msg = msg.msg;
        }

        if (msg.msg.length > debuglength) {
            msg.msg = msg.msg.substr(0, debuglength) + " ....";
        }
        RED.comms.publish("debug", msg);
    }

    RED.nodes.registerType("logger", OpalLoggerNode);
};
