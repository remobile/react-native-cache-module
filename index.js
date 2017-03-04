/*
* (The MIT License)
* Copyright (c) 2015-2017 YunJiang.Fang <42550564@qq.com>
*/
'use strict';

var Platform = require('react-native').Platform;
var Sqlite = require('@remobile/react-native-sqlite');
var fs = require('react-native-fs');
var FileTransfer = require('@remobile/react-native-file-transfer');
var Zip = require('@remobile/react-native-zip');
var md5 = require("./md5.js");

const DB_NAME = "cache_module";
const TABLE_CACHE_MODULE = "cache_module";
const TABLE_CACHE_STORAGE = "cache_storage";
const CACHE_MODULE_DIR = 'cacheModules';
const CACHE_MODULE_SIZE = 1024*1024*500;

var xconsole = console;
var syncModuleSource = {};
var db = Sqlite.openDatabase({name:DB_NAME, location: 'default'});

class StorageMgr {
    constructor() {
        this.storage = 0;
        fs.mkdir(fs.DocumentDirectoryPath+'/'+CACHE_MODULE_DIR);
        xconsole.log(fs.DocumentDirectoryPath+'/'+CACHE_MODULE_DIR);
        db.transaction((tx)=>{
            tx.executeSql('CREATE TABLE IF NOT EXISTS '+TABLE_CACHE_MODULE+' (name varchar(40) primary key, size integer, time integer)');
            tx.executeSql('CREATE TABLE IF NOT EXISTS '+TABLE_CACHE_STORAGE+' (key integer primary key, storage integer)');
            tx.executeSql('SELECT storage FROM '+TABLE_CACHE_STORAGE+' WHERE key=1', [], (tx, rs)=>{
                if (rs.rows.length) {
                    this.storage = rs.rows.item(0).storage;
                    xconsole.log('StorageMgr', this.storage);
                }
            });
        }, (error)=>{
            console.log('StorageMgr <error>', error);
        });
    }
    GET(url, success, error) {
        fetch(url)
        .then((response) => response.json())
        .then((json) => {
            console.log(url, json);
            success && success(json);
        })
        .catch((err) => {
            error(err);
        });
    }
    getCacheFilePath(name) {
        return fs.DocumentDirectoryPath+'/'+CACHE_MODULE_DIR+'/'+name;
    }
    lock(name) {
        syncModuleSource[name] = true;
    }
    unlock(name) {
        delete syncModuleSource[name];
    }
    islock(name) {
        return syncModuleSource[name];
    }
    clear() {
        fs.unlink(fs.DocumentDirectoryPath+'/'+CACHE_MODULE_DIR);
        db.transaction((tx)=>{
            tx.executeSql('DROP TABLE '+TABLE_CACHE_MODULE);
            tx.executeSql('DROP TABLE '+TABLE_CACHE_STORAGE);
            this.storage = 0;
            fs.mkdir(fs.DocumentDirectoryPath+'/'+CACHE_MODULE_DIR);
            xconsole.log(fs.DocumentDirectoryPath+'/'+CACHE_MODULE_DIR);
            db.transaction((tx)=>{
                tx.executeSql('CREATE TABLE IF NOT EXISTS '+TABLE_CACHE_MODULE+' (name varchar(40) primary key, size integer, time integer)');
                tx.executeSql('CREATE TABLE IF NOT EXISTS '+TABLE_CACHE_STORAGE+' (key integer primary key, storage integer)');
                tx.executeSql('SELECT storage FROM '+TABLE_CACHE_STORAGE+' WHERE key=1', [], (tx, rs)=>{
                    if (rs.rows.length) {
                        this.storage = rs.rows.item(0).storage;
                        xconsole.log('StorageMgr', this.storage);
                    }
                });
            }, (error)=>{
                console.log('StorageMgr <error>', error);
            });
        });
    }
    addCacheModule(name, size) {
		return new Promise((resolve, reject) => {
            db.transaction((tx)=>{
                tx.executeSql('INSERT INTO '+TABLE_CACHE_MODULE+' (name, size, time) VALUES (?, ?, ?)', [name, size, parseInt(Date.now()/1000)], (tx, rs)=>{
                    xconsole.log('addCacheModule <insert>', name, size);
                    resolve(true);
                });
            }, (error)=>{
                console.log('addCacheModule <error>', name, size, error);
                resolve(false);
            });
		});
	}
    updateCacheModuleTime(name) {
		return new Promise((resolve, reject) => {
            db.transaction((tx)=>{
                tx.executeSql('UPDATE '+TABLE_CACHE_MODULE+' SET time=?  WHERE name=?', [parseInt(Date.now()/1000), name], (tx, rs)=>{
                    xconsole.log('updateCacheModuleTime <update>', name);
                    resolve(true);
                });
            }, (error)=>{
                console.log('updateCacheModuleTime <error>', name, error);
                resolve(false);
            });
		});
	}
    updateCacheModuleTimeAndSize(name, size) {
		return new Promise((resolve, reject) => {
            db.transaction((tx)=>{
                tx.executeSql('SELECT size FROM '+TABLE_CACHE_MODULE+' WHERE name=?', [name], (tx, rs)=>{
                    const item = rs.rows.item(0)||{size: 0};
                    tx.executeSql('UPDATE '+TABLE_CACHE_MODULE+' SET time=?, size=? WHERE name=?', [parseInt(Date.now()/1000), size, name], (tx, rs)=>{
                        xconsole.log('updateCacheModuleTimeAndSize <update>', name, size, item.size, size-item.size);
                        resolve(size-item.size);
                    });
                });
            }, (error)=>{
                console.log('updateCacheModuleTimeAndSize <error>', name, error);
                resolve(0);
            });
		});
	}
    deleteCacheModule() {
        return new Promise((resolve, reject) => {
            db.transaction((tx)=>{
                tx.executeSql('SELECT name, size FROM '+TABLE_CACHE_MODULE+' WHERE time=(SELECT MIN(time) FROM '+TABLE_CACHE_MODULE+')', [], (tx, rs)=>{
                    if (rs.rows.length) {
                        var {name, size} = rs.rows.item(0);
                        tx.executeSql('DELETE FROM '+TABLE_CACHE_MODULE+' WHERE name=?', [name], async (tx, rs)=>{
                            xconsole.log('deleteCacheModule <delete>', name, size);
                            await fs.unlink(this.getCacheFilePath(name));
                            await this.updateStorage(-size);
                            resolve();
                        });
                    }
                });
            }, (error)=>{
                console.log('deleteCacheModule <error>', error);
                reject(error);
            });
        });
    }
    updateStorage(offset) {
        xconsole.log('StorageMgr updateStorage', this.storage, offset);
        return new Promise(async(resolve, reject) => {
            db.transaction((tx)=>{
                tx.executeSql('UPDATE '+TABLE_CACHE_STORAGE+' SET storage=storage+?'+' WHERE key=1', [offset], (tx, rs)=>{
                    if (rs.rowsAffected == 0) {
                        tx.executeSql('INSERT INTO '+TABLE_CACHE_STORAGE+' (key, storage) VALUES (1, ?)', [offset], (tx, rs)=>{
                            xconsole.log('updateStorage <insert>', offset);
                            this.storage = offset;
                            resolve(true);
                        });
                    } else {
                        xconsole.log('updateStorage <update>', offset);
                        this.storage += offset;
                        resolve(true);
                    }
                });
            }, (error)=>{
                console.log('updateStorage <error>', error);
                resolve(false);
            });
        });
    }
    checkCacheStorage() {
        return new Promise(async(resolve, reject) => {
            xconsole.log('target:', this.storage);
            while (this.storage >= CACHE_MODULE_SIZE) {
                await this.deleteCacheModule();
                xconsole.log('after:', this.storage);
            }
            resolve();
        });
    }
    unzipModule(option) {
        console.log("unzipModule:", option);
        const {filepath, name, filename, zipPath, update, resolve} = option
        Zip.unzip(zipPath, filepath+'/'+(update ? 'new' : 'app'), async (res)=>{
            const {size} = await fs.stat(zipPath);
            await fs.unlink(zipPath);
            if (res) { //unzip error
                if (update) {
                    await this.updateCacheModuleTime(name);
                    resolve(filename);
                } else {
                    resolve(null);
                }
            } else {
                if (update) {
                    await fs.unlink(filepath+'/app');
                    await fs.moveFile(filepath+'/new', filepath+'/app');
                    const offset = await this.updateCacheModuleTimeAndSize(name, size);
                    await this.updateStorage(offset);
                } else {
                    await this.addCacheModule(name, size);
                    await this.updateStorage(size);
                }
                await fs.writeFile(filepath+'/version.json', JSON.stringify(option.version), 'utf8');
                await this.checkCacheStorage();
                resolve(filename);
            }
        });
    }
    downloadModule(option) {
        console.log("downloadModule:", option);
        const {url, filepath, filename, name, update, resolve} = option;
        const zipPath = filepath+'/'+Platform.OS+'.zip';
        var fileTransfer = new FileTransfer();
        fileTransfer.download(
            url+'/'+Platform.OS+'.zip',
            zipPath,
            (result)=>{
                console.log("downloadModule success:", result);
                option.zipPath = zipPath;
                this.unzipModule(option);
            },
            async (error)=>{
                console.log("downloadModule error:", error);
                if (update) {
                    await this.updateCacheModuleTime(name);
                    resolve(filename);
                } else {
                    resolve(null);
                }
            },
            true
        );
    }
    getVersion(option) {
        const versionUrl = option.url+'/version.json';
        console.log("getServerVersion:", versionUrl);
        this.GET(versionUrl, this.getServerVersionSuccess.bind(this, option), this.getServerVersionError.bind(this, option));
    }
    getServerVersionSuccess(option, remote) {
        console.log("getServerVersionSuccess:", remote);
        const {name, filepath, filename, update, resolve} = option;
        option.version = remote;
        if (update) {
            fs.readFile(filepath+'/version.json').then(async (text)=>{
                let needUpdate = false;
                try {
                    const version = JSON.parse(text);
                    if (remote[Platform.OS] != version[Platform.OS]) {
                        needUpdate = true;
                    }
                } catch(e) {
                    needUpdate = true;
                }
                if (needUpdate) {
                    this.downloadModule(option);
                } else {
                    await this.updateCacheModuleTime(name);
                    resolve(filename);
                }
            });
        } else {
            this.downloadModule(option);
        }

    }
    async getServerVersionError(option, error) {
        console.log("getServerVersionError:", error);
        const {name, filename, update, resolve} = option;
        if (update) {
            await this.updateCacheModuleTime(name);
            resolve(filename);
        } else {
            resolve(null);
        }
    }
    async doCheckModuleSource(option) {
        const {name, filename} = option;
        this.lock(name);
        option.update = await fs.exists(filename);
        this.getVersion(option);
        this.unlock(name);
    }
    checkModuleSource(option) {
        if (this.islock(option.name)) {
            setTimeout(()=>{this.checkModuleSource(option)}, 100);
        } else {
            this.doCheckModuleSource(option);
        }
    }
    getModulePath(url) {
        return new Promise(async(resolve) => {
            const name =  md5(url);
            const filepath = this.getCacheFilePath(name);
            const filename = filepath + '/app/index.' + Platform.OS + '.bundle';
            this.checkModuleSource({url, name, filepath, filename, resolve});
        });
    }
}

module.exports = new StorageMgr();
