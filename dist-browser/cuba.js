(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.cuba = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
var storage_1 = require("./storage");
var util_1 = require("./util");
__export(require("./storage"));
var apps = [];
function initializeApp(config) {
    if (config === void 0) { config = {}; }
    if (getApp(config.name) != null) {
        throw new Error("Cuba app is already initialized");
    }
    var cubaApp = new CubaApp(config.name, config.apiUrl, config.restClientId, config.restClientSecret, config.defaultLocale, config.storage);
    apps.push(cubaApp);
    return cubaApp;
}
exports.initializeApp = initializeApp;
function getApp(appName) {
    var nameToSearch = appName == null ? "" : appName;
    for (var _i = 0, apps_1 = apps; _i < apps_1.length; _i++) {
        var app = apps_1[_i];
        if (app.name === nameToSearch) {
            return app;
        }
    }
    return null;
}
exports.getApp = getApp;
function removeApp(appName) {
    var app = getApp(appName);
    if (!app) {
        throw new Error('App is not found');
    }
    app.cleanup();
    apps.splice(apps.indexOf(app), 1);
}
exports.removeApp = removeApp;
var CubaApp = (function () {
    function CubaApp(name, apiUrl, restClientId, restClientSecret, defaultLocale, storage) {
        if (name === void 0) { name = ""; }
        if (apiUrl === void 0) { apiUrl = "/app/rest/"; }
        if (restClientId === void 0) { restClientId = "client"; }
        if (restClientSecret === void 0) { restClientSecret = "secret"; }
        if (defaultLocale === void 0) { defaultLocale = "en"; }
        if (storage === void 0) { storage = new storage_1.DefaultStorage(); }
        this.name = name;
        this.apiUrl = apiUrl;
        this.restClientId = restClientId;
        this.restClientSecret = restClientSecret;
        this.defaultLocale = defaultLocale;
        this.storage = storage;
        this.tokenExpiryListeners = [];
        this.messagesLoadingListeners = [];
        this.enumsLoadingListeners = [];
        this.localeChangeListeners = [];
    }
    Object.defineProperty(CubaApp.prototype, "restApiToken", {
        get: function () {
            return this.storage.getItem(this.name + "_" + CubaApp.REST_TOKEN_STORAGE_KEY);
        },
        set: function (token) {
            this.storage.setItem(this.name + "_" + CubaApp.REST_TOKEN_STORAGE_KEY, token);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CubaApp.prototype, "locale", {
        get: function () {
            var storedLocale = this.storage.getItem(this.name + "_" + CubaApp.LOCALE_STORAGE_KEY);
            return storedLocale ? storedLocale : this.defaultLocale;
        },
        set: function (locale) {
            var _this = this;
            this.storage.setItem(this.name + "_" + CubaApp.LOCALE_STORAGE_KEY, locale);
            this.localeChangeListeners.forEach(function (l) { return l(_this.locale); });
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Logs in user and stores token in provided storage.
     * @param {string} login
     * @param {string} password
     * @param {{tokenEndpoint: string}} options You can use custom endpoints e.g. {tokenEndpoint:'ldap/token'}.
     * @returns {Promise<{access_token: string}>}
     */
    CubaApp.prototype.login = function (login, password, options) {
        var _this = this;
        if (login == null) {
            login = "";
        }
        if (password == null) {
            password = "";
        }
        var fetchOptions = {
            method: "POST",
            headers: this._getBasicAuthHeaders(),
            body: "grant_type=password&username=" + encodeURIComponent(login) + "&password=" + encodeURIComponent(password),
        };
        var endpoint = options && options.tokenEndpoint ? options.tokenEndpoint : 'oauth/token';
        var loginRes = fetch(this.apiUrl + "v2/" + endpoint, fetchOptions)
            .then(this.checkStatus)
            .then(function (resp) { return resp.json(); })
            .then(function (data) {
            _this.restApiToken = data.access_token;
            return data;
        });
        return loginRes;
    };
    CubaApp.prototype.logout = function () {
        return this.revokeToken(this.restApiToken);
    };
    CubaApp.prototype.revokeToken = function (token) {
        var fetchOptions = {
            method: 'POST',
            headers: this._getBasicAuthHeaders(),
            body: 'token=' + encodeURIComponent(token),
        };
        this.clearAuthData();
        return fetch(this.apiUrl + 'v2/oauth/revoke', fetchOptions).then(this.checkStatus);
    };
    CubaApp.prototype.loadEntities = function (entityName, options) {
        return this.fetch('GET', 'v2/entities/' + entityName, options, { handleAs: 'json' });
    };
    CubaApp.prototype.searchEntities = function (entityName, entityFilter, options) {
        var data = __assign({}, options, { filter: entityFilter });
        return this.fetch('GET', 'v2/entities/' + entityName + '/search', data, { handleAs: 'json' });
    };
    CubaApp.prototype.loadEntity = function (entityName, id, options) {
        return this.fetch('GET', 'v2/entities/' + entityName + '/' + id, options, { handleAs: 'json' });
    };
    CubaApp.prototype.deleteEntity = function (entityName, id) {
        return this.fetch('DELETE', 'v2/entities/' + entityName + '/' + id);
    };
    CubaApp.prototype.commitEntity = function (entityName, entity) {
        if (entity.id) {
            return this.fetch('PUT', 'v2/entities/' + entityName + '/' + entity.id, JSON.stringify(entity), { handleAs: 'json' });
        }
        else {
            return this.fetch('POST', 'v2/entities/' + entityName, JSON.stringify(entity), { handleAs: 'json' });
        }
    };
    CubaApp.prototype.invokeService = function (serviceName, methodName, params, fetchOptions) {
        return this.fetch('POST', 'v2/services/' + serviceName + '/' + methodName, JSON.stringify(params), fetchOptions);
    };
    CubaApp.prototype.query = function (entityName, queryName, params) {
        return this.fetch('GET', 'v2/queries/' + entityName + '/' + queryName, params, { handleAs: 'json' });
    };
    CubaApp.prototype.queryCount = function (entityName, queryName, params) {
        return this.fetch('GET', 'v2/queries/' + entityName + '/' + queryName + '/count', params);
    };
    CubaApp.prototype.loadMetadata = function () {
        return this.fetch('GET', 'v2/metadata/entities', null, { handleAs: 'json' });
    };
    CubaApp.prototype.loadEntityMetadata = function (entityName) {
        return this.fetch('GET', 'v2/metadata/entities' + '/' + entityName, null, { handleAs: 'json' });
    };
    CubaApp.prototype.loadEntitiesMessages = function () {
        var _this = this;
        var fetchRes = this.fetch('GET', 'v2/messages/entities', null, { handleAs: 'json' });
        fetchRes.then(function (messages) {
            _this.messagesCache = messages;
            _this.messagesLoadingListeners.forEach(function (l) { return l(messages); });
        });
        return fetchRes;
    };
    CubaApp.prototype.loadEnums = function () {
        var _this = this;
        var fetchRes = this.fetch('GET', 'v2/metadata/enums', null, { handleAs: 'json' });
        fetchRes.then(function (enums) {
            _this.enumsCache = enums;
            _this.enumsLoadingListeners.forEach(function (l) { return l(enums); });
        });
        return fetchRes;
    };
    CubaApp.prototype.getPermissions = function () {
        return this.fetch('GET', 'v2/permissions', null, { handleAs: 'json' });
    };
    CubaApp.prototype.getUserInfo = function () {
        return this.fetch('GET', 'v2/userInfo', null, { handleAs: 'json' });
    };
    CubaApp.prototype.fetch = function (method, path, data, fetchOptions) {
        var _this = this;
        var url = this.apiUrl + path;
        var settings = {
            method: method,
            headers: {
                "Accept-Language": this.locale,
            },
        };
        if (this.restApiToken) {
            settings.headers.authorization = "Bearer " + this.restApiToken;
        }
        if (method === 'POST' || method === 'PUT') {
            settings.body = data;
            settings.headers["Content-Type"] = "application/json; charset=UTF-8";
        }
        if (method === 'GET' && data && Object.keys(data).length > 0) {
            url += '?' + util_1.encodeGetParams(data);
        }
        var handleAs = fetchOptions ? fetchOptions.handleAs : undefined;
        switch (handleAs) {
            case "text":
                settings.headers.accept = "text/html";
                break;
            case "json":
                settings.headers.accept = "application/json";
                break;
        }
        var fetchRes = fetch(url, settings).then(this.checkStatus);
        fetchRes.catch(function (error) {
            if (_this.isTokenExpiredResponse(error.response)) {
                _this.clearAuthData();
                _this.tokenExpiryListeners.forEach(function (l) { return l(); });
            }
        });
        return fetchRes.then(function (resp) {
            if (resp.status === 204) {
                return resp.text();
            }
            switch (handleAs) {
                case "text":
                    return resp.text();
                case "blob":
                    return resp.blob();
                case "json":
                    return resp.json();
                default:
                    return resp.text();
            }
        });
    };
    CubaApp.prototype.onLocaleChange = function (c) {
        var _this = this;
        this.localeChangeListeners.push(c);
        return function () { return _this.localeChangeListeners.splice(_this.localeChangeListeners.indexOf(c), 1); };
    };
    CubaApp.prototype.onTokenExpiry = function (c) {
        var _this = this;
        this.tokenExpiryListeners.push(c);
        return function () { return _this.tokenExpiryListeners.splice(_this.tokenExpiryListeners.indexOf(c), 1); };
    };
    CubaApp.prototype.onEnumsLoaded = function (c) {
        var _this = this;
        this.enumsLoadingListeners.push(c);
        return function () { return _this.enumsLoadingListeners.splice(_this.enumsLoadingListeners.indexOf(c), 1); };
    };
    CubaApp.prototype.onMessagesLoaded = function (c) {
        var _this = this;
        this.messagesLoadingListeners.push(c);
        return function () { return _this.messagesLoadingListeners.splice(_this.messagesLoadingListeners.indexOf(c), 1); };
    };
    CubaApp.prototype.cleanup = function () {
        this.storage.clear();
    };
    CubaApp.prototype.isTokenExpiredResponse = function (resp) {
        return resp && resp.status === 401;
        // && resp.responseJSON
        // && resp.responseJSON.error === 'invalid_token';
    };
    CubaApp.prototype._getBasicAuthHeaders = function () {
        return {
            "Accept-Language": this.locale,
            "Authorization": "Basic " + util_1.base64encode(this.restClientId + ':' + this.restClientSecret),
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        };
    };
    CubaApp.prototype.checkStatus = function (response) {
        if (response.status >= 200 && response.status < 300) {
            return response;
        }
        else {
            return Promise.reject({ message: response.statusText, response: response });
        }
    };
    CubaApp.prototype.clearAuthData = function () {
        this.storage.removeItem(this.name + "_" + CubaApp.REST_TOKEN_STORAGE_KEY);
        this.storage.removeItem(this.name + "_" + CubaApp.USER_NAME_STORAGE_KEY);
    };
    return CubaApp;
}());
CubaApp.REST_TOKEN_STORAGE_KEY = "cubaAccessToken";
CubaApp.USER_NAME_STORAGE_KEY = "cubaUserName";
CubaApp.LOCALE_STORAGE_KEY = "cubaLocale";
exports.CubaApp = CubaApp;

},{"./storage":2,"./util":3}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Simple im-memory storage compatible with localStorage/sessionStorage API.
 */
var DefaultStorage = (function () {
    function DefaultStorage() {
        this.items = {};
    }
    Object.defineProperty(DefaultStorage.prototype, "length", {
        get: function () {
            return Object.keys(this.items).length;
        },
        enumerable: true,
        configurable: true
    });
    DefaultStorage.prototype.clear = function () {
        this.items = {};
    };
    DefaultStorage.prototype.getItem = function (key) {
        return this.items[key];
    };
    /**
     * @deprecated operation not supported
     */
    DefaultStorage.prototype.key = function (index) {
        throw new Error('Unsupported operation');
    };
    DefaultStorage.prototype.removeItem = function (key) {
        delete this.items[key];
    };
    DefaultStorage.prototype.setItem = function (key, data) {
        this.items[key] = data;
    };
    return DefaultStorage;
}());
exports.DefaultStorage = DefaultStorage;

},{}],3:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function base64encode(str) {
    /* tslint:disable:no-string-literal */
    if (typeof btoa === 'function') {
        return btoa(str);
    }
    else if (global['Buffer']) {
        return new global['Buffer'](str).toString('base64');
    }
    else {
        throw new Error('Unable to encode to base64');
    }
    /* tslint:enable:no-string-literal */
}
exports.base64encode = base64encode;
function encodeGetParams(data) {
    return Object
        .keys(data)
        .map(function (key) {
        return encodeURIComponent(key) + "=" + (encodeURIComponent(serialize(data[key])));
    })
        .join("&");
}
exports.encodeGetParams = encodeGetParams;
function serialize(rawParam) {
    if (rawParam == null) {
        return '';
    }
    if (typeof rawParam === 'object') {
        return JSON.stringify(rawParam);
    }
    return rawParam;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[1])(1)
});