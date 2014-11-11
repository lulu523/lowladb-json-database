# LowlaDB #

[![Build Status](https://travis-ci.org/lowla/lowladb.svg)](https://travis-ci.org/lowla/lowladb)

LowlaDB is a database for mobile applications. It syncs data from a wide variety of backends down to the device so that applications can always use data that is stored locally. That makes applications *fast* because data is always close by and *reliable* because they never have to worry about signal strength or the availability of WiFi.

The initial release of LowlaDB is a pure javascript implementation that runs on either IndexedDB or WebSQL. It works well for small numbers of records and provides a rapid development cycle. If your application needs to scale to larger databases, a later release of LowlaDB will add a specialized datastore implementaton designed to run in Cordova. Web applications built with LowlaDB will run in Cordova with no code changes required and will automatically detect and use the improved datastore. The Cordova implementation will also add features not possible in the browser such as overnight syncing.

The developer API for LowlaDB is based closely on MongoDB. An overview of the API follows, but for more details on the direction in which we intend to take the API, see the documentation for the Node.js MongoDB driver [here](http://mongodb.github.io/node-mongodb-native/index.html). In addition to the basic API, LowlaDB adds extensions to support real-time data updates and wherever possible offers promise-based APIs as an alternative to callbacks.

## License ##
LowlaDB will be available under the MIT license.

## Opening a Collection ##
Objects in LowlaDB are stored in collections. A database contains one or more collections. Databases and collections are created automatically the first time they are referenced.  
To open a collection, you call the `collection` method on the global `LowlaDB` object.

    var todos = LowlaDB.collection('mydb', 'todos');
	
## Inserting Objects ##
LowlaDB stores regular Javascript objects. To add an object to a collection, you call the `insert` method.

    var todos = LowlaDB.collection('mydb', 'todos');
	var todo = {
	    title: "Action to do",
	    completed: false
	};
	
	todos.insert(todo);

The actual insert may be asynchronous. If you need to verify that the object was saved without error or perform another action once the save is complete, you can either provide a callback

    todos.insert(todo, function(err, doc){});

or use a promise

    todos.insert(todo).then(function(doc){}, function(err){});

All objects must have a unique identifier property, named `_id`. LowlaDB will create one for you if you try to insert an object without one.

You may also pass an array of objects to insert.  The result will be an array of the inserted documents:

	var newTodos = [ { title: "Action One" }, { title: "Action Two" } ];
	todos.insert(newTodos).then(function(arrDocs){});

## Retrieving Objects ##
You retrieve objects using the `find` method. This takes a query object that acts as a selector for the objects to be returned. The `find` method returns a `Cursor` object that you can iterate or convert to an array.

    var todos = LowlaDB.collection('mydb', 'todos');

	// Find with no query object returns all records in the collection
	todos.find().each(function(err, doc) { });
	todos.find().toArray(function(err, docs) { });
	
	// Or, using a promise
	todos.find().toArray().then(function(docs) { }, function(err));
	
LowlaDB also supports real-time updating where it will monitor the collection for changes and automatically notify you when the query results may have changed.
	
	todos.find().on(function(err, cursor) { 
	    cursor.toArray(function(err, docs) { });
	    // or, using a promise
	    cursor.toArray().then(function(docs) { });
	});
    

The callback specified in the `on` method will be called whenever *any* changes are made to the collection. This includes changes made as a result of inserting or modifying records as well as changes introduced during synchronization. This allows you to centralize all of your UI update code in a single method.

Initially, LowlaDB will support `find` with no query object or with a query object matching a single property:

    todos.find({ completed:false }).toArray().then(function(docs) {});

Support for richer queries will be added later.

If you know you only require a single record, you can use `findOne` rather than `find` to return the object directly without needing to iterate a cursor.

## Cursors ##

The `Cursor` object provides methods to determine the iterable documents.  Each method returns a new instance of `Cursor`.

The `sort` method creates a cursor that will order the documents on the given field.  Provide a positive value for ascending order, and a negative number for descending order.

    todos.find().sort({ title: 1 }).toArray(...)

The `limit` method creates a cursor that will return at most the given number of documents. 

    todos.find().limit(3).toArray(...)

The `showPending` method will inject a field named `$pending` into each object returned by the cursor.  `$pending` will be `true` if the object has outgoing changes that have not yet been sent to the server.

	todos.find().showPending().each(function(doc) {
		// doc.$pending will be true/false based on sync status
	});

Since each method returns a new instance of `Cursor`, the methods can be chained.  The following both limits and sorts the resulting documents:

    todos.find().sort({ title: 1}).limit(3).toArray(...)
    
## Updating Objects ##
You update objects using the `findAndModify` method. This takes a query object, subject to the same requirements as the `find` methods, and also an object to either replace the existing data or describe the modifications to be made to the existing object. For example

    var todos = LowlaDB.collection('mydb', 'todos');
	todos.findAndModify({ _id: 'theId' }, { $set: { completed: true } });

Initially, LowlaDB will support `$set` and `$unset` to modify or remove properties from a document. More operators will be added later.

As with `insert`, you can use either a callback or a promise to confirm that the update was successful.

## Removing Objects ##
You remove objects using the `remove` method. Similar to `find`, this takes a query object to specify the objects to be removed. For example

    var todos = LowlaDB.collection('mydb', 'todos');
	todos.remove({ _id: 'theId' });

You can add a callback or promise to confirm that the remove was successful.

## Syncing ##
You initiate sync with the `sync` method. This will perform an incremental, bi-directional sync with the specified server and, optionally, leave the sync channel open for real-time updates. If you choose to enable real-time sync, LowlaDB will call your `on` callbacks for any active queries whenever changes are made to a collection.

    LowlaDB.sync('syncServer', { /* options e.g. authentication, leave channel open */ });

## Sync Events ##
LowlaDB provides a simple event emitter interface to notify your app of sync operations as they occur using the `on` method.

	LowlaDB.on('syncBegin', showBusy);
	LowlaDB.on('syncEnd', hideBusy);

To stop receiving events, use the `off` method:

	LowlaDB.off('syncBegin', showBusy);
	LowlaDB.off('syncEnd', showBusy);
	// Alternatively, to disable all events:
	LowlaDB.off();

There are three pairs of events fired during sync:

### syncBegin / syncEnd ###
These events are emitted at the beginning and end of a polled sync operation, even if no documents actually need to sync.

### pushBegin / pushEnd ###
`pushBegin` will be emitted when LowlaDB has determined there are outgoing changes that need to be sent to the server and is preparing to send them.  `pushEnd` will be emitted after all outgoing changes have been sent.

### pullBegin / pullEnd ###
`pullBegin` will be emitted when LowlaDB has received information from the Syncer that documents need to be retrieved from the server.  `pullEnd` will be emitted after LowlaDB has requested and received those documents.

