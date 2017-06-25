server.js will invoke the event loop run() after connecting to redis and rabbitmq.
in this loop, we call startNPMWatcher, which will spin up a changes-stream instance (using the latest redis entry)
which will listen on registry changes, and will define the event listeners. This changes instance is sent back to run and is passed
into checkWatcher.
checkWatcher will see if the registry has been changed, and if so will destroy the current changes object, load the new registry state into redis and terminate, handing control back to run()
, which will restart the whole process
if checkWatcher does not notice an npm change, it will continually call itself until a change is identified.
