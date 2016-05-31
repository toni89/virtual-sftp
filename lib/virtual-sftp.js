'use strict';
var fs = require('fs');
var path = require('path');
var events = require('events');
var Client = require('scp2').Client;
var async = require('async');
var fasthash = require('fasthash');
var extend = require('extend');

class VirtualSftp extends events.EventEmitter {

    constructor(options) {
        super();
        this.defaults = {
            port: 22,
            username: '',
            host: '',
            remoteDir: '/virtualsftp-tmp-01',
            algorithm: 'md5'
        };
        this.options = extend(true, this.defaults, options);
        this.pathMap = {};
        this.uploads = [];

        this.expectedTree = {};
        this.currentTree = {};

        this.itemJobs = [];

        return this;
    }

    addChecksum(hashes) {
        for(var file in hashes) {
            if(hashes.hasOwnProperty(file)) {
                this.currentTree[path.join('/', file)] = hashes[file];
            }
        }
        return this;
    }

    addPath(itemPath, mapTo) {
        this.pathMap[itemPath] = mapTo;
        return this;
    }
    
    upload() {
        var self = this;
        
        for(var src in this.pathMap) {
            if(this.pathMap.hasOwnProperty(src)) {
                if(!fs.existsSync(src)) {
                    return;
                }
                var target = this.pathMap[src];
                if(!target || target == '') {
                    target = path.basename(src);
                }
                self._addItems([path.basename(src)], path.dirname(src), src, target);
            }
        }

        async.series(self.itemJobs, function(error) {
            if(error) {
                console.log(error);
            }
            self._uploadItems();
        });
        return this;
    }
    
    _addItems(files, dir, basedir, targetDir) {
        var self = this;
        
        files.forEach(function(file) {
            var filePath = path.join(dir, file);
            if(!fs.existsSync(filePath)) {
                return;
            }

            var stats = fs.statSync(filePath);
            var relativePath = path.relative(basedir, filePath);
            var targetPath = path.join('/', targetDir, relativePath);

            if(stats.isFile())
            {
                self.itemJobs.push(function(done) {
                    fasthash.file(filePath, { algorithm: self.options.algorithm }, function(error, checksum) {
                        var filebase = path.dirname(targetPath);
                        if(!self.expectedTree.hasOwnProperty(filebase)) {
                            self.expectedTree[filebase] = '';
                        }
                        self.expectedTree[targetPath] = checksum || '';
                        if(error ||  (self.currentTree.hasOwnProperty(targetPath) && self.currentTree[targetPath] == checksum)) {
                            done();
                            return;
                        }

                        self.uploads.push({
                            src: filePath,
                            relative: relativePath,
                            target: targetPath
                        });
                        done();
                    });
                });
            }

            if(stats.isDirectory()) {
                self.expectedTree[targetPath] = '';
                self._addItems(fs.readdirSync(filePath), filePath, basedir, targetDir);
            }
        });
    }
    
    _uploadItems() {
        var self = this;
        var jobs = [];
        var client = new Client(self.options);
        var totalJobs = self.uploads.length;
        var pendingJobs = 0;

        client.on('connect', function(){
            self.emit('connect');
        });

        client.on('error', function(error){
            self.emit('error', error);
        });

        self.uploads.forEach(function(file) {
            jobs.push(function(done) {
                var remotePath = path.join(self.options.remoteDir, file.target);

                client.upload(file.src, remotePath, function() {
                    pendingJobs++;
                    self.emit('progress', {
                        src: file.src,
                        relative: file.relative,
                        target: file.target,
                        percent: Math.round((pendingJobs * 100) / totalJobs)
                    });
                    done();
                });
            });
        });

        async.series(jobs, function(error) {
            if(error) {
                self.emit('error', error);
            }
            self.emit('complete', self.expectedTree);
            client.close();
        });
    }
}

module.exports = VirtualSftp;