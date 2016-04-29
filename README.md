# virtual-sftp

Synchronize files and folders from different locations and send them over sftp/ssh to a new location inside an basedir.
 
## Example
 
```javascript
var vsftp = require('virtual-sftp');
var sync = new vsftp({
    host: 'localhost',
    username: 'myuser',
    password: 'mysecret',
    remoteDir: '/mybase',
    tryKeyboard: true
});

sync
    .addPath('/myfolder') // -> /mybase/myfolder
    .addPath('/somewhere/myfolder2', 'renamedfolder') // -> /mybase/renamedfolder
    .addPath('/somewhere/myfolder3', 'newfolder/renamedfolder') // -> /mybase/newfolder/renamedfolder
    .addPath('/somewhere/myfolder4', '/') // -> /mybase
    .addPath('/home/myuser/myfile') // -> /mybase/myfile
    .addPath('/home/myuser/somewhere/myfile1', 'renamedfile') // -> /mybase/renamedfile
    .addPath('/home/myuser/somewhere/myfile2', 'newfolder/renamedfile') // -> /mybase/newfolder/renamedfile
    .on('connect', function() {
        console.log('Connected');
    })
    .on('error', function(error) {
        console.log(error);
    })
    .on('progress', function(progress) {
        console.log('Progress', progress.src, progress.relative, progress.target, progress.percent);
    })
    .on('complete', function(tree) {
        console.log('Completed. Expected Filestructure is: ', tree);
    })
    .upload();
```

## Example with Sync

### Remote Machine
```javascript
var hashsum = require('hashsum');
var hashes = hashsum.directorySync('/mybase', { relativePaths: true, algorithm: 'md5' });
```

### Server
```javascript
var vsftp = require('virtual-sftp');
var sync = new vsftp({
    host: 'localhost',
    username: 'myuser',
    password: 'mysecret',
    remoteDir: '/mybase',
    tryKeyboard: true
});

sync
    .addChecksum(hashes)
    .addPath('/myfolder', 'my/crazy/path')
    .upload();
```
 
