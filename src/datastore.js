/**
 * Created by michael on 10/15/14.
 */

var LowlaDB = (function(LowlaDB) {

  var indexedDB = this.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
  var Datastore = function() {
    if (!(this instanceof Datastore)) {
      return new Datastore();
    }
  };

  var _ready = false;
  var db = function() {
    if (!_ready) {
      if (!indexedDB) {
        throw Error('Unable to identify IndexedDB instance');
      }

      _ready = new Promise(function (resolve, reject) {
        var request = indexedDB.open("lowla", 1);
        request.onupgradeneeded = function (e) {
          var db = e.target.result;

          e.target.transaction.onerror = reject;

          db.createObjectStore("lowla", {keyPath: "clientId"});
        };

        request.onsuccess = function (e) {
          resolve(e.target.result);
        };

        request.onerror = function (e) {
          reject(e);
        };
      });
    }

    return _ready;
  };

  Datastore.prototype.scanDocuments = function(docFn, doneFn, errFn) {
    db().then(function(db) {
      if (typeof(docFn) === 'object') {
        doneFn = docFn.done || function () {
        };
        errFn = docFn.error || function (err) { throw err; };
        docFn = docFn.document || function () {
        };
      }

      var trans = db.transaction(["lowla"], "readwrite");
      var store = trans.objectStore("lowla");

      // Get everything in the store;
      var keyRange = IDBKeyRange.lowerBound(0);
      var cursorRequest = store.openCursor(keyRange);

      cursorRequest.onsuccess = function (e) {
        var result = e.target.result;
        if (!result) {
          doneFn();
          return;
        }

        docFn(result.value.clientId, result.value.document);
        result.continue();
      };

      cursorRequest.onerror = function (e) {
        errFn(e);
      };
    });
  };

  Datastore.prototype.transact = function(callback, doneCallback, errCallback) {
    errCallback = errCallback || function(){};

    db().then(function(db) {
      var tx = db.transaction(["lowla"], "readwrite");
      tx.oncomplete = function(evt) {
        doneCallback();
      };
      tx.onerror = function(e) {
        errCallback(e);
      };

      var txWrapper = {
        load: loadInTx,
        save: saveInTx,
        scan: scanInTx
      };

      callback(txWrapper);
      ////////////////////

      function loadInTx(clientId, loadCallback, loadErrCallback) {
        loadErrCallback = loadErrCallback || errCallback;
        var store = tx.objectStore("lowla");
        var keyRange = IDBKeyRange.only(clientId);
        var request = store.openCursor(keyRange);
        request.onsuccess = function (evt) {
          var doc = evt.target.result ? evt.target.result.value.document : null;
          loadCallback(doc, txWrapper);
        };
        request.onerror = loadErrCallback;
      }

      function saveInTx(clientId, doc, saveCallback, saveErrCallback) {
        saveErrCallback = saveErrCallback || errCallback;
        var store = tx.objectStore("lowla");
        var request = store.put({
          "clientId": clientId,
          "document": doc
        });

        request.onsuccess = function (e) {
          saveCallback(doc, txWrapper);
        };

        request.onerror = function (e) {
          saveErrCallback(e);
        };
      }

      function scanInTx(scanCallback, scanDoneCallback, scanErrCallback) {
        scanErrCallback = scanErrCallback || errCallback;
        var store = tx.objectStore("lowla");
        var keyRange = IDBKeyRange.lowerBound(0);
        var request = store.openCursor(keyRange);

        request.onsuccess = function (e) {
          var result = e.target.result;
          if (!result) {
            scanDoneCallback(txWrapper);
            return;
          }

          scanCallback(result.value.clientId, result.value.document, txWrapper);
          result.continue();
        };

        request.onerror = function (e) {
          scanErrCallback(e);
        };
      }
    });

  };

  Datastore.prototype.loadDocument = function(clientId, docFn, errFn) {
    db().then(function(db) {
      if (typeof(docFn) === 'object') {
        errFn = docFn.error || function (err) { throw err; };
        docFn = docFn.document || function () {
        };
      }

      var trans = db.transaction(["lowla"], "readwrite");
      var store = trans.objectStore("lowla");

      var keyRange = IDBKeyRange.only(clientId);
      var cursorRequest = store.openCursor(keyRange);

      cursorRequest.onsuccess = function (e) {
        var result = e.target.result;
        if (!result) {
          docFn(null);
        }
        else {
          docFn(result.value.document);
        }
      };

      cursorRequest.onerror = function (e) {
        errFn(e);
      };
    });
  };

  Datastore.prototype.updateDocument = function(clientId, doc, doneFn, errorFn) {
    db().then(function (db) {
      var trans = db.transaction(["lowla"], "readwrite");
      var store = trans.objectStore("lowla");
      var request = store.put({
        "clientId": clientId,
        "document": doc
      });

      trans.oncomplete = function (e) {
        if (doneFn) {
          doneFn(doc);
        }
      };

      request.onerror = function (e) {
        if (errorFn) {
          errorFn(e);
        }
      };
    });
  };

  Datastore.prototype.deleteDocument = function(clientId, doneFn, errorFn) {
    if (typeof doneFn === 'object') {
      errorFn = doneFn.error || function(e) { throw e; };
      doneFn = doneFn.done || function() { };
    }

    db().then(function(db) {
      var request = db.transaction(["lowla"], "readwrite").objectStore("lowla").delete(clientId);
      request.onsuccess = function(event) {
        doneFn();
      };
      request.onerror = function(event) {
        errorFn();
      };
    });
  };

  Datastore.prototype.close = function() {
    if (_ready) {
      return _ready.then(function(db) {
        _ready = false;
        db.close();
      });
    }
  };

  LowlaDB.Datastore = new Datastore();

  return LowlaDB;
})(LowlaDB || {});