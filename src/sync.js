/**
 * Created by michael on 10/10/14.
 */

var LowlaDB = (function(LowlaDB) {

  var SyncCoordinator = function(baseUrl) {
    if (!baseUrl || !baseUrl.length) {
      throw Error('Invalid server URL for LowlaDB Sync');
    }
    if (baseUrl[baseUrl.length - 1] != '/') {
      baseUrl += '/';
    }

    this.urls = {
      changes: baseUrl + '_lowla/changes',
      pull: baseUrl + '_lowla/pull'
    };
  };

  SyncCoordinator.prototype.processPull = function(payload) {
    var i = 0;
    var promises = [];
    while (i < payload.length) {
      var dot = payload[i].clientNs.indexOf('.');
      var dbName = payload[i].clientNs.substring(0, dot);
      var collName = payload[i].clientNs.substring(dot + 1);
      var collection = LowlaDB.collection(dbName, collName);
      if (payload[i].deleted) {
        //TODO
      }
      else {
        SyncCoordinator.validateSpecialTypes(payload[i+1]);
        promises.push(collection._updateDocument(payload[++i]));
      }
      i++;
    }

    return Promise.all(promises);
  };

  SyncCoordinator.prototype.processChanges = function(payload) {
    var ids = [];
    payload.atoms.map(function(atom) { ids.push(atom.id); });
    return LowlaDB.utils.getJSON(this.urls.pull, { ids: ids })
      .then(this.processPull.bind(this));
  };

  SyncCoordinator.prototype.fetchChanges = function() {
    return LowlaDB.utils.getJSON(this.urls.changes + '?seq=0')
      .then(this.processChanges.bind(this));
  };

  SyncCoordinator.prototype.pollForChanges = function() {
    this.fetchChanges().then(function() {
      setTimeout(this.pollForChanges, 100);
    }.bind(this));
  };

  SyncCoordinator.validateSpecialTypes = function(obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        var val = obj[key];
        if ('object' === typeof val) {
          if (val.hasOwnProperty('_bsonType')) {
            switch (val._bsonType) {
              case 'Binary':
              case 'Date':
                break;

              default:
                throw Error('Unexpected BSON type: ' + val._bsonType);
            }
          }
          else {
            SyncCoordinator.validateSpecialTypes(val);
          }
        }
      }
    }
  };

  SyncCoordinator.convertSpecialTypes = function (obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        var val = obj[key];
        if ('object' === typeof val) {
          if (val.hasOwnProperty('_bsonType')) {
            switch (val._bsonType) {
              case 'Binary':
                obj[key] = LowlaDB.utils.b64toBlob(val.encoded);
                obj[key]._lowlaType = val.type;
                break;

              case 'Date':
                obj[key] = new Date(parseInt(val.millis));
                break;

              default:
                throw Error('Unexpected BSON type: ' + val._bsonType);
            }
          }
          else {
            SyncCoordinator.convertSpecialTypes(val);
          }
        }
      }
    }

    return obj;
  };

  LowlaDB.SyncCoordinator = SyncCoordinator;

  return LowlaDB;
})(LowlaDB || {});

