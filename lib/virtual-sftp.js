'use strict';

var fs = require('fs');
var path = require('path');
var events = require('events');
var Client = require('scp2').Client;
var async = require('async');
var hashsum = require('hashsum');
var extend = require('extend');


class VirtualSftp extends events.EventEmitter {
    constructor(options) {
        super();
        this.defaults = {
            port: 22,
            username: '',
            host: '',
            remoteDir: '/virtualsftp-tmp-01'
        };
        this.options = extend(true, this.defaults, options);
        this.pathMap = {};
        this.uploads = [];

        this.fileHashes = {};
        this.algorithm = 'sha1';
        
        return this;
    }

    addChecksum(fileHashes, algorithm) {
        this.fileHashes = fileHashes || {};
        this.algorithm = algorithm || 'sha1';
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
        
        self._uploadItems();
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
            
            if(stats.isFile())
            {
                var relativePath = path.relative(basedir, filePath);
                var targetPath = path.join(targetDir, relativePath);

                if(self.fileHashes.hasOwnProperty(targetPath)
                    && hashsum.fileSync(filePath, { algorithm: self.algorithm }) == self.fileHashes[targetPath]) {
                    return;
                }

                self.uploads.push({
                    src: filePath,
                    relative: relativePath,
                    target: targetPath
                });
            }

            if(stats.isDirectory()) {
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

                client.upload(file.src, remotePath, function(error) {
                    pendingJobs++;
                    self.emit('progress', {
                        file: file,
                        percent: Math.round((pendingJobs * 100) / totalJobs)
                    });
                    done(error);
                });
            });
        });

        async.series(jobs, function(error) {
            if(error) {
                self.emit('error', error);
            }
            self.emit('complete');
            client.close();
        });
    }
}

module.exports = VirtualSftp;