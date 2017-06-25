server.js will self invoke run after connecting to redis and rabbitmq.
In this loop, it will pass in the rabbitmq channel and redis client into startNPMWatcher, which will get the latest stored changes set from
redis, and then use changes-stream to get most current changes from registry, and then handle it (enqueue it w/ helper function).
startNPMWatcher will return the changes set enqueued into rabbitmq and it is consumed by checkWatcher, which I think will then verify redis was updated? Not sure yet...


