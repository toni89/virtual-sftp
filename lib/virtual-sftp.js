'use strict';

var fs = require('fs');
var path = require('path');
var events = require('events');
var Client = require('scp2').Client;
var async = require('async');
var _ = require('lodash');


class VirtualSftp extends events.EventEmitter {
    constructor(options) {
        super();
        this.defaults = {
            port: 22,
            username: '',
            host: '',
            remoteDir: '/virtualsftp-tmp-01'
        };
        this.options = _.merge({}, this.defaults, options);
        this.pathMap = {};
        this.uploads = [];
        
        return this;
    }

    addPath(itemPath, mapTo) {
        this.pathMap[itemPath] = mapTo;
        return this;
    }
    
    upload() {
        var self = this;

        _(this.pathMap).forEach(function(target, src) {
            if(!fs.existsSync(src)) {
                return;
            }
            if(!target || target == '') {
                target = path.basename(src);
            }
            self._addItems([path.basename(src)], path.dirname(src), src, target);
        });

        self._uploadItems();
        return this;
    }
    
    
    _addItems(files, dir, basedir, targetDir) {
        var self = this;

        _(files).forEach(function(file) {
            var filePath = path.join(dir, file);
            if(!fs.existsSync(filePath)) {
                return;
            }

            var stats = fs.statSync(filePath);
            
            if(stats.isFile())
            {
                self.uploads.push({
                    src: filePath,
                    target: path.join(targetDir, path.relative(basedir, filePath))
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

        _(self.uploads).forEach(function(file) {
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